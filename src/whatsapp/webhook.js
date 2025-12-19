const express = require("express");
const { info, warn } = require("../utils/log");
const { verifyMetaSignature } = require("./signature");
const { optOut, optIn, normalizePhone } = require("./optOutStore");

function extractInboundMessages(body) {
  // WhatsApp webhook payloads can be nested; keep parsing conservative.
  const msgs = [];
  const entry = body?.entry;
  if (!Array.isArray(entry)) return msgs;

  for (const e of entry) {
    const changes = e?.changes;
    if (!Array.isArray(changes)) continue;

    for (const c of changes) {
      const value = c?.value;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue;

      for (const m of messages) {
        const from = m?.from;
        const text = m?.text?.body;
        msgs.push({ from, text, raw: m });
      }
    }
  }
  return msgs;
}

function normalizeCommand(txt) {
  return String(txt || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function createWebhookRouter({ cfg, whatsappClient }) {
  const router = express.Router();

  // Verification (GET)
  router.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === cfg.waVerifyToken) {
      info("[WA] Webhook verified.");
      return res.status(200).send(challenge);
    }
    warn("[WA] Webhook verification failed.");
    return res.sendStatus(403);
  });

  // Receive (POST)
  router.post("/webhook", async (req, res) => {
    if (cfg.requireWebhookSignature) {
      const sig = req.get("x-hub-signature-256");
      const ok = verifyMetaSignature({
        appSecret: cfg.appSecret,
        rawBody: req.rawBody || Buffer.from(""),
        headerSig256: sig
      });
      if (!ok) {
        warn("[WA] Invalid webhook signature.");
        return res.sendStatus(401);
      }
    }

    // Acknowledge quickly
    res.sendStatus(200);

    const msgs = extractInboundMessages(req.body);
    for (const msg of msgs) {
      const from = normalizePhone(msg.from);
      const cmd = normalizeCommand(msg.text);

      if (!from) continue;

      if (cmd === "STOP" || cmd === "PARAR" || cmd === "CANCELAR" || cmd === "UNSUBSCRIBE") {
        optOut(from);
        info(`[WA] Opt-out saved for ${from}.`);
        // Best effort: reply (only works if in 24h window)
        if (whatsappClient?.sendTextMessage) {
          await whatsappClient.sendTextMessage({
            toPhoneE164: from,
            text: "Ok. Você foi removido e não receberá mais mensagens. Para voltar, responda START."
          }).catch(() => {});
        }
      }

      if (cmd === "START" || cmd === "INICIAR") {
        optIn(from);
        info(`[WA] Opt-in saved for ${from}.`);
        if (whatsappClient?.sendTextMessage) {
          await whatsappClient.sendTextMessage({
            toPhoneE164: from,
            text: "Perfeito. Você voltou a receber mensagens do SolarBrain."
          }).catch(() => {});
        }
      }

      info("[WA] Inbound message:", { from, text: msg.text });
    }
  });

  return router;
}

module.exports = { createWebhookRouter };
