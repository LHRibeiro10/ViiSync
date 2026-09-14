const { normalizeText, throwClientError } = require("./config");
const { chunkArray } = require("./shared");
const { mapItemEntry } = require("./mappers");
const { requestWithAutoRefresh } = require("./oauth");

async function fetchItemsByIds(itemIds = [], accountTokenSource = {}) {
  const normalizedItemIds = Array.from(
    new Set(
      itemIds
        .map((itemId) => normalizeText(itemId))
        .filter(Boolean)
    )
  );

  if (!normalizedItemIds.length) {
    return {
      itemsById: new Map(),
      tokenState: null,
    };
  }

  const chunks = chunkArray(normalizedItemIds, 20);
  const itemsById = new Map();
  let latestTokenState = null;

  for (const chunk of chunks) {
    const { payload, tokenState } = await requestWithAutoRefresh(
      `/items?ids=${encodeURIComponent(chunk.join(","))}`,
      accountTokenSource,
      {
        method: "GET",
      }
    );

    if (tokenState) {
      latestTokenState = tokenState;
      accountTokenSource.accessToken = tokenState.accessToken;
      accountTokenSource.refreshToken = tokenState.refreshToken;
    }

    const entries = Array.isArray(payload) ? payload : [];

    for (const entry of entries) {
      const body = entry?.body;
      const id = normalizeText(body?.id || entry?.id);

      if (!id) {
        continue;
      }

      itemsById.set(id, body || entry);
    }
  }

  return {
    itemsById,
    tokenState: latestTokenState,
  };
}

async function pullItemsFromApi(accountTokenSource = {}, options = {}) {
  const sellerId = normalizeText(accountTokenSource.sellerId);

  if (!sellerId) {
    throwClientError("Conta Mercado Livre sem sellerId para sincronizar anuncios.", 400);
  }

  const limit = Math.max(1, Math.min(Number(options.limit) || 100, 100));

  const { payload, tokenState } = await requestWithAutoRefresh(
    `/users/${encodeURIComponent(sellerId)}/items/search?limit=${limit}`,
    { ...accountTokenSource },
    {
      method: "GET",
    }
  );

  const itemIds = Array.isArray(payload?.results) ? payload.results : [];

  const {
    itemsById,
    tokenState: tokenStateFromItems,
  } = await fetchItemsByIds(itemIds, {
    ...accountTokenSource,
    ...(tokenState ? { accessToken: tokenState.accessToken, refreshToken: tokenState.refreshToken } : {}),
  });

  const items = Array.from(itemsById.values())
    .map((entry) => mapItemEntry(entry))
    .filter((entry) => entry.id);

  return {
    items,
    meta: {
      source: "mercado-livre-api",
      total: items.length,
      lastSyncAt: new Date().toISOString(),
      tokenState: tokenStateFromItems || tokenState || null,
    },
  };
}

module.exports = {
  fetchItemsByIds,
  pullItemsFromApi,
};
