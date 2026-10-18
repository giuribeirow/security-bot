const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { IS_COMPONENTS_V2 } = require('../utils/componentsV2');
const { buildVanguardPanel } = require('../utils/panelBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mineiro')
    .setDescription('Painel administrativo do Mineiro Security')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('painel')
        .setDescription('Abre o painel de controle do Mineiro Security')
    ),

  async execute(interaction) {
    await interaction.reply({
      components: [buildMineiroPanel(interaction.guild, 'overview')],
      flags: IS_COMPONENTS_V2 | 64
    });
  }
};
