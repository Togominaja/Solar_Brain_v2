const { DateTime } = require("luxon");

function isWithinQuietHours({ startHHMM, endHHMM, timezone, now }) {
  const dt = now ? DateTime.fromJSDate(now) : DateTime.now();
  const local = dt.setZone(timezone);

  const [sh, sm] = startHHMM.split(":").map(Number);
  const [eh, em] = endHHMM.split(":").map(Number);

  const start = local.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
  const end = local.set({ hour: eh, minute: em, second: 0, millisecond: 0 });

  // wraps midnight
  if (end <= start) return local >= start || local < end;
  return local >= start && local < end;
}

module.exports = { isWithinQuietHours };
