require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const { verifyWebhookSignature } = require('./paypal');
const { alreadyProcessed, markProcessed } = require('./ledger');
const { deliver } = require('./mcClient');
const { logToDiscord } = require('./discordLog');

const products = require('../products.json');

const app = express();

// Guardamos el body "crudo" (sin parsear) porque PayPal firma exactamente
// esos bytes. Si Express lo re-serializa distinto, la verificacion falla.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

const EVENTS_HANDLED = new Set([
  'PAYMENT.CAPTURE.COMPLETED',
  'CHECKOUT.ORDER.APPROVED'
]);

/** Intenta encontrar la nota que el comprador escribio al pagar, probando
 *  varios campos posibles porque el nombre exacto puede variar segun el
 *  tipo de Payment Link. Si no aparece en ninguno, devuelve null y el
 *  administrador debera revisar el payload guardado en /data/raw-events. */
function extractBuyerNote(resource) {
  return (
    resource?.note_to_payer ||
    resource?.supplementary_data?.note_to_payer ||
    resource?.custom_id ||
    resource?.purchase_units?.[0]?.custom_id ||
    resource?.purchase_units?.[0]?.description ||
    null
  );
}

function extractAmount(resource) {
  return (
    resource?.amount?.value ||
    resource?.purchase_units?.[0]?.amount?.value ||
    resource?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ||
    null
  );
}

function extractItemName(resource) {
  return (
    resource?.purchase_units?.[0]?.items?.[0]?.name ||
    resource?.purchase_units?.[0]?.description ||
    null
  );
}

/** Decide que producto corresponde segun el nombre del item / descripcion */
function matchProduct(itemName) {
  if (!itemName) return null;
  const lower = itemName.toLowerCase();
  for (const [productId, def] of Object.entries(products)) {
    if (productId === '_comment') continue;
    if (def.match.some((keyword) => lower.includes(keyword))) {
      return productId;
    }
  }
  return null;
}

function saveRawEventForDebug(event) {
  const dir = path.join(__dirname, '..', 'data', 'raw-events');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${event.id || Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(event, null, 2));
}

app.post('/webhooks/paypal', async (req, res) => {
  // Respondemos rapido 200 para que PayPal no reintente de mas; el trabajo
  // pesado sigue despues. Igual devolvemos error si la firma no es valida.
  const event = req.body;

  try {
    const valid = await verifyWebhookSignature(req.headers, event);
    if (!valid) {
      console.warn('Firma de webhook invalida, evento ignorado.');
      return res.status(400).send('invalid signature');
    }
  } catch (e) {
    console.error('Error verificando firma de PayPal:', e.message);
    return res.status(500).send('verification error');
  }

  res.status(200).send('ok'); // ya podemos responder a PayPal

  if (!EVENTS_HANDLED.has(event.event_type)) return;

  // Guardamos siempre el payload crudo. Util para calibrar extractBuyerNote()
  // la primera vez que llegue una compra real o de prueba.
  saveRawEventForDebug(event);

  const resource = event.resource;
  const transactionId =
    resource?.id || resource?.purchase_units?.[0]?.payments?.captures?.[0]?.id;

  if (alreadyProcessed(transactionId)) {
    console.log(`Transaccion ${transactionId} ya fue entregada antes, se ignora.`);
    return;
  }

  const itemName = extractItemName(resource);
  const amount = extractAmount(resource);
  const buyerNote = extractBuyerNote(resource);
  const productId = matchProduct(itemName);

  if (!productId) {
    console.error(
      `No se pudo identificar el producto para la transaccion ${transactionId}. ` +
      `itemName="${itemName}". Revisa data/raw-events/${event.id}.json`
    );
    await logToDiscord(
      `⚠️ Compra recibida ($${amount}) pero no se identifico el producto. Revisar manualmente. TX: ${transactionId}`
    );
    return;
  }

  if (!buyerNote) {
    console.error(
      `No se encontro el nick de Minecraft en la transaccion ${transactionId}. ` +
      `Revisa data/raw-events/${event.id}.json y avisa al comprador por Discord.`
    );
    await logToDiscord(
      `⚠️ Compra de "${products[productId].label}" recibida pero sin nick de Minecraft legible. TX: ${transactionId}. Entregar manualmente.`
    );
    return;
  }

  const player = buyerNote.trim();

  try {
    await deliver({ player, productId, transactionId });
    markProcessed({ transactionId, player, productId, amount });
    console.log(`Entregado "${productId}" a ${player} (TX ${transactionId})`);
    await logToDiscord(
      `✅ **${products[productId].label}** entregado automaticamente a **${player}** — $${amount} — TX \`${transactionId}\``
    );
  } catch (e) {
    console.error(`Fallo la entrega a "${player}":`, e.message);
    await logToDiscord(
      `❌ Fallo la entrega automatica de **${products[productId]?.label || productId}** a **${player}**. Revisar manualmente. TX: ${transactionId}. Error: ${e.message}`
    );
  }
});

app.get('/health', (_req, res) => res.send('nexnord-webhook ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NexNord webhook service escuchando en puerto ${PORT}`);
});
