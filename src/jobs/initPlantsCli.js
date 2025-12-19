require("dotenv").config();

const { loadEnv } = require("../config/env");
const { createGrowattClient } = require("../growatt/client");
const { savePlants, FILE } = require("../config/plantsStore");

function sanitizeName(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function pickArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (maybe && Array.isArray(maybe.list)) return maybe.list;
  if (maybe && Array.isArray(maybe.plants)) return maybe.plants;
  return [];
}

(async () => {
  const cfg = loadEnv();
  const growatt = createGrowattClient(cfg);

  const data = await growatt.listPlants();
  const plants = pickArray(data);

  const out = {
    plants: plants.map((p) => ({
      plantId: String(p.plant_id ?? p.id ?? p.plantId ?? ""),
      plantName: sanitizeName(p.plant_name ?? p.name ?? p.plantName ?? ""),
      // what shows in WhatsApp
      clientName: sanitizeName(p.plant_name ?? p.name ?? p.plantName ?? ""),
      // optional override; if empty we try to infer from plant/data
      systemSizeKwp: "",
      // SAFETY: start with all inactive; you choose which to turn on
      active: false
    }))
  };

  // Enable the first one by default so you get at least 1 real report immediately
  if (out.plants.length) out.plants[0].active = true;

  savePlants(out);
  console.log(`Wrote ${out.plants.length} plants to ${FILE}`);
  console.log("Edit data/plants.json and set active=true for the plants you want to message.");
})().catch((e) => {
  console.error("[plants:init] Failed:", e?.message || e);
  process.exit(1);
});
