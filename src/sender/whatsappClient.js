const axios = require("axios");
const { isWithinQuietHours } = require("./quietHours");
const { isOptedOut, normalizePhone } = require("../whatsapp/optOutStore");
const { info, warn, error, safeErr } = require("../utils/log");

function maskPhone(p) {
  const s = String(p || "");
  if (s.length <= 6) return "***";
  return `${s.slice(0, 3)}***${s.slice(-3)}`;
}

function createWhatsAppClient(cfg) {
  async function postGraph(payload) {
    const url = `https://graph.facebook.com/v20.0/${cfg.waPhoneNumberId}/messages`;
    return axios.post(url, payload, {
      headers: { Authorization: `Bearer ${cfg.waAccessToken}` },
      timeout: 20000
    });
  }

  async function sendTemplateMessage({ toPhoneE164, variables, forceSend = false }) {
    const to = normalizePhone(toPhoneE164);

    if (!to) throw new Error("[WA] Missing recipient phone");
    if (isOptedOut(to)) {
      info(`[WA] Recipient opted out. Skipping send to ${maskPhone(to)}.`);
      return { ok: true, skipped: true, reason: "opted_out" };
    }

    const quiet = isWithinQuietHours({
      startHHMM: cfg.quietHoursStart,
      endHHMM: cfg.quietHoursEnd,
      timezone: cfg.timezone
    });

    if (quiet && !forceSend) {
      info(`[WA] Quiet hours active. Skipping send to ${maskPhone(to)}.`);
      return { ok: true, skipped: true, reason: "quiet_hours" };
    }

    if (!Array.isArray(variables) || variables.length !== 16) {
      throw new Error(`[WA] Template variables must be an array of length 16. Got: ${variables?.length}`);
    }

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: cfg.waTemplateName,
        language: { code: cfg.waTemplateLang },
        components: [
          { type: "body", parameters: variables.map((v) => ({ type: "text", text: String(v) })) }
        ]
      }
    };

    try {
      const res = await postGraph(payload);
      info(`[WA] Sent template to ${maskPhone(to)}.`, { messageId: res?.data?.messages?.[0]?.id });
      return { ok: true, data: res.data };
    } catch (err) {
      const graph = err?.response?.data;
      error("[WA] Send failed.", { to: maskPhone(to), graph, err: safeErr(err) });
      return { ok: false, error: safeErr(err), graph };
    }
  }

  async function sendTextMessage({ toPhoneE164, text }) {
    const to = normalizePhone(toPhoneE164);
    if (!to) throw new Error("[WA] Missing recipient phone");
    if (!text) throw new Error("[WA] Missing text");

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: String(text) }
    };

    try {
      const res = await postGraph(payload);
      info(`[WA] Sent text to ${maskPhone(to)}.`, { messageId: res?.data?.messages?.[0]?.id });
      return { ok: true, data: res.data };
    } catch (err) {
      warn("[WA] Text send failed (best effort).", { to: maskPhone(to), graph: err?.response?.data });
      return { ok: false };
    }
  }

  return { sendTemplateMessage, sendTextMessage };
}

module.exports = { createWhatsAppClient };
