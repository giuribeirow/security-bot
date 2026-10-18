module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[Mineiro Security] Online como ${client.user.tag}.`);
  }
};
