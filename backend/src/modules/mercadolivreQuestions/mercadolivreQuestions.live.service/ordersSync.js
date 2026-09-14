const { normalizeText, throwClientError } = require("./config");
const { mapOrderEntry, resolveItemThumbnail, buildItemSku } = require("./mappers");
const { resolveSyncRange, isOrderInsideRange } = require("./syncRange");
const { requestWithAutoRefresh } = require("./oauth");
const { fetchItemsByIds } = require("./itemsSync");

const DEFAULT_SYNC_MAX_RESULTS = 500;
const MAX_SYNC_RESULTS = 1000;

async function fetchOrderById(orderId, accountTokenSource = {}) {
  const normalizedOrderId = normalizeText(orderId);

  if (!normalizedOrderId) {
    return null;
  }

  const { payload, tokenState } = await requestWithAutoRefresh(
    `/orders/${encodeURIComponent(normalizedOrderId)}`,
    accountTokenSource,
    {
      method: "GET",
    }
  );

  return {
    payload,
    tokenState,
  };
}

async function pullOrdersFromApi(accountTokenSource = {}, options = {}) {
  const sellerId = normalizeText(accountTokenSource.sellerId);

  if (!sellerId) {
    throwClientError("Conta Mercado Livre sem sellerId para sincronizar pedidos.", 400);
  }

  const syncRange = resolveSyncRange(options);
  const pageLimit = Math.max(1, Math.min(Number(options.limit) || 50, 50));
  const recommendedMaxResults =
    syncRange.totalDays > 180
      ? MAX_SYNC_RESULTS
      : syncRange.totalDays > 90
      ? 750
      : DEFAULT_SYNC_MAX_RESULTS;
  const maxResults = Math.max(
    pageLimit,
    Math.min(Number(options.maxResults) || recommendedMaxResults, MAX_SYNC_RESULTS)
  );

  const orders = [];
  let latestTokenState = null;
  let offset = 0;
  let shouldContinue = true;

  while (shouldContinue && offset < maxResults) {
    const currentLimit = Math.min(pageLimit, maxResults - offset);
    const searchPath = `/orders/search?seller=${encodeURIComponent(
      sellerId
    )}&sort=date_desc&limit=${currentLimit}&offset=${offset}`;
    const { payload, tokenState } = await requestWithAutoRefresh(
      searchPath,
      {
        ...accountTokenSource,
        ...(latestTokenState
          ? {
              accessToken: latestTokenState.accessToken,
              refreshToken: latestTokenState.refreshToken,
            }
          : {}),
      },
      {
        method: "GET",
      }
    );

    if (tokenState) {
      latestTokenState = tokenState;
    }

    const rawResults = Array.isArray(payload?.results) ? payload.results : [];
    if (!rawResults.length) {
      break;
    }

    let oldestOrderInBatchTimestamp = Number.POSITIVE_INFINITY;

    for (const entry of rawResults) {
      const orderId =
        entry && typeof entry === "object" && entry.id
          ? normalizeText(entry.id)
          : normalizeText(entry);

      if (!orderId) {
        continue;
      }

      let mappedOrder = null;

      if (
        entry &&
        typeof entry === "object" &&
        entry.id &&
        Array.isArray(entry.order_items) &&
        entry.order_items.length
      ) {
        mappedOrder = mapOrderEntry(entry);
      } else {
        try {
          const orderResult = await fetchOrderById(orderId, {
            ...accountTokenSource,
            ...(latestTokenState
              ? {
                  accessToken: latestTokenState.accessToken,
                  refreshToken: latestTokenState.refreshToken,
                }
              : {}),
          });

          if (orderResult?.tokenState) {
            latestTokenState = orderResult.tokenState;
          }

          if (orderResult?.payload) {
            mappedOrder = mapOrderEntry(orderResult.payload);
          }
        } catch {
          // Mantem a sincronizacao resiliente quando um pedido isolado nao puder ser carregado.
        }
      }

      if (!mappedOrder) {
        continue;
      }

      const saleTimestamp = new Date(mappedOrder.saleDate || mappedOrder.createdAt || 0).getTime();
      if (Number.isFinite(saleTimestamp) && saleTimestamp < oldestOrderInBatchTimestamp) {
        oldestOrderInBatchTimestamp = saleTimestamp;
      }

      if (isOrderInsideRange(mappedOrder, syncRange)) {
        orders.push(mappedOrder);
      }
    }

    offset += rawResults.length;

    if (rawResults.length < currentLimit) {
      shouldContinue = false;
      continue;
    }

    if (
      Number.isFinite(oldestOrderInBatchTimestamp) &&
      oldestOrderInBatchTimestamp < syncRange.startDate.getTime()
    ) {
      shouldContinue = false;
    }
  }

  const itemIds = Array.from(
    new Set(
      orders
        .flatMap((order) => (Array.isArray(order?.items) ? order.items : []))
        .map((item) => normalizeText(item?.marketplaceItemId))
        .filter(Boolean)
    )
  );
  let itemDetailsById = new Map();

  if (itemIds.length) {
    const itemDetailsResult = await fetchItemsByIds(itemIds, {
      ...accountTokenSource,
      ...(latestTokenState
        ? {
            accessToken: latestTokenState.accessToken,
            refreshToken: latestTokenState.refreshToken,
          }
        : {}),
    });

    itemDetailsById = itemDetailsResult?.itemsById || new Map();
    if (itemDetailsResult?.tokenState) {
      latestTokenState = itemDetailsResult.tokenState;
    }
  }

  const enrichedOrders = orders.map((order) => {
    const enrichedItems = (order.items || []).map((item) => {
      const marketplaceItemId = normalizeText(item?.marketplaceItemId);
      const itemDetails = marketplaceItemId
        ? itemDetailsById.get(marketplaceItemId)
        : null;

      return {
        ...item,
        title: normalizeText(itemDetails?.title) || item.title,
        thumbnail:
          resolveItemThumbnail(itemDetails || {}) ||
          item.thumbnail ||
          null,
        sku: buildItemSku(itemDetails || {}) || item.sku || null,
      };
    });

    return {
      ...order,
      items: enrichedItems,
    };
  });

  return {
    items: enrichedOrders,
    meta: {
      source: "mercado-livre-api",
      total: enrichedOrders.length,
      lastSyncAt: new Date().toISOString(),
      range: {
        startDate: syncRange.startDateOnly,
        endDate: syncRange.endDateOnly,
        totalDays: syncRange.totalDays,
      },
      tokenState: latestTokenState || null,
    },
  };
}

module.exports = {
  fetchOrderById,
  pullOrdersFromApi,
};
