const { buildDailyTemplateVars } = require("../sender/templatePayload");
const { info } = require("../utils/log");
const { loadPlants } = require("../config/plantsStore");
const { createGrowattClient } = require("../growatt/client");
const { buildDailyReportForPlant } = require("../kpi/dailyReportService");

async function runDailyJob({ cfg, whatsappClient, forceSend = false }) {
  info("[JOB] Daily job start", { forceSend });

  const recipients = cfg.waTestRecipientPhones || [];
  if (!recipients.length) {
    return { ok: false, reason: "missing_WA_TEST_RECIPIENT_PHONES" };
  }

  const store = loadPlants();
  const activePlants = (store.plants || []).filter((p) => p && p.active === true && p.plantId);

  if (!activePlants.length) {
    return { ok: false, reason: "no_active_plants", hint: "Run: npm run plants:init then set active=true in data/plants.json" };
  }

  const growatt = createGrowattClient(cfg);

  const results = [];
  for (const plant of activePlants) {
    const report = await buildDailyReportForPlant({ cfg, growatt, plant });
    const vars = buildDailyTemplateVars(report);

    for (const phone of recipients) {
      const sendRes = await whatsappClient.sendTemplateMessage({
        toPhoneE164: phone,
        variables: vars,
        forceSend
      });

      results.push({
        plantId: plant.plantId,
        plantName: plant.plantName,
        to: phone,
        ok: sendRes.ok,
        skipped: sendRes.skipped,
        reason: sendRes.reason,
        graph: sendRes.graph
      });
    }
  }

  const ok = results.every((r) => r.ok || r.skipped);
  info("[JOB] Daily job end", { ok, resultsCount: results.length });

  return { ok, results };
}

module.exports = { runDailyJob };
