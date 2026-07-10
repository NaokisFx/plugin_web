const fs = require('fs');
const path = require('path');

const FILE = process.env.CLAIMS_FILE || './data/claims.json';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas: tiempo maximo que esperamos a que llegue el pago

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]');
}

function load() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function save(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

/** Guarda un claim pendiente: alguien llenó el formulario en la web y esta a punto de pagar */
function startClaim({ nick, email, productId }) {
  const list = load();
  list.push({
    nick,
    email: email.trim().toLowerCase(),
    productId,
    createdAt: Date.now(),
    consumed: false
  });
  save(list);
}

/** Busca el claim pendiente mas reciente que coincida con el correo y el producto comprado */
function findAndConsumeClaim({ email, productId }) {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const list = load();

  const now = Date.now();
  const candidates = list
    .filter(
      (c) =>
        !c.consumed &&
        c.email === normalizedEmail &&
        c.productId === productId &&
        now - c.createdAt < MAX_AGE_MS
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  if (candidates.length === 0) return null;

  const match = candidates[0];
  match.consumed = true;
  save(list);
  return match;
}

module.exports = { startClaim, findAndConsumeClaim };
