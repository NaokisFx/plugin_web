const axios = require('axios');

const BASE_URL = process.env.PAYPAL_ENV === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

let cachedToken = null;
let cachedTokenExpiry = 0;

/**
 * Obtiene un access token OAuth2 de PayPal (client_credentials), con cache
 * en memoria hasta que expire para no pedir uno nuevo en cada request.
 */
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) {
    return cachedToken;
  }

  const res = await axios.post(
    `${BASE_URL}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );

  cachedToken = res.data.access_token;
  // Restamos 60s de margen de seguridad antes de que expire de verdad
  cachedTokenExpiry = now + (res.data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * Verifica que un evento de webhook realmente viene de PayPal y no ha sido
 * falsificado. Esto es OBLIGATORIO: nunca proceses un webhook sin verificar,
 * o cualquiera podria simular una "compra" y auto-entregarse rangos gratis.
 */
async function verifyWebhookSignature(headers, rawBodyParsed) {
  const token = await getAccessToken();

  const payload = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: rawBodyParsed
  };

  const res = await axios.post(
    `${BASE_URL}/v1/notifications/verify-webhook-signature`,
    payload,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  return res.data.verification_status === 'SUCCESS';
}

module.exports = { verifyWebhookSignature };
