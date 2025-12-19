const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "data", "plants.json");

function ensureDir() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadPlants() {
  ensureDir();
  if (!fs.existsSync(FILE)) {
    return { plants: [] };
  }
  const raw = fs.readFileSync(FILE, "utf8");
  const obj = JSON.parse(raw);
  if (!obj || !Array.isArray(obj.plants)) return { plants: [] };
  return obj;
}

function savePlants(obj) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2), "utf8");
}

module.exports = { FILE, loadPlants, savePlants };
