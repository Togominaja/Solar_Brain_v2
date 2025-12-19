function buildDailyTemplateVars(input) {
  // Keep exact order 1..16
  return [
    String(input.clientName ?? ""),
    String(input.systemSizeKwp ?? ""),

    String(input.todayKwh ?? ""),
    String(input.todayPerfPct ?? ""),
    String(input.todaySameDate2024Kwh ?? ""),
    String(input.todaySameDate2023Kwh ?? ""),

    String(input.mtdKwh ?? ""),
    String(input.mtdPerfPct ?? ""),
    String(input.mtdSamePeriod2024Kwh ?? ""),
    String(input.mtdSamePeriod2023Kwh ?? ""),

    String(input.ytdKwh ?? ""),
    String(input.ytdPerfPct ?? ""),
    String(input.ytdSamePeriod2024Kwh ?? ""),
    String(input.ytdSamePeriod2023Kwh ?? ""),

    String(input.message ?? ""),
    String(input.level ?? "")
  ];
}

module.exports = { buildDailyTemplateVars };
