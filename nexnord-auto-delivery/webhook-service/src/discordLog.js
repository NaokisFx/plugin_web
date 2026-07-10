const axios = require('axios');

async function logToDiscord(message) {
  const url = process.env.DISCORD_LOG_WEBHOOK_URL;
  if (!url) return; // opcional: si no se configura, simplemente no hace nada

  try {
    await axios.post(url, { content: message });
  } catch (e) {
    console.error('No se pudo enviar el log a Discord:', e.message);
  }
}

module.exports = { logToDiscord };
