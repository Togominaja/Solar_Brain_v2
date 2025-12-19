require("dotenv").config();
const { loadEnv } = require("../config/env");
const { createGrowattClient } = require("./client");

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

  console.log(`Found ${plants.length} plants`);
  for (const p of plants) {
    const id = p.plant_id ?? p.id ?? p.plantId;
    const name = p.plant_name ?? p.name ?? p.plantName;
    console.log(`- ${name} | plant_id=${id}`);
  }
})().catch((e) => {
  console.error("[SMOKE] Failed:", e?.message || e);
  process.exit(1);
});
