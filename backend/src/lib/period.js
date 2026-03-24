const DEFAULT_PERIOD = "30d";
const MAX_CUSTOM_RANGE_DAYS = 366;

const PRESET_PERIOD_DAYS = Object.freeze({
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
});

const CUSTOM_PERIOD_PATTERN = /^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/i;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function normalizeDateOnly(value) {
  const text = String(value || "").trim();
  const match = DATE_ONLY_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}

function toUtcRangeStart(dateOnly) {
  const normalized = normalizeDateOnly(dateOnly);
  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function toUtcRangeEnd(dateOnly) {
  const normalized = normalizeDateOnly(dateOnly);
  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

function calculateInclusiveDays(startDate, endDate) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  return Math.floor((endTime - startTime) / dayMs) + 1;
}

function buildCustomRange(startDateInput, endDateInput, { strict = false } = {}) {
  const startDateOnly = normalizeDateOnly(startDateInput);
  const endDateOnly = normalizeDateOnly(endDateInput);

  if (!startDateOnly || !endDateOnly) {
    if (strict) {
      throw new Error("Intervalo personalizado invalido. Informe as duas datas.");
    }

    return null;
  }

  const startDate = toUtcRangeStart(startDateOnly);
  const endDate = toUtcRangeEnd(endDateOnly);

  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
    if (strict) {
      throw new Error("Intervalo personalizado invalido. A data inicial deve ser menor ou igual a final.");
    }

    return null;
  }

  const totalDays = calculateInclusiveDays(startDate, endDate);

  if (totalDays > MAX_CUSTOM_RANGE_DAYS) {
    if (strict) {
      throw new Error("Intervalo personalizado maior que 1 ano.");
    }

    return null;
  }

  const period = `custom_${startDateOnly}_${endDateOnly}`;

  return {
    period,
    isCustom: true,
    totalDays,
    startDateOnly,
    endDateOnly,
    startDate,
    endDate,
  };
}

function parseCustomPeriod(period, options = {}) {
  const text = String(period || "").trim();
  const match = CUSTOM_PERIOD_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  return buildCustomRange(match[1], match[2], options);
}

function resolvePeriod(period, fallbackPeriod = DEFAULT_PERIOD) {
  const normalizedFallback = PRESET_PERIOD_DAYS[fallbackPeriod]
    ? fallbackPeriod
    : DEFAULT_PERIOD;
  const normalizedInput = String(period || "").trim();

  if (PRESET_PERIOD_DAYS[normalizedInput]) {
    return normalizedInput;
  }

  const custom = parseCustomPeriod(normalizedInput);
  if (custom) {
    return custom.period;
  }

  return normalizedFallback;
}

function resolvePeriodRange(
  period,
  { fallbackPeriod = DEFAULT_PERIOD, now = new Date(), strict = false } = {}
) {
  const normalizedInput = String(period || "").trim();
  const presetDays = PRESET_PERIOD_DAYS[normalizedInput];

  if (presetDays) {
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (presetDays - 1));
    startDate.setHours(0, 0, 0, 0);

    const startDateOnly = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(startDate.getDate()).padStart(2, "0")}`;
    const endDateOnly = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(endDate.getDate()).padStart(2, "0")}`;

    return {
      period: normalizedInput,
      isCustom: false,
      totalDays: presetDays,
      startDateOnly,
      endDateOnly,
      startDate,
      endDate,
    };
  }

  const custom = parseCustomPeriod(normalizedInput, { strict });
  if (custom) {
    return custom;
  }

  if (strict && normalizedInput) {
    throw new Error("Periodo invalido.");
  }

  const fallbackResolved = resolvePeriod(fallbackPeriod, DEFAULT_PERIOD);
  if (fallbackResolved === normalizedInput) {
    return resolvePeriodRange(DEFAULT_PERIOD, { fallbackPeriod: DEFAULT_PERIOD, now });
  }

  return resolvePeriodRange(fallbackResolved, { fallbackPeriod: DEFAULT_PERIOD, now });
}

function shouldAggregatePeriodByMonth(period) {
  const range = resolvePeriodRange(period, { fallbackPeriod: DEFAULT_PERIOD });
  return range.totalDays >= 90;
}

function formatDateLabel(date, locale = "pt-BR") {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getPeriodLabel(period, locale = "pt-BR") {
  const resolved = resolvePeriod(period, DEFAULT_PERIOD);

  if (resolved === "7d") {
    return "7 dias";
  }

  if (resolved === "30d") {
    return "30 dias";
  }

  if (resolved === "90d") {
    return "90 dias";
  }

  if (resolved === "1y") {
    return "1 ano";
  }

  const custom = parseCustomPeriod(resolved);
  if (!custom) {
    return "30 dias";
  }

  return `${formatDateLabel(custom.startDate, locale)} a ${formatDateLabel(
    custom.endDate,
    locale
  )}`;
}

module.exports = {
  DEFAULT_PERIOD,
  MAX_CUSTOM_RANGE_DAYS,
  PRESET_PERIOD_DAYS,
  buildCustomRange,
  getPeriodLabel,
  normalizeDateOnly,
  parseCustomPeriod,
  resolvePeriod,
  resolvePeriodRange,
  shouldAggregatePeriodByMonth,
};
