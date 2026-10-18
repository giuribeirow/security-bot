const fs = require('fs');
const path = require('path');

function ensureFile(filePath, fallback) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJson(filePath, fallback) {
  ensureFile(filePath, fallback);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const backupPath = `${filePath}.bak`;
    if (fs.existsSync(backupPath)) {
      return JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    }
    return structuredClone(fallback);
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

module.exports = {
  readJson,
  writeJson
};
