require("dotenv").config();
const { loadEnv } = require("../config/env");
const { createWhatsAppClient } = require("../sender/whatsappClient");
const { runDailyJob } = require("./runDailyJob");

function getFlag(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.split("=").slice(1).join("=");
}

(async () => {
  const cfg = loadEnv();
  const whatsappClient = createWhatsAppClient(cfg);

  const forceSend = getFlag("forceSend") === "1" || getFlag("forceSend") === "true";
  const res = await runDailyJob({ cfg, whatsappClient, forceSend });

  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
})().catch((err) => {
  console.error("[CLI] Failed:", err?.message || err);
  process.exit(1);
});
