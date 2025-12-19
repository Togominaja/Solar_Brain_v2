const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "optouts.json");

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ optouts: [] }, null, 2), "utf8");
}

function readAll() {
  ensureFile();
  const raw = fs.readFileSync(FILE, "utf8");
  const obj = JSON.parse(raw);
  if (!obj || !Array.isArray(obj.optouts)) return { optouts: [] };
  return obj;
}

function writeAll(obj) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2), "utf8");
}

function normalizePhone(p) {
  return String(p || "").replace(/[^\d]/g, "");
}

function isOptedOut(phone) {
  const n = normalizePhone(phone);
  if (!n) return false;
  const { optouts } = readAll();
  return optouts.includes(n);
}

function optOut(phone) {
  const n = normalizePhone(phone);
  if (!n) return false;
  const obj = readAll();
  if (!obj.optouts.includes(n)) {
    obj.optouts.push(n);
    writeAll(obj);
  }
  return true;
}

function optIn(phone) {
  const n = normalizePhone(phone);
  if (!n) return false;
  const obj = readAll();
  obj.optouts = obj.optouts.filter((x) => x !== n);
  writeAll(obj);
  return true;
}

module.exports = { isOptedOut, optOut, optIn, normalizePhone };
