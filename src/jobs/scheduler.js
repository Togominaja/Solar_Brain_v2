const cron = require("node-cron");
const { runDailyJob } = require("./runDailyJob");
const { info, error, safeErr } = require("../utils/log");

function registerSchedulers({ cfg, whatsappClient }) {
  info("[SCHED] Registering daily job", { cron: cfg.dailyJobCron, timezone: cfg.timezone });

  cron.schedule(
    cfg.dailyJobCron,
    async () => {
      try {
        await runDailyJob({ cfg, whatsappClient, forceSend: false });
      } catch (err) {
        error("[SCHED] Daily job crash", safeErr(err));
      }
    },
    { timezone: cfg.timezone }
  );
}

module.exports = { registerSchedulers };
