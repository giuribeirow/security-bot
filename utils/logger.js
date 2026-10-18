const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');

function appendLog(name, line) {
  fs.mkdirSync(logDir, { recursive: true });
  const date = new Date().toISOString();
  fs.appendFileSync(path.join(logDir, `${name}.log`), `[${date}] ${line}\n`);
}

function logError(scope, error, context = '') {
  const message = `${scope}${context ? ` ${context}` : ''} :: ${error?.stack || error?.message || error}`;
  appendLog('errors', message);
  console.error(`[${scope}]`, error);
}

module.exports = {
  appendLog,
  logError
};
