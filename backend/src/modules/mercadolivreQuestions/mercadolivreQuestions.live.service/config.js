const DEFAULT_MODE = "auto";
const VALID_MODES = new Set(["mock", "auto", "live"]);
const DEFAULT_API_BASE_URL = "https://api.mercadolibre.com";
const DEFAULT_AUTH_BASE_URL = "https://auth.mercadolivre.com.br/authorization";
const DEFAULT_OAUTH_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const DEFAULT_TIMEOUT_MS = 20000;

class MercadoLivreLiveServiceError extends Error {
  constructor(message, status = 500, payload = null) {
    super(message);
    this.name = "MercadoLivreLiveServiceError";
    this.status = status;
    this.payload = payload;
  }
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeMode(value) {
  const normalized = normalizeText(value).toLowerCase();

  if (VALID_MODES.has(normalized)) {
    return normalized;
  }

  return DEFAULT_MODE;
}

function mode() {
  return normalizeMode(process.env.MERCADOLIVRE_API_MODE);
}

function getConfig() {
  return {
    mode: mode(),
    apiBaseUrl: normalizeText(process.env.MERCADOLIVRE_API_BASE_URL) || DEFAULT_API_BASE_URL,
    authBaseUrl:
      normalizeText(process.env.MERCADOLIVRE_AUTH_BASE_URL) || DEFAULT_AUTH_BASE_URL,
    oauthTokenUrl:
      normalizeText(process.env.MERCADOLIVRE_OAUTH_TOKEN_URL) || DEFAULT_OAUTH_TOKEN_URL,
    clientId: normalizeText(process.env.MERCADOLIVRE_CLIENT_ID),
    clientSecret: normalizeText(process.env.MERCADOLIVRE_CLIENT_SECRET),
    redirectUri: normalizeText(process.env.MERCADOLIVRE_REDIRECT_URI),
  };
}

function hasLiveCredentials() {
  const config = getConfig();

  if (config.mode === "mock") {
    return false;
  }

  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function getRequestTimeout() {
  const parsedTimeout = Number(process.env.MERCADOLIVRE_REQUEST_TIMEOUT_MS);

  if (!Number.isFinite(parsedTimeout) || parsedTimeout < 2000) {
    return DEFAULT_TIMEOUT_MS;
  }

  return parsedTimeout;
}

function throwClientError(message, status = 400, payload = null) {
  throw new MercadoLivreLiveServiceError(message, status, payload);
}

function ensureLiveConfig() {
  const config = getConfig();

  if (config.mode === "mock") {
    throwClientError("Modo mock ativo para Mercado Livre.", 503);
  }

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throwClientError(
      "Defina MERCADOLIVRE_CLIENT_ID, MERCADOLIVRE_CLIENT_SECRET e MERCADOLIVRE_REDIRECT_URI.",
      503
    );
  }

  return config;
}

module.exports = {
  MercadoLivreLiveServiceError,
  normalizeText,
  mode,
  getConfig,
  hasLiveCredentials,
  getRequestTimeout,
  throwClientError,
  ensureLiveConfig,
};
