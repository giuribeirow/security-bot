require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials
} = require('discord.js');
const { flushSecurityData } = require('./utils/securityData');
const { logError } = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((name) => name.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter((name) => name.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

client.on('error', (error) => logError('client-error', error));
client.on('warn', (warning) => logError('client-warn', warning));
process.on('unhandledRejection', (error) => logError('unhandled-rejection', error));
process.on('uncaughtException', (error) => logError('uncaught-exception', error));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    flushSecurityData();
    process.exit(0);
  });
}

if (!process.env.DISCORD_TOKEN) {
  console.error('Configure o DISCORD_TOKEN no .env antes de iniciar o Vanguard Security.');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
