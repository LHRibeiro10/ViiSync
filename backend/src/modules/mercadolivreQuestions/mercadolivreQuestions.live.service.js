const { randomUUID } = require("crypto");

const DEFAULT_API_BASE_URL = "https://api.mercadolibre.com";
const DEFAULT_AUTH_BASE_URL = "https://auth.mercadolivre.com.br/authorization";

const pendingStates = new Map();
const dismissedIds = new Set();
const webhookEvents = [];
let runtimeOAuth = null;
let lastSyncAt = null;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function env(name, fallbackValue = "") {
  const value = process.env[name];

  if (value === undefined || value === null) {
    return fallbackValue;
  }

  return String(value).trim();
}

function mode() {
  const current = env("MERCADOLIVRE_API_MODE", "auto").toLowerCase();
  if (current === "live" || current === "mock" || current === "auto") return current;
  return "auto";
}

function apiBaseUrl() {
  return env("MERCADOLIVRE_API_BASE_URL", DEFAULT_API_BASE_URL);
}

function tokenSource() {
  if (runtimeOAuth && runtimeOAuth.accessToken) {
    return { ...runtimeOAuth };
  }

  const accessToken = env("MERCADOLIVRE_ACCESS_TOKEN");
  if (!accessToken) return null;

  return {
    accessToken,
    sellerId: env("MERCADOLIVRE_SELLER_ID") || null,
  };
}

function hasLiveCredentials() {
  return Boolean(tokenSource());
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function buildApiError(response, payload, fallbackMessage) {
  const status = Number(response?.status);
  const message =
    (payload && (payload.message || payload.error_description || payload.error)) ||
    fallbackMessage;

  if (status >= 400 && status < 500) {
    return createHttpError(400, message);
  }

  return createHttpError(500, message);
}

function pruneExpiredStates() {
  const now = Date.now();

  for (const [state, metadata] of pendingStates.entries()) {
    if (!metadata || now - metadata.createdAt > OAUTH_STATE_TTL_MS) {
      pendingStates.delete(state);
    }
  }
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function meliRequest(pathname, options = {}) {
  const source = tokenSource();
  if (!source || !source.accessToken) {
    throw createHttpError(
      400,
      "Configure MERCADOLIVRE_ACCESS_TOKEN para usar integracao real."
    );
  }

  const url = new URL(pathname.startsWith("/") ? pathname : `/${pathname}`, apiBaseUrl());
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${source.accessToken}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const message =
      (payload && (payload.message || payload.error_description || payload.error)) ||
      `Erro Mercado Livre (${response.status})`;
    throw createHttpError(response.status >= 400 && response.status < 500 ? 400 : 500, message);
  }

  return payload;
}

async function resolveSellerId() {
  const source = tokenSource();
  if (source && source.sellerId) return source.sellerId;
  const me = await meliRequest("/users/me");
  if (!me || !me.id) {
    throw createHttpError(400, "Nao foi possivel resolver seller_id no Mercado Livre.");
  }
  return String(me.id);
}

function normalizeQuestion(raw) {
  const answer = raw && typeof raw.answer === "object" ? raw.answer : null;
  const answered = Boolean((answer && answer.text) || raw.answer_text);
  return {
    id: String(raw.id),
    itemId: String(raw.item_id || raw.itemId || ""),
    itemTitle: raw.item_title || `Anuncio ${raw.item_id || raw.itemId || ""}`,
    questionText: raw.text || raw.questionText || "",
    answerText: raw.answer_text || (answer && answer.text) || null,
    status: answered ? "answered" : "unanswered",
    isAnswered: answered,
    canDismiss: answered,
    statusLabel: answered ? "Respondida" : "Nao respondida",
    statusTone: answered ? "answered" : "pending",
    createdAt: raw.date_created || raw.createdAt || new Date().toISOString(),
    answeredAt: (answer && (answer.date_created || answer.dateCreated)) || null,
    buyerNickname:
      (raw.from && (raw.from.nickname || raw.from.id)) || raw.buyer_nickname || "Comprador",
    thumbnail: raw.thumbnail || null,
    sku: raw.sku || null,
    isUrgent: false,
    needsAttention: false,
    openDurationLabel: null,
    answerDelayLabel: null,
  };
}

async function listQuestions() {
  const sellerId = await resolveSellerId();
  const payload = await meliRequest("/questions/search", {
    query: {
      seller_id: sellerId,
      limit: 50,
      offset: 0,
    },
  });
  const rows = Array.isArray(payload.questions) ? payload.questions : [];
  const items = rows.map(normalizeQuestion).filter((q) => !dismissedIds.has(q.id));
  lastSyncAt = new Date().toISOString();
  return {
    items,
    meta: {
      filters: { status: "all", period: "30d", sort: "recent", itemId: "all", search: "" },
      total: items.length,
      filteredTotal: items.length,
      overview: {
        total: items.length,
        answered: items.filter((q) => q.isAnswered).length,
        unanswered: items.filter((q) => !q.isAnswered).length,
        urgent: 0,
        averageResponseHours: 0,
        responseRate: items.length
          ? items.filter((q) => q.isAnswered).length / items.length
          : 0,
      },
      availableAnnouncements: [],
      announcementCount: 0,
      lastSyncAt,
      source: "mercado-livre-api",
    },
  };
}

async function getQuestionById(questionId) {
  const payload = await listQuestions();
  const question = payload.items.find((item) => item.id === String(questionId));
  if (!question) throw createHttpError(404, "Pergunta nao encontrada.");
  return {
    question: {
      ...question,
      replyAllowed: !question.isAnswered,
      timeline: [
        {
          id: `${question.id}-question`,
          label: "Pergunta recebida",
          timestamp: question.createdAt,
          description: `${question.buyerNickname} enviou a pergunta.`,
        },
      ],
      suggestedReplies: [
        "Sim, temos esse detalhe confirmado.",
        "Posso confirmar envio e garantia para voce.",
        "Se quiser, valido compatibilidade agora.",
      ],
    },
    meta: {
      lastSyncAt,
      source: "mercado-livre-api",
    },
  };
}

async function replyQuestion(questionId, text) {
  const answer = String(text || "").trim();
  if (answer.length < 8) {
    throw createHttpError(400, "A resposta deve ter pelo menos 8 caracteres.");
  }

  await meliRequest("/answers", {
    method: "POST",
    body: { question_id: String(questionId), text: answer },
  });

  return {
    message: "Resposta enviada com sucesso para o Mercado Livre.",
    ...(await getQuestionById(questionId)),
  };
}

async function dismissQuestion(questionId, filters = {}) {
  dismissedIds.add(String(questionId));
  return {
    ...(await listQuestions(filters)),
    message: "Pergunta removida da lista visivel.",
  };
}

async function dismissAnsweredQuestions(filters = {}) {
  const payload = await listQuestions(filters);
  payload.items.filter((item) => item.isAnswered).forEach((item) => dismissedIds.add(item.id));
  return {
    ...(await listQuestions(filters)),
    message: "Perguntas respondidas removidas da lista.",
  };
}

async function refreshQuestions(filters = {}) {
  return {
    ...(await listQuestions(filters)),
    message: "Perguntas atualizadas a partir da API do Mercado Livre.",
  };
}

async function syncQuestions(filters = {}) {
  return {
    ...(await listQuestions(filters)),
    message: "Sincronizacao concluida com a API do Mercado Livre.",
  };
}

function getAuthorizationUrl(payload = {}) {
  const clientId = env("MERCADOLIVRE_CLIENT_ID");
  const redirectUri = env("MERCADOLIVRE_REDIRECT_URI");
  if (!clientId || !redirectUri) {
    throw createHttpError(
      400,
      "Defina MERCADOLIVRE_CLIENT_ID e MERCADOLIVRE_REDIRECT_URI para iniciar OAuth."
    );
  }
  pruneExpiredStates();
  const state = randomUUID();
  pendingStates.set(state, { createdAt: Date.now(), payload });
  const url = new URL(env("MERCADOLIVRE_AUTH_BASE_URL", DEFAULT_AUTH_BASE_URL));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return { authorizationUrl: url.toString(), state };
}

async function completeAuthorizationCallback(query = {}) {
  if (query.error) throw createHttpError(400, query.error_description || "OAuth cancelado.");
  const state = String(query.state || "");
  const code = String(query.code || "");
  pruneExpiredStates();
  if (!state || !code) throw createHttpError(400, "Callback OAuth invalido.");
  if (!pendingStates.has(state)) throw createHttpError(400, "State OAuth invalido.");

  const clientId = env("MERCADOLIVRE_CLIENT_ID");
  const clientSecret = env("MERCADOLIVRE_CLIENT_SECRET");
  const redirectUri = env("MERCADOLIVRE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) {
    throw createHttpError(400, "Credenciais OAuth incompletas.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const response = await fetch(env("MERCADOLIVRE_OAUTH_TOKEN_URL", `${apiBaseUrl()}/oauth/token`), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const payload = await parseResponseBody(response);
  if (!response.ok) throw buildApiError(response, payload, "Falha no OAuth Mercado Livre.");
  pendingStates.delete(state);
  runtimeOAuth = {
    accessToken: payload.access_token || null,
    sellerId: payload.user_id ? String(payload.user_id) : null,
  };
  if (!runtimeOAuth.accessToken) {
    throw createHttpError(
      500,
      "OAuth retornou sem access_token. Verifique escopos e configuracao do app no Mercado Livre."
    );
  }
  return {
    connected: true,
    mode: "oauth",
    account: { sellerId: runtimeOAuth.sellerId },
    persistence: { persisted: false, reason: "Sessao em memoria (runtime)." },
  };
}

async function receiveWebhook(payload = {}) {
  const eventId = payload.id || randomUUID();
  webhookEvents.unshift({
    id: eventId,
    topic: payload.topic || "questions",
    resource: payload.resource || null,
    receivedAt: new Date().toISOString(),
  });
  if (webhookEvents.length > 20) webhookEvents.length = 20;
  return {
    received: true,
    mode: hasLiveCredentials() ? "live" : "mock",
    eventId,
    queued: false,
    latestEvents: webhookEvents.slice(0, 5).map((event) => ({ ...event })),
  };
}

async function getIntegrationStatus() {
  const source = tokenSource();
  return {
    mode: mode(),
    usingLive: mode() === "live" || (mode() === "auto" && Boolean(source)),
    hasCredentials: Boolean(source),
    source: source ? (runtimeOAuth ? "oauth-runtime" : "env") : "none",
    account: source ? { sellerId: source.sellerId || null } : null,
    instructions: source
      ? null
      : "Conecte via OAuth ou configure MERCADOLIVRE_ACCESS_TOKEN no backend/.env.",
  };
}

module.exports = {
  completeAuthorizationCallback,
  dismissAnsweredQuestions,
  dismissQuestion,
  getAuthorizationUrl,
  getIntegrationStatus,
  hasLiveCredentials,
  listQuestions,
  mode,
  receiveWebhook,
  refreshQuestions,
  replyQuestion,
  syncQuestions,
  getQuestionById,
};
