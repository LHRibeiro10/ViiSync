export const DEFAULT_PERIOD = "30d";
export const MAX_CUSTOM_PERIOD_DAYS = 366;

export const PRESET_PERIODS = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "90d", label: "90 dias", days: 90 },
  { id: "1y", label: "1 ano", days: 365 },
];

export const PRESET_PERIOD_KEYS = PRESET_PERIODS.map((period) => period.id);

const PRESET_PERIOD_DAYS_BY_ID = PRESET_PERIODS.reduce((map, period) => {
  map[period.id] = period.days;
  return map;
}, {});

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
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}

function buildDateBounds(dateOnly) {
  const normalized = normalizeDateOnly(dateOnly);
  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);

  return {
    normalized,
    start,
    end,
  };
}

function calculateInclusiveDays(startDate, endDate) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / dayMs) + 1;
}

export function parseCustomPeriodToken(value) {
  const text = String(value || "").trim();
  const match = CUSTOM_PERIOD_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  const startBounds = buildDateBounds(match[1]);
  const endBounds = buildDateBounds(match[2]);

  if (!startBounds || !endBounds || startBounds.start.getTime() > endBounds.end.getTime()) {
    return null;
  }

  const totalDays = calculateInclusiveDays(startBounds.start, endBounds.end);

  if (totalDays > MAX_CUSTOM_PERIOD_DAYS) {
    return null;
  }

  const token = `custom_${startBounds.normalized}_${endBounds.normalized}`;

  return {
    token,
    startDate: startBounds.start,
    endDate: endBounds.end,
    startDateIso: startBounds.normalized,
    endDateIso: endBounds.normalized,
    totalDays,
  };
}

export function buildCustomPeriodToken(startDate, endDate) {
  const parsed = parseCustomPeriodToken(`custom_${startDate}_${endDate}`);
  return parsed?.token || null;
}

export function normalizePeriod(value) {
  const text = String(value || "").trim();

  if (PRESET_PERIOD_DAYS_BY_ID[text]) {
    return text;
  }

  const custom = parseCustomPeriodToken(text);
  if (custom) {
    return custom.token;
  }

  return DEFAULT_PERIOD;
}

export function isCustomPeriod(period) {
  return Boolean(parseCustomPeriodToken(period));
}

export function getPeriodRange(period, fallbackPeriod = DEFAULT_PERIOD) {
  const resolved = normalizePeriod(period);

  if (PRESET_PERIOD_DAYS_BY_ID[resolved]) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (PRESET_PERIOD_DAYS_BY_ID[resolved] - 1));
    startDate.setHours(0, 0, 0, 0);

    const startDateIso = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(startDate.getDate()).padStart(2, "0")}`;
    const endDateIso = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(endDate.getDate()).padStart(2, "0")}`;

    return {
      period: resolved,
      startDate,
      endDate,
      startDateIso,
      endDateIso,
      totalDays: PRESET_PERIOD_DAYS_BY_ID[resolved],
    };
  }

  const custom = parseCustomPeriodToken(resolved);
  if (custom) {
    return {
      period: custom.token,
      startDate: custom.startDate,
      endDate: custom.endDate,
      startDateIso: custom.startDateIso,
      endDateIso: custom.endDateIso,
      totalDays: custom.totalDays,
    };
  }

  return getPeriodRange(fallbackPeriod, DEFAULT_PERIOD);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getPeriodLabel(period) {
  const resolved = normalizePeriod(period);

  const preset = PRESET_PERIODS.find((item) => item.id === resolved);
  if (preset) {
    return preset.label;
  }

  const custom = parseCustomPeriodToken(resolved);
  if (custom) {
    return `${formatDate(custom.startDate)} a ${formatDate(custom.endDate)}`;
  }

  return "30 dias";
}
