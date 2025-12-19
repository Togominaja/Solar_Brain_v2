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
    throw new Error(
      `[ENV] ${name} has leading/trailing spaces. Fix your .env (this breaks auth).`
    );
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

function parseIntPositive(name, defaultVal) {
  const raw = process.env[name];
  const n = Number(raw ?? defaultVal);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`[ENV] ${name} must be a positive number. Got: ${raw}`);
  }
  return n;
}

function loadEnv() {
  const cfg = {
    port: Number(process.env.PORT || 3000),

    // WhatsApp
    waVerifyToken: mustGetTrimmed("WA_VERIFY_TOKEN"),
    waAccessToken: mustGetTrimmed("WA_ACCESS_TOKEN"),
    waPhoneNumberId: mustGetTrimmed("WA_PHONE_NUMBER_ID"),
    appSecret: mustGetTrimmed("APP_SECRET"),

    quietHoursStart: parseHHMM("QUIET_HOURS_START"),
    quietHoursEnd: parseHHMM("QUIET_HOURS_END"),
    timezone: (process.env.TIMEZONE || "America/Chicago").trim(),

    waTestRecipientPhones: (() => {
      const raw = String(
        process.env.WA_TEST_RECIPIENT_PHONES || process.env.WA_TEST_RECIPIENT_PHONE || ""
      ).trim();
      if (!raw) return [];
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    })(),

    // Accept both names to avoid confusion
    waTemplateName: (process.env.WA_TEMPLATE_NAME || process.env.WA_DAILY_TEMPLATE_NAME || "").trim(),
    waTemplateLang: (process.env.WA_TEMPLATE_LANG || "pt_BR").trim(),

    requireWebhookSignature: parseBool("REQUIRE_WEBHOOK_SIGNATURE", false),
    dailyJobCron: (process.env.DAILY_JOB_CRON || "0 8 * * *").trim(),

    // Growatt (optional for now; required only when you start calling Growatt)
    growattBaseUrl: (process.env.GROWATT_BASE_URL || "").trim().replace(/\/+$/, ""),
    growattToken: (process.env.GROWATT_TOKEN || "").trim(),
    growattTokenHeader: (process.env.GROWATT_TOKEN_HEADER || "token").trim(),
    growattTimeoutMs: parseIntPositive("GROWATT_TIMEOUT_MS", 20000)
  };

  // Basic validation
  if (!Number.isFinite(cfg.port) || cfg.port <= 0) {
    throw new Error(`[ENV] PORT must be a valid positive number. Got: ${process.env.PORT}`);
  }

  if (!cfg.waTemplateName) {
    throw new Error("[ENV] Missing WA_TEMPLATE_NAME (or WA_DAILY_TEMPLATE_NAME).");
  }

  if (!cfg.waTestRecipientPhones.length) {
    console.warn("[ENV] WA_TEST_RECIPIENT_PHONES is empty. Daily CLI will not send anywhere.");
  }

  // Growatt validation: only enforce if one of them is set (so server can boot before Growatt setup)
  const growattAnySet = Boolean(cfg.growattBaseUrl || cfg.growattToken);
  if (growattAnySet) {
    if (!cfg.growattBaseUrl) throw new Error("[ENV] Missing GROWATT_BASE_URL");
    if (!cfg.growattToken) throw new Error("[ENV] Missing GROWATT_TOKEN");
  }

  return cfg;
}

module.exports = { loadEnv };
