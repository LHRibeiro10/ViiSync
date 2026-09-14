import { getPeriodLabel } from "./period";

const monthReferenceFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const createdAtFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const integerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatInteger(value) {
  const numericValue =
    typeof value === "number" ? value : parseCurrencyValue(value);

  return integerFormatter.format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatPercentage(value) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

function getDefaultMonthReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatMonthReference(value) {
  if (!value) {
    return "";
  }

  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return value;
  }

  return monthReferenceFormatter.format(new Date(year, month - 1, 1));
}

function formatCreatedAt(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return createdAtFormatter.format(date);
}

function parseCurrencyValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return 0;
  }

  if (text.includes(",")) {
    const normalized = text
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const normalizedText = text.replace(/[^\d.-]/g, "");
  const dotGroups = normalizedText.split(".");

  if (dotGroups.length > 1 && dotGroups[dotGroups.length - 1].length === 3) {
    const parsedThousands = Number(normalizedText.replace(/\./g, ""));
    return Number.isFinite(parsedThousands) ? parsedThousands : 0;
  }

  const parsed = Number(normalizedText);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getValueTone(value) {
  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "neutral";
}
function formatPeriodLabel(period) {
  return getPeriodLabel(period);
}

export {
  formatInteger,
  formatPercentage,
  getDefaultMonthReference,
  formatMonthReference,
  formatCreatedAt,
  parseCurrencyValue,
  getValueTone,
  formatPeriodLabel,
};
