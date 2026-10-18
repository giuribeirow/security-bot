const { PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('./configManager');
const { createTextContainer, IS_COMPONENTS_V2 } = require('./componentsV2');
const { scanLinks } = require('./linkScanner');
const { scanMessageImages } = require('./imageScanner');
const { analyzeTextWithAI } = require('./aiClient');
const { loadSecurityData, recordEvent, saveSecurityData } = require('./securityData');
const { logError } = require('./logger');

const recentMessageCache = new Map();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function isBypassed(member, config) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const bypass = new Set([...(config.bypassRoleIds || []), ...(config.adminRoleIds || [])]);
  return member.roles.cache.some((role) => bypass.has(role.id));
}

function severityFromRisk(risk) {
  if (risk >= 90) return 'critical';
  if (risk >= 75) return 'high';
  if (risk >= 45) return 'medium';
  if (risk >= 20) return 'low';
  return 'safe';
}

function actionForSeverity(severity, config) {
  if (severity === 'safe') return 'ignore';
  return config.actions?.[severity] || 'log';
}

function clampRisk(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function updateReputation(guildId, userId, risk, reason) {
  const data = loadSecurityData();
  const key = `${guildId}:${userId}`;
  const current = data.reputation[key] || {
    guildId,
    userId,
    score: 100,
    strikes: 0,
    lastEvents: []
  };
  const loss = risk >= 90 ? 18 : risk >= 75 ? 11 : risk >= 45 ? 6 : risk >= 20 ? 2 : 0;
  current.score = Math.max(0, Math.min(100, current.score - loss));
  if (risk >= 45) current.strikes += 1;
  current.lastEvents.push({ at: nowSeconds(), risk, reason });
  current.lastEvents = current.lastEvents.slice(-20);
  data.reputation[key] = current;
  saveSecurityData();
  return current;
}

function recordMessageWindow(message) {
  const key = `${message.guild.id}:${message.author.id}`;
  const list = recentMessageCache.get(key) || [];
  const now = Date.now();
  list.push({
    at: now,
    content: message.content.toLowerCase().replace(/\s+/g, ' ').trim(),
    channelId: message.channel.id,
    attachments: message.attachments.size
  });
  const fresh = list.filter((entry) => now - entry.at <= 30000);
  recentMessageCache.set(key, fresh);
  return fresh;
}

function analyzeLocalMessage(message, config) {
  const findings = [];
  const content = message.content || '';
  const normalized = content.toLowerCase();
  const window = recordMessageWindow(message);
  const repeated = window.filter((entry) => entry.content && entry.content === window.at(-1)?.content).length;

  if (window.length >= 8) {
    findings.push({ risk: 62, category: 'flood', reason: 'Muitas mensagens em pouco tempo' });
  }
  if (repeated >= 4) {
    findings.push({ risk: 72, category: 'repeated_flood', reason: 'Mensagem repetida várias vezes' });
  }
  if (message.mentions.users.size + message.mentions.roles.size >= 6) {
    findings.push({ risk: 78, category: 'mass_mentions', reason: 'Menções em massa detectadas' });
  }
  if (/mfa\.[\w-]{20,}|[\w-]{24}\.[\w-]{6}\.[\w-]{25,}/.test(content)) {
    findings.push({ risk: 96, category: 'token', reason: 'Possível token do Discord exposto' });
  }
  if (/\b(check my bio|free nitro|steam gift|claim reward|verify your account|ganhe nitro|nitro gratis|resgate nitro)\b/i.test(content)) {
    findings.push({ risk: 84, category: 'scam_phrase', reason: 'Frase comum em golpe ou divulgação maliciosa' });
  }
  if (/\b(vou te matar|vou matar voce|kill yourself|se mata|ameaça|vou invadir)\b/i.test(content)) {
    findings.push({ risk: 82, category: 'threat', reason: 'Ameaça ou incitação perigosa' });
  }
  if (/\b(macaco|preto imundo|nazista|hitler tinha razao|faggot|nigger)\b/i.test(normalized)) {
    findings.push({ risk: 88, category: 'hate', reason: 'Possível discurso de ódio' });
  }

  const linkBlockedChannels = config.linkPolicy?.blockedChannels || [];
  const shouldScanLinks = !linkBlockedChannels.length || linkBlockedChannels.includes(message.channel.id);
  if (config.modules?.maliciousLinks && shouldScanLinks) {
    const linkResult = scanLinks(content, config);
    for (const finding of linkResult.findings) findings.push(finding);
  }

  return findings;
}

function combineFindings(findings, aiResult = null, imageResults = []) {
  const all = [...findings];
  for (const image of imageResults) {
    for (const finding of image.findings) {
      all.push({
        ...finding,
        category: `image_${finding.category}`,
        reason: `${finding.reason}${finding.details ? `: ${finding.details}` : ''}`
      });
    }
  }
  if (aiResult && aiResult.severity !== 'safe') {
    all.push({
      risk: Number(aiResult.risk) || 0,
      category: aiResult.category || 'ai',
      reason: aiResult.reason || 'Conteúdo suspeito identificado pela IA',
      aiAction: aiResult.recommendedAction
    });
  }
  if (!all.length) return { risk: 0, category: 'safe', reason: 'Nenhum risco detectado', findings: [] };
  const highest = all.sort((a, b) => (b.risk || 0) - (a.risk || 0))[0];
  const stackedRisk = clampRisk((highest.risk || 0) + Math.min(15, Math.max(0, all.length - 1) * 4));
  return {
    risk: stackedRisk,
    category: highest.category,
    reason: highest.reason,
    findings: all
  };
}

async function sendLog(guild, payload) {
  const config = getGuildConfig(guild.id);
  if (!config.modules?.reports || !config.logChannelId) return;
  const channel = guild.channels.cache.get(config.logChannelId) ||
    await guild.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel?.send) return;

  const lines = [
    `Usuário: ${payload.userId ? `<@${payload.userId}>` : '`desconhecido`'}`,
    `Canal: ${payload.channelId ? `<#${payload.channelId}>` : '`sem canal`'}`,
    `Risco: **${payload.risk}/100** · **${payload.severity}**`,
    `Categoria: **${payload.category}**`,
    `Ação: **${payload.action}**`,
    '',
    `Motivo: ${payload.reason}`,
    payload.content ? `Mensagem: \`${payload.content.slice(0, 350).replace(/`/g, "'")}\`` : '',
    '',
    '-# O Mineiro Security registra o motivo, o risco e a ação para revisão administrativa.'
  ].filter(Boolean);

  await channel.send({
    components: [createTextContainer('Mineiro Security · Evento', lines.join('\n'))],
    flags: IS_COMPONENTS_V2
  }).catch(() => {});
}

async function warnUser(message, payload) {
  const text = [
    `<@${message.author.id}> sua mensagem foi sinalizada pelo Mineiro Security.`,
    `-# Motivo: ${payload.reason}. Se acredita que houve engano, abra um ticket ou fale com o suporte.`
  ].join('\n');
  await message.channel.send({
    content: text,
    allowedMentions: { users: [message.author.id], roles: [] }
  }).catch(() => {});
}

async function applyAction(message, action, payload, config) {
  const member = message.member;
  const me = message.guild.members.me;
  if (action === 'ignore' || action === 'log') return action;

  if (['delete', 'warn', 'timeout', 'kick', 'ban'].includes(action)) {
    await message.delete().catch(() => {});
  }
  if (action === 'delete') return 'delete';
  if (action === 'warn') {
    await warnUser(message, payload);
    return 'warn';
  }
  if (action === 'timeout') {
    if (!me.permissions.has(PermissionFlagsBits.ModerateMembers) || !member.moderatable) {
      await warnUser(message, { ...payload, reason: `${payload.reason} (não consegui silenciar)` });
      return 'warn_failed_timeout';
    }
    const minutes = payload.severity === 'high'
      ? config.timeouts?.highMinutes || 60
      : config.timeouts?.mediumMinutes || 10;
    await member.timeout(minutes * 60 * 1000, `Mineiro Security: ${payload.reason}`).catch(() => null);
    await warnUser(message, payload);
    return `timeout_${minutes}m`;
  }
  if (action === 'kick') {
    if (!me.permissions.has(PermissionFlagsBits.KickMembers) || !member.kickable) return 'kick_failed';
    await member.kick(`Mineiro Security: ${payload.reason}`).catch(() => null);
    return 'kick';
  }
  if (action === 'ban') {
    if (!me.permissions.has(PermissionFlagsBits.BanMembers) || !member.bannable) return 'ban_failed';
    await member.ban({
      reason: `Mineiro Security: ${payload.reason}`,
      deleteMessageSeconds: 3600
    }).catch(() => null);
    return 'ban';
  }
  return 'log';
}

async function analyzeMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const config = getGuildConfig(message.guild.id);
  if (!config.enabled || isBypassed(message.member, config)) return false;

  try {
    const localFindings = config.modules?.messageAnalysis ? analyzeLocalMessage(message, config) : [];
    const imageResults = config.modules?.imageAnalysis
      ? await scanMessageImages(message, config)
      : [];
    let aiResult = null;
    if (config.modules?.aiModeration && config.ai?.enabled && message.content?.trim()) {
      aiResult = await analyzeTextWithAI(message.content, '', config).catch((error) => {
        logError('ai-analysis', error, `guild=${message.guild.id}`);
        return null;
      });
    }
    const combined = combineFindings(localFindings, aiResult, imageResults);
    const sensitivity = Number(config.sensitivity) || 65;
    if (combined.risk < Math.max(15, sensitivity - 35)) return false;

    const severity = severityFromRisk(combined.risk);
    let action = actionForSeverity(severity, config);
    if (!config.modules?.autoPunishment && action !== 'log') action = 'log';
    if (combined.risk < sensitivity && action !== 'log') action = 'log';
    const reputation = config.modules?.reputation
      ? updateReputation(message.guild.id, message.author.id, combined.risk, combined.reason)
      : null;

    const payload = {
      guildId: message.guild.id,
      channelId: message.channel.id,
      messageId: message.id,
      userId: message.author.id,
      type: 'message_risk',
      category: combined.category,
      reason: combined.reason,
      risk: combined.risk,
      severity,
      action,
      reputationScore: reputation?.score,
      content: message.content || '[sem texto]'
    };
    const appliedAction = await applyAction(message, action, payload, config);
    payload.action = appliedAction;
    recordEvent(payload);
    await sendLog(message.guild, payload);
    return appliedAction !== 'log';
  } catch (error) {
    logError('message-analysis', error, `guild=${message.guild.id} message=${message.id}`);
    return false;
  }
}

async function trackMemberJoin(member) {
  const config = getGuildConfig(member.guild.id);
  if (!config.enabled || !config.modules?.raidProtection) return;
  const data = loadSecurityData();
  const key = member.guild.id;
  const now = Date.now();
  const windowMs = (config.raid?.joinWindowSeconds || 60) * 1000;
  const joins = (data.joinWindows[key] || []).filter((entry) => now - entry.at <= windowMs);
  joins.push({ at: now, userId: member.id });
  data.joinWindows[key] = joins;

  const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
  if (accountAgeDays < (config.raid?.newAccountDays || 7)) {
    recordEvent({
      guildId: member.guild.id,
      userId: member.id,
      type: 'new_account_join',
      category: 'raid_watch',
      reason: `Conta criada há ${accountAgeDays.toFixed(1)} dia(s)`,
      risk: 38,
      severity: 'low',
      action: 'log'
    });
  }

  if (joins.length >= (config.raid?.joinThreshold || 8)) {
    const payload = {
      guildId: member.guild.id,
      userId: member.id,
      type: 'raid_risk',
      category: 'raid',
      reason: `${joins.length} entradas em ${config.raid.joinWindowSeconds || 60}s`,
      risk: 88,
      severity: 'high',
      action: 'alert'
    };
    recordEvent(payload);
    await sendLog(member.guild, payload);
  }
  saveSecurityData();
}

module.exports = {
  analyzeMessage,
  sendLog,
  trackMemberJoin
};
