function mustGet(name) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === "") {
    throw new Error(`[ENV] Missing required env var: ${name}`);
  }
  return String(v);
}

function mustGetTrimmed(name) {
  const raw = mustGet(name);
  const trimmed = raw.trim();
  if (raw !== trimmed) {
    throw new Error(`[ENV] ${name} has leading/trailing spaces. Fix your .env (this breaks auth).`);
  }
  return trimmed;
}

function parseHHMM(name) {
  const v = mustGet(name).trim();
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v);
  if (!m) throw new Error(`[ENV] ${name} must be HH:MM (24h). Got: ${v}`);
  return v;
}

function parseBool(name, defaultVal = false) {
  const v = process.env[name];
  if (v === undefined) return defaultVal;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function loadEnv() {
  const cfg = {
    port: Number(process.env.PORT || 3000),

    waVerifyToken: mustGetTrimmed("WA_VERIFY_TOKEN"),
    waAccessToken: mustGetTrimmed("WA_ACCESS_TOKEN"),
    waPhoneNumberId: mustGetTrimmed("WA_PHONE_NUMBER_ID"),
    appSecret: mustGetTrimmed("APP_SECRET"),

    quietHoursStart: parseHHMM("QUIET_HOURS_START"),
    quietHoursEnd: parseHHMM("QUIET_HOURS_END"),
    timezone: (process.env.TIMEZONE || "America/Chicago").trim(),

    waTestRecipientPhones: (() => {
      const raw = (process.env.WA_TEST_RECIPIENT_PHONES || process.env.WA_TEST_RECIPIENT_PHONE || "").trim();
      if (!raw) return [];
      return raw.split(",").map(s => s.trim()).filter(Boolean);
    })(),


    waTemplateName: (process.env.WA_TEMPLATE_NAME || "").trim(),
    waTemplateLang: (process.env.WA_TEMPLATE_LANG || "pt_BR").trim(),

    requireWebhookSignature: parseBool("REQUIRE_WEBHOOK_SIGNATURE", false),

    dailyJobCron: (process.env.DAILY_JOB_CRON || "0 8 * * *").trim()
  };

  if (!Number.isFinite(cfg.port) || cfg.port <= 0) {
    throw new Error(`[ENV] PORT must be a valid positive number. Got: ${process.env.PORT}`);
  }
  if (!cfg.waTemplateName) {
    throw new Error("[ENV] Missing WA_TEMPLATE_NAME (your approved WhatsApp template name).");
  }
  if (!cfg.waTestRecipientPhones.length) {
    // not strictly required for prod, but helpful for v1
    console.warn("[ENV] WA_TEST_RECIPIENT_PHONE is empty. Daily CLI will not send anywhere.");
  }

  return cfg;
}

module.exports = { loadEnv };
