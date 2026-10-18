const { trackMemberJoin } = require('../utils/securityEngine');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    await trackMemberJoin(member);
  }
};
