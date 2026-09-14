const {
  MercadoLivreLiveServiceError,
  ensureLiveConfig,
  throwClientError,
  normalizeText,
} = require("./config");
const { requestJson, buildBearerHeader } = require("./httpClient");

function normalizeTokenPayload(payload = {}) {
  const expiresInSeconds = Number(payload.expires_in || 0);
  const expiresAtDate = new Date(
    Date.now() + Math.max(0, Number.isFinite(expiresInSeconds) ? expiresInSeconds * 1000 : 0)
  );

  return {
    accessToken: normalizeText(payload.access_token),
    refreshToken: normalizeText(payload.refresh_token),
    tokenType: normalizeText(payload.token_type),
    scope: normalizeText(payload.scope),
    expiresIn: Number.isFinite(expiresInSeconds) ? expiresInSeconds : 0,
    expiresAt: expiresAtDate.toISOString(),
  };
}

async function fetchMlUserProfile(accessToken) {
  const config = ensureLiveConfig();

  const payload = await requestJson(`${config.apiBaseUrl}/users/me`, {
    method: "GET",
    headers: {
      ...buildBearerHeader(accessToken),
    },
  });

  return {
    id: payload?.id ? String(payload.id) : null,
    nickname: payload?.nickname ? String(payload.nickname) : null,
    siteId: payload?.site_id ? String(payload.site_id) : null,
    raw: payload,
  };
}

async function exchangeAuthorizationCode(code) {
  const normalizedCode = normalizeText(code);

  if (!normalizedCode) {
    throwClientError("Codigo OAuth invalido.", 400);
  }

  const config = ensureLiveConfig();

  const payload = await requestJson(config.oauthTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: normalizedCode,
      redirect_uri: config.redirectUri,
    }),
  });

  return normalizeTokenPayload(payload);
}

async function refreshAccessToken(refreshToken) {
  const normalizedRefreshToken = normalizeText(refreshToken);

  if (!normalizedRefreshToken) {
    throwClientError("Conta Mercado Livre sem refresh token valido.", 401);
  }

  const config = ensureLiveConfig();

  const payload = await requestJson(config.oauthTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: normalizedRefreshToken,
    }),
  });

  return normalizeTokenPayload(payload);
}

async function requestWithAutoRefresh(path, accountTokenSource = {}, options = {}) {
  const config = ensureLiveConfig();
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath.startsWith("/")) {
    throwClientError("Caminho da API Mercado Livre invalido.", 500);
  }

  const executeRequest = async (accessToken) => {
    return requestJson(`${config.apiBaseUrl}${normalizedPath}`, {
      method: options.method || "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...buildBearerHeader(accessToken),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  };

  const accessToken = normalizeText(accountTokenSource.accessToken);

  try {
    const payload = await executeRequest(accessToken);

    return {
      payload,
      tokenState: null,
    };
  } catch (error) {
    const shouldRefresh =
      error instanceof MercadoLivreLiveServiceError &&
      error.status === 401 &&
      normalizeText(accountTokenSource.refreshToken);

    if (!shouldRefresh) {
      throw error;
    }

    const refreshedToken = await refreshAccessToken(accountTokenSource.refreshToken);

    const payload = await executeRequest(refreshedToken.accessToken);

    return {
      payload,
      tokenState: refreshedToken,
    };
  }
}

function getAuthorizationUrl(payload = {}) {
  const config = ensureLiveConfig();

  const state = normalizeText(payload.state);

  if (!state) {
    throwClientError("State OAuth invalido.", 400);
  }

  const url = new URL(config.authBaseUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);

  if (payload.scope) {
    url.searchParams.set("scope", String(payload.scope));
  }

  return {
    mode: config.mode,
    authorizationUrl: url.toString(),
    state,
    redirectUri: config.redirectUri,
  };
}

async function completeAuthorizationCallback(query = {}) {
  const code = normalizeText(query.code);

  if (!code) {
    throwClientError("Authorization code nao recebido no callback OAuth.", 400);
  }

  const tokenPayload = await exchangeAuthorizationCode(code);
  const profile = await fetchMlUserProfile(tokenPayload.accessToken);

  if (!profile?.id) {
    throwClientError("Nao foi possivel identificar o seller do Mercado Livre.", 502);
  }

  return {
    connected: true,
    source: "mercado-livre-api",
    credentials: tokenPayload,
    account: {
      sellerId: profile.id,
      nickname: profile.nickname,
      siteId: profile.siteId,
    },
  };
}

module.exports = {
  exchangeAuthorizationCode,
  refreshAccessToken,
  requestWithAutoRefresh,
  getAuthorizationUrl,
  completeAuthorizationCallback,
};
