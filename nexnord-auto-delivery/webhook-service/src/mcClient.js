const axios = require('axios');

// Nick de Minecraft: 3 a 16 caracteres, solo letras/numeros/guion bajo.
// Rechazamos cualquier otra cosa para que nunca llegue texto raro al servidor.
const NICK_REGEX = /^[A-Za-z0-9_]{3,16}$/;

function isValidNick(nick) {
  return typeof nick === 'string' && NICK_REGEX.test(nick);
}

/**
 * Pide al plugin de Minecraft que entregue un producto a un jugador.
 * productId debe coincidir con una clave de "products" en config.yml del plugin.
 */
async function deliver({ player, productId, transactionId }) {
  if (!isValidNick(player)) {
    throw new Error(`Nick invalido, no se entrega: "${player}"`);
  }

  const res = await axios.post(
    process.env.MC_DELIVERY_URL,
    { player, productId, transactionId },
    {
      headers: {
        Authorization: `Bearer ${process.env.MC_DELIVERY_SECRET}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    }
  );

  return res.data;
}

module.exports = { deliver, isValidNick };
