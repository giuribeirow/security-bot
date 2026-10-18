const { ChannelType } = require('discord.js');
const { COMPONENT_TYPES, button, container, row, separator, text } = require('./componentsV2');
const { getGuildConfig } = require('./configManager');
const { loadSecurityData } = require('./securityData');

const PAGES = ['overview', 'modules', 'links', 'actions', 'reputation', 'raid', 'ai'];

const MODULE_LABELS = {
  messageAnalysis: 'Mensagens',
  aiModeration: 'IA',
  imageAnalysis: 'Imagens',
  maliciousLinks: 'Links',
  raidProtection: 'Anti-raid',
  autoPunishment: 'Punição automática',
  reports: 'Relatórios',
  reputation: 'Reputação'
};

function status(value) {
  return value ? 'ON' : 'OFF';
}

function pageButton(page, active, label) {
  return button(`vg_page:${page}`, label, active === page ? 1 : 2, active === page);
}

function navRows(active) {
  return [
    row([
      pageButton('overview', active, 'Visão geral'),
      pageButton('modules', active, 'Módulos'),
      pageButton('links', active, 'Links'),
      pageButton('actions', active, 'Punições')
    ]),
    row([
      pageButton('reputation', active, 'Reputação'),
      pageButton('raid', active, 'Raid/Imagem'),
      pageButton('ai', active, 'IA'),
      button(`vg_refresh:${active}`, 'Atualizar', 2)
    ])
  ];
}

function recentEvents(guildId, limit = 5) {
  return loadSecurityData().events
    .filter((event) => event.guildId === guildId)
    .slice(-limit)
    .reverse();
}

function healthScore(guildId) {
  const events = recentEvents(guildId, 100);
  let score = 100;
  for (const event of events) {
    if (event.severity === 'critical') score -= 8;
    else if (event.severity === 'high') score -= 4;
    else if (event.severity === 'medium') score -= 2;
    else score -= 0.5;
  }
  score = Math.max(0, Math.round(score));
  const label = score >= 90 ? 'Excelente' : score >= 75 ? 'Estável' : score >= 55 ? 'Atenção' : 'Crítico';
  const color = score >= 90 ? '🟢' : score >= 75 ? '🟡' : score >= 55 ? '🟠' : '🔴';
  return { score, label, color, events };
}

function overview(guild, config) {
  const health = healthScore(guild.id);
  const critical24h = health.events.filter((event) =>
    event.severity === 'critical' && Date.now() / 1000 - event.at <= 86400
  ).length;
  const links = health.events.filter((event) => String(event.category).includes('link') || ['phishing', 'invite', 'malware'].includes(event.category)).length;
  const raid = health.events.filter((event) => event.type === 'raid_risk').length;
  const latest = health.events.length
    ? health.events.slice(0, 5).map((event) =>
      `• <t:${event.at}:R> · **${event.severity}** · ${event.category} · ${event.userId ? `<@${event.userId}>` : 'sistema'}`
    ).join('\n')
    : 'Nenhum evento recente.';

  return [
    text([
      '## Mineiro Security · Visão Geral',
      `### Saúde: ${health.score}/100 ${health.color} ${health.label}`,
      '',
      `• Eventos recentes monitorados: **${health.events.length}**`,
      `• Links ou phishing detectados: **${links}**`,
      `• Alertas de raid: **${raid}**`,
      `• Eventos críticos nas últimas 24h: **${critical24h}**`,
      `• Canal de logs: ${config.logChannelId ? `<#${config.logChannelId}>` : '`não configurado`'}`,
      '',
      '-# O Mineiro acompanha mensagens, links, imagens, reputação e comportamento em tempo real.'
    ].join('\n')),
    separator(),
    text(`### Últimos eventos\n${latest}`)
  ];
}

function modules(config) {
  const entries = Object.entries(MODULE_LABELS);
  const rows = [];
  for (let i = 0; i < entries.length; i += 4) {
    rows.push(row(entries.slice(i, i + 4).map(([key, label]) =>
      button(`vg_toggle:${key}`, `${status(config.modules[key])} · ${label}`, config.modules[key] ? 3 : 4)
    )));
  }
  return [
    text([
      '## Mineiro Security · Módulos',
      `Sistema principal: **${status(config.enabled)}**`,
      `Sensibilidade: **${config.sensitivity}/100**`,
      '',
      '-# Desative módulos individuais sem apagar dados, reputação ou histórico.'
    ].join('\n')),
    row([
      button('vg_toggle:enabled', `${status(config.enabled)} · Mineiro`, config.enabled ? 3 : 4),
      button('vg_sensitivity:down', '- Sensibilidade', 2),
      button('vg_sensitivity:up', '+ Sensibilidade', 2)
    ]),
    separator(),
    ...rows
  ];
}

function links(config) {
  const blockedChannels = config.linkPolicy.blockedChannels?.length
    ? config.linkPolicy.blockedChannels.map((id) => `<#${id}>`).join(', ')
    : '`todos os canais monitorados`';
  const allowedDomains = config.linkPolicy.allowedDomains?.length
    ? config.linkPolicy.allowedDomains.map((domain) => `\`${domain}\``).join(', ')
    : '`nenhum domínio liberado`';
  return [
    text([
      '## Mineiro Security · Anti-link Malicioso',
      `• Canais com bloqueio específico: ${blockedChannels}`,
      `• Domínios permitidos: ${allowedDomains}`,
      `• Bloquear convites: **${status(config.linkPolicy.blockInvites)}**`,
      `• Bloquear encurtadores: **${status(config.linkPolicy.blockShorteners)}**`,
      `• Bloquear downloads: **${status(config.linkPolicy.blockDownloads)}**`,
      '',
      '-# Se nenhum canal for escolhido, o scanner vale para o servidor inteiro.'
    ].join('\n')),
    row([
      {
        type: COMPONENT_TYPES.CHANNEL_SELECT,
        custom_id: 'vg_select:blocked_link_channels',
        placeholder: 'Canais onde links devem ser bloqueados',
        min_values: 0,
        max_values: 10,
        channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement]
      }
    ]),
    row([
      button('vg_toggle_link:blockInvites', `${status(config.linkPolicy.blockInvites)} · Convites`, config.linkPolicy.blockInvites ? 3 : 4),
      button('vg_toggle_link:blockShorteners', `${status(config.linkPolicy.blockShorteners)} · Encurtadores`, config.linkPolicy.blockShorteners ? 3 : 4),
      button('vg_toggle_link:blockDownloads', `${status(config.linkPolicy.blockDownloads)} · Downloads`, config.linkPolicy.blockDownloads ? 3 : 4),
      button('vg_modal:allowed_domains', 'Domínios permitidos', 2)
    ])
  ];
}

function actions(config) {
  const labels = ['low', 'medium', 'high', 'critical'];
  return [
    text([
      '## Mineiro Security · Níveis de Punição',
      `• Baixo: **${config.actions.low}**`,
      `• Médio: **${config.actions.medium}**`,
      `• Alto: **${config.actions.high}**`,
      `• Crítico: **${config.actions.critical}**`,
      '',
      `Timeout médio: **${config.timeouts.mediumMinutes} min**`,
      `Timeout alto: **${config.timeouts.highMinutes} min**`,
      '',
      '-# Use ações leves para reduzir falso positivo e deixe ban apenas para risco crítico.'
    ].join('\n')),
    ...labels.map((level) => row([
      button(`vg_action:${level}:log`, `${level}: log`, config.actions[level] === 'log' ? 1 : 2),
      button(`vg_action:${level}:delete`, 'delete', config.actions[level] === 'delete' ? 1 : 2),
      button(`vg_action:${level}:warn`, 'warn', config.actions[level] === 'warn' ? 1 : 2),
      button(`vg_action:${level}:timeout`, 'timeout', config.actions[level] === 'timeout' ? 1 : 2),
      button(`vg_action:${level}:ban`, 'ban', config.actions[level] === 'ban' ? 1 : 2)
    ]))
  ];
}

function reputation(guild) {
  const data = loadSecurityData();
  const records = Object.values(data.reputation)
    .filter((record) => record.guildId === guild.id)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);
  const lines = records.length
    ? records.map((record) =>
      `• <@${record.userId}> · confiança **${record.score}/100** · strikes **${record.strikes}**`
    ).join('\n')
    : 'Ainda não há histórico de reputação.';
  return [
    text([
      '## Mineiro Security · Sistema de Reputação',
      lines,
      '',
      '-# Usuários com bom histórico tendem a gerar menos ações duras em versões futuras do motor.'
    ].join('\n'))
  ];
}

function raid(config) {
  return [
    text([
      '## Mineiro Security · Raid e Imagens',
      `• Anti-raid: **${status(config.modules.raidProtection)}**`,
      `• Janela de entrada: **${config.raid.joinWindowSeconds}s**`,
      `• Limite de entradas: **${config.raid.joinThreshold}**`,
      `• Conta nova: **${config.raid.newAccountDays} dias**`,
      '',
      `• Análise de imagens: **${status(config.modules.imageAnalysis)}**`,
      `• Detectar QR code: **${status(config.image.detectQrCodes)}**`,
      `• Sinalizar imagem de conta nova: **${status(config.image.flagNewAccountsWithImages)}**`,
      '',
      '-# O scanner de imagem detecta QR codes e padrões de risco; IA visual pode ser adicionada depois.'
    ].join('\n')),
    row([
      button('vg_toggle:imageAnalysis', `${status(config.modules.imageAnalysis)} · Imagens`, config.modules.imageAnalysis ? 3 : 4),
      button('vg_toggle_image:detectQrCodes', `${status(config.image.detectQrCodes)} · QR Code`, config.image.detectQrCodes ? 3 : 4),
      button('vg_toggle_image:flagNewAccountsWithImages', `${status(config.image.flagNewAccountsWithImages)} · Conta nova`, config.image.flagNewAccountsWithImages ? 3 : 4)
    ])
  ];
}

function ai(config) {
  return [
    text([
      '## Mineiro Security · IA de Moderação',
      `• Módulo IA: **${status(config.modules.aiModeration)}**`,
      `• IA configurada: **${status(config.ai.enabled)}**`,
      `• Modo: **${config.ai.mode}**`,
      `• Confiança mínima: **${Math.round((config.ai.minConfidence || 0.82) * 100)}%**`,
      '',
      '-# A IA analisa contexto. As heurísticas locais continuam ativas mesmo com IA desligada.'
    ].join('\n')),
    row([
      button('vg_toggle:aiModeration', `${status(config.modules.aiModeration)} · Módulo IA`, config.modules.aiModeration ? 3 : 4),
      button('vg_toggle_ai:enabled', `${status(config.ai.enabled)} · Usar API`, config.ai.enabled ? 3 : 4),
      button('vg_ai_conf:down', '- Confiança', 2),
      button('vg_ai_conf:up', '+ Confiança', 2)
    ])
  ];
}

function buildMineiroPanel(guild, page = 'overview') {
  const active = PAGES.includes(page) ? page : 'overview';
  const config = getGuildConfig(guild.id);
  let body;
  if (active === 'modules') body = modules(config);
  else if (active === 'links') body = links(config);
  else if (active === 'actions') body = actions(config);
  else if (active === 'reputation') body = reputation(guild);
  else if (active === 'raid') body = raid(config);
  else if (active === 'ai') body = ai(config);
  else body = overview(guild, config);

  return container([
    ...body,
    separator(),
    ...navRows(active),
    text(`-# Mineiro Security · ${guild.name} · Página ${active}`)
  ]);
}

module.exports = {
  buildMineiroPanel
};
