require("dotenv").config();

const express = require("express");
const { loadEnv } = require("./src/config/env");
const { info } = require("./src/utils/log");
const { createWhatsAppClient } = require("./src/sender/whatsappClient");
const { createWebhookRouter } = require("./src/whatsapp/webhook");
const { registerSchedulers } = require("./src/jobs/scheduler");

const cfg = loadEnv();

const app = express();

// Capture raw body for signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.get("/health", (req, res) => res.json({ ok: true, service: "Solar_Brain_v2" }));

const whatsappClient = createWhatsAppClient(cfg);
app.use("/", createWebhookRouter({ cfg, whatsappClient }));

registerSchedulers({ cfg, whatsappClient });

app.listen(cfg.port, () => {
  info(`Webhook listening on http://localhost:${cfg.port}`);
});
