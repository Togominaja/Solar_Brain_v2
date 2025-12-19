const { DateTime } = require("luxon");

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function toNum(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatKwh(n) {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(1).replace(".", ",");
}

function formatPct(n) {
  if (!Number.isFinite(n)) return "-";
  return String(Math.round(n));
}

function ratioPct(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return (a / b) * 100;
}

function ymd(dt) {
  return dt.toFormat("yyyy-LL-dd");
}

function startOfMonth(dt) {
  return dt.startOf("month");
}

function startOfYear(dt) {
  return dt.startOf("year");
}

function extractEnergyRows(resp) {
  // Try common shapes
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.list)) return resp.list;
  if (Array.isArray(resp?.data)) return resp.data;
  if (Array.isArray(resp?.records)) return resp.records;
  return [];
}

function sumEnergy(resp) {
  const rows = extractEnergyRows(resp);
  let sum = 0;
  let seen = 0;
  for (const r of rows) {
    const e = toNum(pick(r, ["energy", "kwh", "value", "val"]));
    if (Number.isFinite(e)) {
      sum += e;
      seen++;
    }
  }
  return seen ? sum : null;
}

function inferSystemSizeKwp(plantData) {
  const raw = toNum(pick(plantData, ["peak_power", "peakPower", "nominal_power", "nominalPower", "installed_capacity"]));
  if (!Number.isFinite(raw)) return null;

  // Heuristic: if huge, assume watts; else kW
  const kw = raw > 1000 ? raw / 1000 : raw;
  return kw;
}

async function fetchActiveAlarms({ growatt, plantId }) {
  // Best-effort: may vary by account/device types
  try {
    const devs = await growatt.listDevices(plantId);
    const devices = Array.isArray(devs) ? devs : (devs?.list || devs?.data || []);
    const sns = devices
      .map((d) => pick(d, ["device_sn", "deviceSn", "sn"]))
      .filter(Boolean)
      .slice(0, 6);

    const alarms = [];
    for (const sn of sns) {
      try {
        const a = await growatt.getInverterAlarms(sn);
        const arr = Array.isArray(a) ? a : (a?.list || a?.data || []);
        for (const item of arr) alarms.push(item);
      } catch {
        // ignore per-device failures
      }
    }

    // Heuristic: treat any returned alarm as “active” unless it clearly looks resolved
    const active = alarms.filter((x) => {
      const solved = pick(x, ["is_solved", "isSolved", "solved"]);
      const status = pick(x, ["status", "alarm_status", "alarmStatus"]);
      if (String(solved) === "1" || String(solved).toLowerCase() === "true") return false;
      if (String(status) === "0" || String(status).toLowerCase() === "resolved") return false;
      return true;
    });

    return active;
  } catch {
    return [];
  }
}

async function buildDailyReportForPlant({ cfg, growatt, plant }) {
  const now = DateTime.now().setZone(cfg.timezone);
  const today = now.startOf("day");

  const plantId = plant.plantId;
  const plantData = await growatt.getPlantData(plantId);

  // Current period energy (prefer plant/data; fallback to plant/energy sums)
  let todayKwh = toNum(pick(plantData, ["today_energy", "todayEnergy", "today_energy_kwh"]));
  let mtdKwh = toNum(pick(plantData, ["month_energy", "monthEnergy", "month_energy_kwh"]));
  let ytdKwh = toNum(pick(plantData, ["year_energy", "yearEnergy", "year_energy_kwh"]));

  if (!Number.isFinite(todayKwh)) {
    const r = await growatt.getPlantEnergy(plantId, ymd(today), ymd(today), "day");
    todayKwh = sumEnergy(r);
  }
  if (!Number.isFinite(mtdKwh)) {
    const r = await growatt.getPlantEnergy(plantId, ymd(startOfMonth(today)), ymd(today), "day");
    mtdKwh = sumEnergy(r);
  }
  if (!Number.isFinite(ytdKwh)) {
    const r = await growatt.getPlantEnergy(plantId, ymd(startOfYear(today)), ymd(today), "day");
    ytdKwh = sumEnergy(r);
  }

  // Comparisons: same date and same periods for 2024/2023
  const d2024 = today.minus({ years: 1 });
  const d2023 = today.minus({ years: 2 });

  const today2024 = sumEnergy(await growatt.getPlantEnergy(plantId, ymd(d2024), ymd(d2024), "day"));
  const today2023 = sumEnergy(await growatt.getPlantEnergy(plantId, ymd(d2023), ymd(d2023), "day"));

  const mtd2024 = sumEnergy(
    await growatt.getPlantEnergy(plantId, ymd(startOfMonth(d2024)), ymd(d2024), "day")
  );
  const mtd2023 = sumEnergy(
    await growatt.getPlantEnergy(plantId, ymd(startOfMonth(d2023)), ymd(d2023), "day")
  );

  const ytd2024 = sumEnergy(
    await growatt.getPlantEnergy(plantId, ymd(startOfYear(d2024)), ymd(d2024), "day")
  );
  const ytd2023 = sumEnergy(
    await growatt.getPlantEnergy(plantId, ymd(startOfYear(d2023)), ymd(d2023), "day")
  );

  // Performance: vs 2024 baseline (simple + stable)
  const todayPerf = ratioPct(todayKwh, today2024);
  const mtdPerf = ratioPct(mtdKwh, mtd2024);
  const ytdPerf = ratioPct(ytdKwh, ytd2024);

  // System size (kWp): override wins, else infer from plant/data
  const inferredKwp = inferSystemSizeKwp(plantData);
  const systemSizeKwp = String(plant.systemSizeKwp || (Number.isFinite(inferredKwp) ? inferredKwp.toFixed(1).replace(".", ",") : "-"));

  // Alerts (best-effort)
  const alarms = await fetchActiveAlarms({ growatt, plantId });

  let level = "OK";
  let message = "Sistema operando normalmente. Nenhuma falha ativa detectada";

  if (alarms.length) {
    level = "Falha";
    const names = alarms
      .map((a) => pick(a, ["alarm_name", "alarmName", "name", "msg", "message"]))
      .filter(Boolean)
      .map((s) => String(s).trim())
      .slice(0, 2);
    message = names.length ? `Falha ativa: ${names.join("; ")}` : "Falha ativa detectada no inversor";
  } else if (Number.isFinite(todayPerf) && todayPerf < 80) {
    level = "Alerta";
    message = `Performance baixa hoje (${formatPct(todayPerf)}%) vs 2024`;
  }

  // IMPORTANT: don’t end with "." because template already adds it
  message = String(message).trim().replace(/\.+$/, "");
  level = String(level).trim().replace(/\.+$/, "");

  return {
    clientName: plant.clientName || plant.plantName || `Plant ${plantId}`,
    systemSizeKwp,

    todayKwh: formatKwh(todayKwh),
    todayPerfPct: formatPct(todayPerf),
    todaySameDate2024Kwh: formatKwh(today2024),
    todaySameDate2023Kwh: formatKwh(today2023),

    mtdKwh: formatKwh(mtdKwh),
    mtdPerfPct: formatPct(mtdPerf),
    mtdSamePeriod2024Kwh: formatKwh(mtd2024),
    mtdSamePeriod2023Kwh: formatKwh(mtd2023),

    ytdKwh: formatKwh(ytdKwh),
    ytdPerfPct: formatPct(ytdPerf),
    ytdSamePeriod2024Kwh: formatKwh(ytd2024),
    ytdSamePeriod2023Kwh: formatKwh(ytd2023),

    message,
    level
  };
}

module.exports = { buildDailyReportForPlant };
