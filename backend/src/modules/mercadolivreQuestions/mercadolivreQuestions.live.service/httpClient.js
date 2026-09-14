const {
  MercadoLivreLiveServiceError,
  getRequestTimeout,
  throwClientError,
  normalizeText,
} = require("./config");

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getRequestTimeout());

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error_description ||
        payload?.error ||
        `Falha ao chamar Mercado Livre (${response.status}).`;

      throw new MercadoLivreLiveServiceError(message, response.status, payload);
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new MercadoLivreLiveServiceError(
        "Tempo limite ao chamar a API do Mercado Livre.",
        504
      );
    }

    if (error instanceof MercadoLivreLiveServiceError) {
      throw error;
    }

    throw new MercadoLivreLiveServiceError(
      error?.message || "Erro ao chamar a API do Mercado Livre.",
      502
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildBearerHeader(accessToken) {
  const token = normalizeText(accessToken);

  if (!token) {
    throwClientError("Conta Mercado Livre sem access token valido.", 401);
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

module.exports = {
  requestJson,
  buildBearerHeader,
};
