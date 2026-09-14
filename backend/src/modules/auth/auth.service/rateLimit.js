const { normalizeText, normalizeEmail, resolveClientIp } = require("./shared");

const PASSWORD_RESET_RATE_WINDOW_MS = 1000 * 60 * 15;
const PASSWORD_RESET_RATE_IP_MAX = 20;
const PASSWORD_RESET_RATE_EMAIL_MAX = 5;
const LOGIN_RATE_WINDOW_MS = 1000 * 60 * 15;
const LOGIN_RATE_IP_MAX = 20;
const LOGIN_RATE_EMAIL_MAX = 8;
const rateLimitBuckets = new Map();

function createRateLimitError() {
  const error = new Error(
    "Nao foi possivel processar a solicitacao no momento. Tente novamente em alguns minutos."
  );
  error.status = 429;
  return error;
}

function consumeRateLimitBucket(bucketKey, limit, windowMs) {
  const key = normalizeText(bucketKey) || "unknown";
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key) || [];
  const validWindow = bucket.filter((timestamp) => now - timestamp < windowMs);

  if (validWindow.length >= limit) {
    rateLimitBuckets.set(key, validWindow);
    return false;
  }

  validWindow.push(now);
  rateLimitBuckets.set(key, validWindow);

  if (rateLimitBuckets.size > 5000) {
    for (const [storedKey, timestamps] of rateLimitBuckets.entries()) {
      const hasRecentEvent = timestamps.some((timestamp) => now - timestamp < windowMs);
      if (!hasRecentEvent) {
        rateLimitBuckets.delete(storedKey);
      }
    }
  }

  return true;
}

function assertPasswordResetRateLimit(email, request = {}) {
  const clientIp = resolveClientIp(request) || "ip:unknown";
  const isIpAllowed = consumeRateLimitBucket(
    `password-reset:ip:${clientIp}`,
    PASSWORD_RESET_RATE_IP_MAX,
    PASSWORD_RESET_RATE_WINDOW_MS
  );
  const isEmailAllowed = consumeRateLimitBucket(
    `password-reset:email:${normalizeEmail(email)}`,
    PASSWORD_RESET_RATE_EMAIL_MAX,
    PASSWORD_RESET_RATE_WINDOW_MS
  );

  if (!isIpAllowed || !isEmailAllowed) {
    throw createRateLimitError();
  }
}

function assertLoginRateLimit(email, request = {}) {
  const clientIp = resolveClientIp(request) || "ip:unknown";
  const isIpAllowed = consumeRateLimitBucket(
    `login:ip:${clientIp}`,
    LOGIN_RATE_IP_MAX,
    LOGIN_RATE_WINDOW_MS
  );
  const isEmailAllowed = consumeRateLimitBucket(
    `login:email:${normalizeEmail(email)}`,
    LOGIN_RATE_EMAIL_MAX,
    LOGIN_RATE_WINDOW_MS
  );

  if (!isIpAllowed || !isEmailAllowed) {
    throw createRateLimitError();
  }
}

module.exports = {
  assertPasswordResetRateLimit,
  assertLoginRateLimit,
};
