require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((name) => name.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;
  if (!token || !clientId) {
    throw new Error('Configure DISCORD_TOKEN e CLIENT_ID no .env.');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Comandos registrados no servidor ${guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Comandos globais registrados.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
