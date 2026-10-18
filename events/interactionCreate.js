const {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { IS_COMPONENTS_V2 } = require('../utils/componentsV2');
const { getGuildConfig, updateGuildConfig } = require('../utils/configManager');
const { buildVanguardPanel } = require('../utils/panelBuilder');
const { logError } = require('../utils/logger');

function canUsePanel(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

async function refreshPanel(interaction, page) {
  const payload = {
    components: [buildVanguardPanel(interaction.guild, page)],
    flags: IS_COMPONENTS_V2
  };
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload).catch(() => {});
  }
  if (interaction.isMessageComponent()) return interaction.update(payload);
  return interaction.reply({ ...payload, flags: IS_COMPONENTS_V2 | 64 });
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction, client);
        return;
      }

      if (!interaction.guild || !interaction.customId?.startsWith('vg_')) return;
      if (!canUsePanel(interaction)) {
        await interaction.reply({ content: 'Apenas administradores podem usar o painel do Vanguard Security.', flags: 64 });
        return;
      }

      const [scope, part, extra] = interaction.customId.split(':');
      if (scope === 'vg_page') {
        await refreshPanel(interaction, part);
        return;
      }
      if (scope === 'vg_refresh') {
        await refreshPanel(interaction, part || 'overview');
        return;
      }
      if (scope === 'vg_toggle') {
        updateGuildConfig(interaction.guild.id, (config) => {
          if (part === 'enabled') config.enabled = !config.enabled;
          else config.modules[part] = !config.modules[part];
          return config;
        });
        await refreshPanel(interaction, part === 'enabled' ? 'modules' : 'modules');
        return;
      }
      if (scope === 'vg_sensitivity') {
        updateGuildConfig(interaction.guild.id, (config) => {
          const delta = part === 'up' ? 5 : -5;
          config.sensitivity = Math.max(20, Math.min(95, Number(config.sensitivity || 65) + delta));
          return config;
        });
        await refreshPanel(interaction, 'modules');
        return;
      }
      if (scope === 'vg_action') {
        updateGuildConfig(interaction.guild.id, (config) => {
          config.actions[part] = extra;
          return config;
        });
        await refreshPanel(interaction, 'actions');
        return;
      }
      if (scope === 'vg_toggle_link') {
        updateGuildConfig(interaction.guild.id, (config) => {
          config.linkPolicy[part] = !config.linkPolicy[part];
          return config;
        });
        await refreshPanel(interaction, 'links');
        return;
      }
      if (scope === 'vg_toggle_image') {
        updateGuildConfig(interaction.guild.id, (config) => {
          config.image[part] = !config.image[part];
          return config;
        });
        await refreshPanel(interaction, 'raid');
        return;
      }
      if (scope === 'vg_toggle_ai') {
        updateGuildConfig(interaction.guild.id, (config) => {
          config.ai[part] = !config.ai[part];
          return config;
        });
        await refreshPanel(interaction, 'ai');
        return;
      }
      if (scope === 'vg_ai_conf') {
        updateGuildConfig(interaction.guild.id, (config) => {
          const delta = part === 'up' ? 0.03 : -0.03;
          config.ai.minConfidence = Math.max(0.5, Math.min(0.98, Number(config.ai.minConfidence || 0.82) + delta));
          return config;
        });
        await refreshPanel(interaction, 'ai');
        return;
      }
      if (scope === 'vg_select' && part === 'blocked_link_channels') {
        updateGuildConfig(interaction.guild.id, (config) => {
          config.linkPolicy.blockedChannels = interaction.values;
          return config;
        });
        await refreshPanel(interaction, 'links');
        return;
      }
      if (scope === 'vg_modal' && part === 'allowed_domains' && interaction.isButton()) {
        const config = getGuildConfig(interaction.guild.id);
        const modal = new ModalBuilder()
          .setCustomId('vg_domains_modal')
          .setTitle('Domínios permitidos');
        const input = new TextInputBuilder()
          .setCustomId('domains')
          .setLabel('Um domínio por linha')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000)
          .setValue((config.linkPolicy.allowedDomains || []).join('\n'));
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      if (interaction.isModalSubmit() && interaction.customId === 'vg_domains_modal') {
        const domains = interaction.fields.getTextInputValue('domains')
          .split(/\r?\n|,/)
          .map((domain) => domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
          .filter(Boolean)
          .slice(0, 50);
        updateGuildConfig(interaction.guild.id, (config) => {
          config.linkPolicy.allowedDomains = [...new Set(domains)];
          return config;
        });
        await interaction.reply({
          components: [buildVanguardPanel(interaction.guild, 'links')],
          flags: IS_COMPONENTS_V2 | 64
        });
      }
    } catch (error) {
      logError('interaction', error, interaction.customId || interaction.commandName || '');
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Não consegui concluir essa ação do painel.', flags: 64 }).catch(() => {});
      }
    }
  }
};
