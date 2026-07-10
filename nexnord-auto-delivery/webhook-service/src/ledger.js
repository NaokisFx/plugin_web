const fs = require('fs');
const path = require('path');

const FILE = process.env.LEDGER_FILE || './data/ledger.json';

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

/** true si esta transaccion de PayPal ya fue entregada antes */
function alreadyProcessed(transactionId) {
  return load().some((entry) => entry.transactionId === transactionId);
}

function markProcessed(entry) {
  const list = load();
  list.push({ ...entry, processedAt: new Date().toISOString() });
  save(list);
}

module.exports = { alreadyProcessed, markProcessed };
