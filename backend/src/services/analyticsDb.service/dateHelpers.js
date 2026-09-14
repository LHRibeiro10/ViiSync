const { DEFAULT_PERIOD, resolvePeriodRange } = require("../../lib/period");

function startDateForPeriod(period) {
  return resolvePeriodRange(period, { fallbackPeriod: DEFAULT_PERIOD }).startDate;
}

function endDateForPeriod(period) {
  return resolvePeriodRange(period, { fallbackPeriod: DEFAULT_PERIOD }).endDate;
}

// Sem call sites no arquivo original -- mantido aqui tal como estava, sem
// remover (fora do escopo de limpeza de codigo morto ja aprovado).
function toMonthKeyFromDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseReferenceMonth(referenceMonth) {
  const text = String(referenceMonth || "").trim();
  const match = /^(\d{4})-(\d{2})$/.exec(text);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return text;
}

function listMonthKeysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  if (start.getTime() > end.getTime()) {
    return [];
  }

  const keys = [];
  let year = start.getFullYear();
  let month = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month + 1).padStart(2, "0")}`);

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return keys;
}

module.exports = {
  startDateForPeriod,
  endDateForPeriod,
  toMonthKeyFromDate,
  parseReferenceMonth,
  listMonthKeysBetween,
};
