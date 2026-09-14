function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

class MercadoLivreQuestionNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "MercadoLivreQuestionNotFoundError";
  }
}

class MercadoLivreQuestionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MercadoLivreQuestionValidationError";
  }
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toNumber(value, fallbackValue = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }

  return parsed;
}

function ensureIsoDate(value, fallbackValue = null) {
  if (!value) {
    return fallbackValue;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackValue;
  }

  return parsed.toISOString();
}

function ensureDate(value, fallbackValue = null) {
  if (!value) {
    return fallbackValue;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackValue;
  }

  return parsed;
}

module.exports = {
  createHttpError,
  MercadoLivreQuestionNotFoundError,
  MercadoLivreQuestionValidationError,
  cloneData,
  normalizeText,
  round2,
  toNumber,
  ensureIsoDate,
  ensureDate,
};
