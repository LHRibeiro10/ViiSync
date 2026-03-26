const DEFAULT_MODE = "auto";
const VALID_MODES = new Set(["mock", "auto", "live"]);
const DEFAULT_API_BASE_URL = "https://api.mercadolibre.com";
const DEFAULT_AUTH_BASE_URL = "https://auth.mercadolivre.com.br/authorization";
const DEFAULT_OAUTH_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_SYNC_MAX_RESULTS = 500;
const MAX_SYNC_RESULTS = 1000;
const { buildCustomRange, resolvePeriodRange } = require("../../lib/period");

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

function selectBestNumericValue(candidates = []) {
  const parsed = candidates
    .map((value) => parseOptionalNumber(value))
    .filter((value) => value !== null);

  if (!parsed.length) {
    return { found: false, value: 0 };
  }

  const positive = parsed.filter((value) => value > 0);
  if (positive.length) {
    return { found: true, value: Math.max(...positive) };
  }

  return { found: true, value: parsed[0] };
}

function sumNumericValues(candidates = []) {
  let found = false;
  let total = 0;

  for (const candidate of candidates) {
    const parsed = parseOptionalNumber(candidate);
    if (parsed === null) {
      continue;
    }

    found = true;
    total += parsed;
  }

  return {
    found,
    value: found ? total : 0,
  };
}

function resolveItemThumbnail(item = {}) {
  const pictures = Array.isArray(item?.pictures) ? item.pictures : [];
  const pictureUrls = pictures.flatMap((picture) => [
    picture?.secure_url,
    picture?.url,
  ]);

  const attributes = Array.isArray(item?.attributes) ? item.attributes : [];
  const attributeImageUrls = attributes
    .filter((attribute) =>
      ["MAIN_PICTURE", "PICTURE", "IMAGE", "THUMBNAIL"].includes(
        String(attribute?.id || "").toUpperCase()
      )
    )
    .flatMap((attribute) => [attribute?.value_name, attribute?.value_id]);

  const [bestImage] = [
    item?.picture_url,
    item?.secure_thumbnail,
    item?.thumbnail,
    ...pictureUrls,
    ...attributeImageUrls,
  ]
    .map((value) => normalizeImageUrl(value))
    .filter(Boolean);

  return bestImage || null;
}

function resolveMarketplaceFeeInfo(payments = []) {
  const paymentRows = Array.isArray(payments) ? payments : [];
  let found = false;
  let total = 0;

  for (const payment of paymentRows) {
    const direct = selectBestNumericValue([
      payment?.marketplace_fee,
      payment?.marketplace_fee_amount,
      payment?.sale_fee,
      payment?.fee_amount,
    ]);

    const feeDetails = Array.isArray(payment?.fee_details)
      ? payment.fee_details.reduce((sum, feeDetail) => {
          const type = String(
            feeDetail?.type || feeDetail?.fee_type || ""
          ).toLowerCase();
          const shouldUse =
            !type ||
            type.includes("market") ||
            type.includes("sale") ||
            type.includes("fee") ||
            type.includes("financing");

          if (!shouldUse) {
            return sum;
          }

          const amount = parseOptionalNumber(
            feeDetail?.amount !== undefined
              ? feeDetail.amount
              : feeDetail?.cost
          );
          return amount === null ? sum : sum + amount;
        }, 0)
      : null;

    const hasFeeDetails = Number.isFinite(feeDetails);

    if (direct.found) {
      found = true;
      total += direct.value;
      continue;
    }

    if (hasFeeDetails) {
      found = true;
      total += Number(feeDetails);
    }
  }

  return {
    found,
    value: found ? total : 0,
  };
}

function resolveShippingFeeInfo(order = {}, payments = []) {
  const direct = selectBestNumericValue([
    order?.shipping?.cost,
    order?.shipping?.base_cost,
    order?.shipping?.receiver_shipping_cost,
    order?.shipping?.list_cost,
    order?.shipping_cost,
  ]);

  const fromPayments = sumNumericValues(
    (Array.isArray(payments) ? payments : []).flatMap((payment) => [
      payment?.shipping_cost,
      payment?.shipping_amount,
    ])
  );

  if (direct.found) {
    return direct;
  }

  if (fromPayments.found) {
    return fromPayments;
  }

  return {
    found: false,
    value: 0,
  };
}

function resolveDiscountAmountInfo(order = {}) {
  const couponAmount = parseOptionalNumber(order?.coupon?.amount);
  const orderDiscountAmount = parseOptionalNumber(order?.discount_amount);
  const shippingDiscount = parseOptionalNumber(order?.shipping?.discounts);
  const direct = [couponAmount, orderDiscountAmount, shippingDiscount].filter(
    (value) => value !== null
  );

  if (!direct.length) {
    return { found: false, value: 0 };
  }

  return {
    found: true,
    value: direct.reduce((sum, value) => sum + value, 0),
  };
}

function resolveTaxAmountInfo(order = {}, payments = []) {
  const orderTax = selectBestNumericValue([
    order?.tax_amount,
    order?.taxes?.amount,
    order?.taxes_amount,
  ]);
  const paymentTaxes = sumNumericValues(
    (Array.isArray(payments) ? payments : []).flatMap((payment) => [
      payment?.taxes_amount,
      payment?.tax_amount,
    ])
  );

  if (orderTax.found && paymentTaxes.found) {
    return {
      found: true,
      value: Math.max(orderTax.value, paymentTaxes.value),
    };
  }

  if (orderTax.found) {
    return orderTax;
  }

  if (paymentTaxes.found) {
    return paymentTaxes;
  }

  return {
    found: false,
    value: 0,
  };
}

function resolveSyncRange(options = {}) {
  const hasDateOverrides = Boolean(options?.startDate || options?.endDate);

  if (hasDateOverrides) {
    try {
      return buildCustomRange(options.startDate, options.endDate, { strict: true });
    } catch (error) {
      throwClientError(
        error?.message || "Intervalo de datas invalido para sincronizacao.",
        400
      );
    }
  }

  try {
    return resolvePeriodRange(options?.period || "30d", {
      fallbackPeriod: "30d",
      strict: true,
    });
  } catch (error) {
    throwClientError(error?.message || "Periodo invalido para sincronizacao.", 400);
  }
}

function isOrderInsideRange(order = {}, range = null) {
  if (!range || !range.startDate || !range.endDate) {
    return true;
  }

  const saleTimestamp = new Date(order?.saleDate || order?.createdAt || 0).getTime();

  if (!Number.isFinite(saleTimestamp)) {
    return false;
  }

  return (
    saleTimestamp >= range.startDate.getTime() &&
    saleTimestamp <= range.endDate.getTime()
  );
}

function buildItemSku(item = {}) {
  if (item.seller_custom_field) {
    return String(item.seller_custom_field);
  }

  if (item.seller_sku) {
    return String(item.seller_sku);
  }

  const attributes = Array.isArray(item.attributes) ? item.attributes : [];
  const skuAttribute = attributes.find((attribute) =>
    ["SELLER_SKU", "SKU"].includes(String(attribute?.id || "").toUpperCase())
  );

  return skuAttribute?.value_name ? String(skuAttribute.value_name) : null;
}

function chunkArray(items = [], size = 20) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
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

function mapQuestion(question = {}, itemData = {}) {
  const answerText = normalizeText(question?.answer?.text || "") || null;
  const answeredAt = toIsoDateOrNull(question?.answer?.date_created || question?.answer?.date_created_from);
  const createdAt =
    toIsoDateOrNull(question?.date_created || question?.created_at) || new Date().toISOString();

  return {
    id: normalizeText(question?.id),
    itemId: normalizeText(question?.item_id),
    itemTitle:
      normalizeText(itemData?.title) ||
      normalizeText(question?.item_title) ||
      `Anuncio ${normalizeText(question?.item_id)}`,
    questionText: normalizeText(question?.text),
    answerText,
    createdAt,
    answeredAt,
    buyerNickname:
      normalizeText(question?.from?.nickname) ||
      (question?.from?.id ? `Comprador ${question.from.id}` : "Comprador"),
    thumbnail: resolveItemThumbnail(itemData),
    sku: buildItemSku(itemData),
    rawPayload: question,
  };
}

function mapOrderEntry(order = {}) {
  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const marketplaceFeeInfo = resolveMarketplaceFeeInfo(payments);
  const shippingFeeInfo = resolveShippingFeeInfo(order, payments);
  const discountAmountInfo = resolveDiscountAmountInfo(order);
  const taxAmountInfo = resolveTaxAmountInfo(order, payments);
  const totalAmount = toNumber(order.total_amount || order.paid_amount, 0);

  return {
    id: normalizeText(order?.id),
    status: normalizeText(order?.status) || "EM_PROCESSAMENTO",
    saleDate:
      toIsoDateOrNull(order?.date_created || order?.date_closed || order?.last_updated) ||
      new Date().toISOString(),
    buyerName: normalizeText(order?.buyer?.nickname) || "Comprador",
    totalAmount,
    marketplaceFee: marketplaceFeeInfo.found ? marketplaceFeeInfo.value : null,
    marketplaceFeeDataFound: marketplaceFeeInfo.found,
    shippingFee: shippingFeeInfo.found ? shippingFeeInfo.value : null,
    shippingFeeDataFound: shippingFeeInfo.found,
    discountAmount: discountAmountInfo.found ? discountAmountInfo.value : null,
    discountAmountDataFound: discountAmountInfo.found,
    taxAmount: taxAmountInfo.found ? taxAmountInfo.value : null,
    taxAmountDataFound: taxAmountInfo.found,
    netReceived:
      totalAmount -
      (marketplaceFeeInfo.found ? marketplaceFeeInfo.value : 0) -
      (shippingFeeInfo.found ? shippingFeeInfo.value : 0) -
      (discountAmountInfo.found ? discountAmountInfo.value : 0) -
      (taxAmountInfo.found ? taxAmountInfo.value : 0),
    items: orderItems.map((entry) => {
      const quantity = toNumber(entry?.quantity, 0);
      const unitPrice = toNumber(entry?.unit_price ?? entry?.full_unit_price, 0);
      const fullUnitPrice = parseOptionalNumber(entry?.full_unit_price);
      const lineTotal = Number.isFinite(fullUnitPrice)
        ? toNumber(fullUnitPrice * quantity, quantity * unitPrice)
        : quantity * unitPrice;
      const taxPercent = parseOptionalNumber(
        entry?.tax_percent ??
          entry?.taxes?.percentage ??
          entry?.item?.tax_percent ??
          entry?.item?.taxes?.percentage
      );
      const taxAmount = parseOptionalNumber(
        entry?.tax_amount ?? entry?.taxes?.amount
      );
      const unitCost = parseOptionalNumber(
        entry?.unit_cost ?? entry?.cost ?? entry?.item?.unit_cost
      );
      const extraCost = parseOptionalNumber(
        entry?.extra_cost ?? entry?.extraCost
      );
      const marketplaceItemId = normalizeText(entry?.item?.id);
      const itemData = entry?.item || {};

      return {
        marketplaceItemId,
        title: normalizeText(itemData?.title) || "Item sem titulo",
        thumbnail: resolveItemThumbnail(itemData),
        sku:
          buildItemSku(itemData) ||
          normalizeText(entry?.seller_sku) ||
          null,
        quantity,
        unitPrice,
        totalPrice: toNumber(lineTotal, quantity * unitPrice),
        taxPercent,
        taxAmount,
        unitCost,
        extraCost,
      };
    }),
    rawPayload: order,
  };
}

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

function mapItemEntry(item = {}) {
  return {
    id: normalizeText(item?.id),
    title: normalizeText(item?.title) || "Item sem titulo",
    price: toNumber(item?.price, 0),
    status: normalizeText(item?.status) || "unknown",
    availableQuantity: Number(toNumber(item?.available_quantity, 0)),
    thumbnail: resolveItemThumbnail(item),
    category: normalizeText(item?.category_id) || null,
    sku: buildItemSku(item),
    rawPayload: item,
  };
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

async function pullQuestionsFromApi(accountTokenSource = {}) {
  const sellerId = normalizeText(accountTokenSource.sellerId);

  if (!sellerId) {
    throwClientError("Conta Mercado Livre sem sellerId para sincronizar perguntas.", 400);
  }

  const { payload, tokenState } = await requestWithAutoRefresh(
    `/questions/search?seller_id=${encodeURIComponent(sellerId)}&limit=50`,
    { ...accountTokenSource },
    {
      method: "GET",
    }
  );

  const questionsRaw = Array.isArray(payload?.questions) ? payload.questions : [];
  const itemIds = questionsRaw.map((question) => question?.item_id).filter(Boolean);

  const {
    itemsById,
    tokenState: tokenStateFromItems,
  } = await fetchItemsByIds(itemIds, {
    ...accountTokenSource,
    ...(tokenState ? { accessToken: tokenState.accessToken, refreshToken: tokenState.refreshToken } : {}),
  });

  const mappedItems = questionsRaw
    .map((question) => mapQuestion(question, itemsById.get(String(question?.item_id)) || {}))
    .filter((item) => item.id && item.itemId && item.questionText);

  return {
    items: mappedItems,
    meta: {
      source: "mercado-livre-api",
      total: mappedItems.length,
      lastSyncAt: new Date().toISOString(),
      tokenState: tokenStateFromItems || tokenState || null,
    },
  };
}

async function replyQuestion(questionId, answerText, accountTokenSource = {}) {
  const id = normalizeText(questionId);
  const text = normalizeText(answerText);

  if (!id || !text) {
    throwClientError("Pergunta ou resposta invalida.", 400);
  }

  const { tokenState } = await requestWithAutoRefresh(
    "/answers",
    { ...accountTokenSource },
    {
      method: "POST",
      body: {
        question_id: id,
        text,
      },
    }
  );

  return {
    sent: true,
    id,
    tokenState: tokenState || null,
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
  MercadoLivreLiveServiceError,
  completeAuthorizationCallback,
  exchangeAuthorizationCode,
  getAuthorizationUrl,
  hasLiveCredentials,
  mode,
  pullItemsFromApi,
  pullOrdersFromApi,
  pullQuestionsFromApi,
  refreshAccessToken,
  replyQuestion,
};
