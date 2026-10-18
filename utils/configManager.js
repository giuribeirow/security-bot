const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const root = path.join(__dirname, '..');
const baseConfigPath = path.join(root, 'config.json');
const guildConfigPath = path.join(root, 'data', 'guilds.json');

let baseCache = null;
let guildCache = null;

function mergeDeep(base, override) {
  if (!override || typeof override !== 'object') return structuredClone(base);
  const output = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base?.[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      output[key] = mergeDeep(base[key], value);
    } else {
      output[key] = Array.isArray(value) ? [...value] : value;
    }
  }
  return output;
}

function loadBaseConfig() {
  if (!baseCache) baseCache = readJson(baseConfigPath, { defaults: {} });
  return baseCache;
}

function loadGuildConfigs() {
  if (!guildCache) guildCache = readJson(guildConfigPath, {});
  return guildCache;
}

function defaultGuildConfig() {
  return structuredClone(loadBaseConfig().defaults);
}

function getGuildConfig(guildId) {
  const configs = loadGuildConfigs();
  if (!configs[guildId]) {
    configs[guildId] = defaultGuildConfig();
    saveGuildConfigs();
  }
  return mergeDeep(defaultGuildConfig(), configs[guildId]);
}

function updateGuildConfig(guildId, updater) {
  const configs = loadGuildConfigs();
  const current = mergeDeep(defaultGuildConfig(), configs[guildId] || {});
  const updated = updater(current) || current;
  configs[guildId] = updated;
  saveGuildConfigs();
  return updated;
}

function saveGuildConfigs() {
  writeJson(guildConfigPath, guildCache || {});
}

function reloadConfig() {
  baseCache = null;
  guildCache = null;
}

module.exports = {
  getGuildConfig,
  loadBaseConfig,
  reloadConfig,
  updateGuildConfig
};
