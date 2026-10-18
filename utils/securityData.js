const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const dataPath = path.join(__dirname, '..', 'data', 'securityData.json');
const fallback = {
  events: [],
  reputation: {},
  messageWindows: {},
  joinWindows: {}
};
let cache = null;
let writeTimer = null;

function loadSecurityData() {
  if (!cache) cache = readJson(dataPath, fallback);
  cache.events ||= [];
  cache.reputation ||= {};
  cache.messageWindows ||= {};
  cache.joinWindows ||= {};
  return cache;
}

function saveSecurityData(delay = 750) {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeJson(dataPath, cache || fallback);
  }, delay);
}

function flushSecurityData() {
  clearTimeout(writeTimer);
  writeJson(dataPath, cache || fallback);
}

function recordEvent(event) {
  const data = loadSecurityData();
  data.events.push({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: Math.floor(Date.now() / 1000),
    ...event
  });
  data.events = data.events.slice(-5000);
  saveSecurityData();
}

module.exports = {
  flushSecurityData,
  loadSecurityData,
  recordEvent,
  saveSecurityData
};
