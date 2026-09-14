const { normalizeText } = require("./config");

function toIsoDateOrNull(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeImageUrl(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  if (text.startsWith("//")) {
    return `https:${text}`;
  }

  if (text.startsWith("http://")) {
    return `https://${text.slice("http://".length)}`;
  }

  if (text.startsWith("https://")) {
    return text;
  }

  return null;
}

function chunkArray(items = [], size = 20) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

module.exports = {
  toIsoDateOrNull,
  toNumber,
  parseOptionalNumber,
  normalizeImageUrl,
  chunkArray,
};
