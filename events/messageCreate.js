const { analyzeMessage } = require('../utils/securityEngine');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    await analyzeMessage(message);
  }
};
