const axios = require("axios");
const { error, safeErr } = require("../utils/log");

function unwrap(res) {
  const d = res?.data;
  if (d && typeof d === "object" && "data" in d) return d.data; // common pattern
  return d;
}

function createGrowattClient(cfg) {
  const base = cfg.growattBaseUrl.replace(/\/+$/, "");
  const baseV1 = base.endsWith("/v1") ? base : `${base}/v1`;

  const http = axios.create({
    baseURL: baseV1,
    timeout: cfg.growattTimeoutMs
  });

  http.interceptors.request.use((config) => {
    config.headers = config.headers || {};
    config.headers[cfg.growattTokenHeader || "token"] = cfg.growattToken;
    return config;
  });

  async function get(path, params) {
    try {
      const res = await http.get(path, { params });
      return unwrap(res);
    } catch (err) {
      error("[GROWATT] GET failed", { path, params, err: safeErr(err), data: err?.response?.data });
      throw err;
    }
  }

  return {
    listPlants: () => get("/plant/list"),
    getPlantData: (plantId) => get("/plant/data", { plant_id: plantId }),
    getPlantEnergy: (plantId, startDate, endDate, timeUnit = "day") =>
      get("/plant/energy", { plant_id: plantId, start_date: startDate, end_date: endDate, time_unit: timeUnit }),
    listDevices: (plantId) => get("/device/list", { plant_id: plantId }),
    getInverterAlarms: (deviceSn) => get("/device/inverter/alarm", { device_sn: deviceSn })
  };
}

module.exports = { createGrowattClient };
