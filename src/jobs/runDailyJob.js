const { buildDailyTemplateVars } = require("../sender/templatePayload");
const { info } = require("../utils/log");

async function runDailyJob({ cfg, whatsappClient, forceSend = false }) {
  info("[JOB] Daily job start", { forceSend });

  // Support both WA_TEST_RECIPIENT_PHONES (preferred) and WA_TEST_RECIPIENT_PHONE (legacy)
  const recipients =
    (Array.isArray(cfg.waTestRecipientPhones) && cfg.waTestRecipientPhones.length
      ? cfg.waTestRecipientPhones
      : (cfg.waTestRecipientPhone ? [cfg.waTestRecipientPhone] : []));

  if (!recipients.length) {
    return { ok: false, reason: "missing_WA_TEST_RECIPIENT_PHONES" };
  }

  // v1 dummy report (we’ll replace with Growatt KPIs next)
  const vars = buildDailyTemplateVars({
    clientName: "Cliente Teste",
    systemSizeKwp: "8,2",

    todayKwh: "12,3",
    todayPerfPct: "98",
    todaySameDate2024Kwh: "11,7",
    todaySameDate2023Kwh: "10,9",

    mtdKwh: "210,4",
    mtdPerfPct: "95",
    mtdSamePeriod2024Kwh: "198,2",
    mtdSamePeriod2023Kwh: "190,1",

    ytdKwh: "3821,9",
    ytdPerfPct: "92",
    ytdSamePeriod2024Kwh: "3710,5",
    ytdSamePeriod2023Kwh: "3602,2",

    message: "Sistema operando normalmente. Nenhuma falha ativa detectada",
    level: "OK"
  });

  const results = [];
  for (const phone of recipients) {
    const sendRes = await whatsappClient.sendTemplateMessage({
      toPhoneE164: phone,
      variables: vars,
      forceSend
    });

    results.push({
      phone,
      ok: sendRes.ok,
      skipped: sendRes.skipped,
      reason: sendRes.reason,
      graph: sendRes.graph
    });
  }

  const ok = results.every((r) => r.ok || r.skipped);
  info("[JOB] Daily job end", { ok, resultsCount: results.length });

  return { ok, results };
}

module.exports = { runDailyJob };
