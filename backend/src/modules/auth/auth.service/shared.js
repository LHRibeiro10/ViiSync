const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
const REMEMBER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function slugify(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "seller-space";
}

function extractBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || "").trim();

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

function buildSessionWindow(rememberMe) {
  const now = Date.now();
  const duration = rememberMe ? REMEMBER_SESSION_TTL_MS : SESSION_TTL_MS;
  return new Date(now + duration);
}

function buildPasswordResetWindow() {
  return new Date(Date.now() + PASSWORD_RESET_TTL_MS);
}

function resolvePasswordResetBaseUrl() {
  const explicitBaseUrl = normalizeText(
    process.env.PASSWORD_RESET_BASE_URL ||
      process.env.FRONTEND_BASE_URL ||
      process.env.FRONTEND_APP_URL ||
      process.env.FRONTEND_URL
  );

  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, "");
  }

  const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => normalizeText(origin).replace(/\/+$/, ""))
    .filter(Boolean);

  if (allowedOrigins.length > 0) {
    return allowedOrigins[0];
  }

  return "http://localhost:5173";
}

function resolveClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).trim();
  }

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return (
    request.ip ||
    request.socket?.remoteAddress ||
    request.connection?.remoteAddress ||
    null
  );
}

module.exports = {
  normalizeEmail,
  normalizeText,
  slugify,
  extractBearerToken,
  buildSessionWindow,
  buildPasswordResetWindow,
  resolvePasswordResetBaseUrl,
  resolveClientIp,
};
