const { randomUUID } = require("crypto");

const prisma = require("../../lib/prisma");
const { resolveSessionContextFromRequest } = require("../auth/auth.service");
const liveProvider = require("./mercadolivreQuestions.live.service");

const VALID_STATUSES = new Set(["all", "unanswered", "answered"]);
const VALID_PERIODS = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
  all: Number.POSITIVE_INFINITY,
};
const VALID_SORTS = new Set(["recent", "oldest"]);

const webhookEvents = [];
const lastSyncByUserId = new Map();
const oauthStateStore = new Map();
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

class MercadoLivreQuestionNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "MercadoLivreQuestionNotFoundError";
  }
}

class MercadoLivreQuestionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MercadoLivreQuestionValidationError";
  }
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeFilters(filters = {}) {
  const status = VALID_STATUSES.has(filters.status) ? filters.status : "all";
  const period = Object.hasOwn(VALID_PERIODS, filters.period) ? filters.period : "30d";
  const sort = VALID_SORTS.has(filters.sort) ? filters.sort : "recent";
  const itemId = String(filters.itemId ?? "all").trim() || "all";
  const search = String(filters.search ?? "").trim();

  return {
    status,
    period,
    sort,
    itemId,
    search,
  };
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hoursBetween(olderTimestamp, newerTimestamp) {
  const older = new Date(olderTimestamp).getTime();
  const newer = new Date(newerTimestamp).getTime();

  return Math.max((newer - older) / (1000 * 60 * 60), 0);
}

function formatDuration(hours) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return "agora";
  }

  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} min`;
  }

  if (hours < 24) {
    return `${Math.round(hours)} h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);

  if (remainingHours === 0) {
    return `${days} d`;
  }

  return `${days} d ${remainingHours} h`;
}

function ensureIsoDate(value, fallbackValue = null) {
  if (!value) {
    return fallbackValue;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackValue;
  }

  return parsed.toISOString();
}

function ensureDate(value, fallbackValue = null) {
  if (!value) {
    return fallbackValue;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackValue;
  }

  return parsed;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toNumber(value, fallbackValue = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }

  return parsed;
}

function cleanupExpiredOAuthStates(now = Date.now()) {
  for (const [state, payload] of oauthStateStore.entries()) {
    if (!payload?.expiresAtMs || payload.expiresAtMs <= now) {
      oauthStateStore.delete(state);
    }
  }
}

function createOAuthStatePayload(userId, account = null) {
  const state = randomUUID();
  const createdAtMs = Date.now();
  const expiresAtMs = createdAtMs + OAUTH_STATE_TTL_MS;

  oauthStateStore.set(state, {
    userId: String(userId),
    accountId: account?.id || null,
    accountName: account?.accountName || null,
    createdAtMs,
    expiresAtMs,
  });

  cleanupExpiredOAuthStates(createdAtMs);

  return {
    state,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

function consumeOAuthStatePayload(state) {
  const key = normalizeText(state);

  if (!key) {
    return null;
  }

  cleanupExpiredOAuthStates();

  const payload = oauthStateStore.get(key) || null;

  if (!payload) {
    return null;
  }

  oauthStateStore.delete(key);
  return payload;
}

function enrichQuestion(question) {
  const now = new Date().toISOString();
  const isAnswered = Boolean(question.answerText && question.answeredAt);
  const openHours = isAnswered ? null : hoursBetween(question.createdAt, now);
  const answerDelayHours = isAnswered
    ? hoursBetween(question.createdAt, question.answeredAt)
    : null;
  const isUrgent = !isAnswered && openHours >= 24;
  const needsAttention = !isAnswered && openHours >= 12;

  return {
    ...cloneData(question),
    status: isAnswered ? "answered" : "unanswered",
    isAnswered,
    canDismiss: isAnswered,
    isUrgent,
    needsAttention,
    statusLabel: isAnswered ? "Respondida" : "Nao respondida",
    statusTone: isAnswered ? "answered" : isUrgent ? "urgent" : "pending",
    openDurationHours: openHours,
    openDurationLabel: isAnswered ? null : formatDuration(openHours),
    answerDelayHours,
    answerDelayLabel: isAnswered ? formatDuration(answerDelayHours) : null,
  };
}

function toQuestionListItem(question) {
  return {
    id: question.id,
    itemId: question.itemId,
    itemTitle: question.itemTitle,
    questionText: question.questionText,
    answerText: question.answerText,
    status: question.status,
    isAnswered: question.isAnswered,
    canDismiss: question.canDismiss,
    statusLabel: question.statusLabel,
    statusTone: question.statusTone,
    createdAt: question.createdAt,
    answeredAt: question.answeredAt,
    buyerNickname: question.buyerNickname,
    thumbnail: question.thumbnail,
    sku: question.sku,
    isUrgent: question.isUrgent,
    needsAttention: question.needsAttention,
    openDurationLabel: question.openDurationLabel,
    answerDelayLabel: question.answerDelayLabel,
  };
}

function matchSearch(question, search) {
  if (!search) {
    return true;
  }

  const normalizedSearch = normalizeSearchText(search);
  const haystack = [
    question.id,
    question.itemId,
    question.itemTitle,
    question.questionText,
    question.answerText,
    question.buyerNickname,
    question.sku,
  ]
    .filter(Boolean)
    .join(" ");

  return normalizeSearchText(haystack).includes(normalizedSearch);
}

function matchStatus(question, status) {
  if (status === "all") {
    return true;
  }

  return question.status === status;
}

function matchItem(question, itemId) {
  if (!itemId || itemId === "all") {
    return true;
  }

  return question.itemId === itemId;
}

function matchPeriod(question, period) {
  const limitInHours = VALID_PERIODS[period] ?? VALID_PERIODS["30d"];

  if (!Number.isFinite(limitInHours)) {
    return true;
  }

  return hoursBetween(question.createdAt, new Date().toISOString()) <= limitInHours;
}

function sortQuestions(left, right, sort) {
  const leftTime = new Date(left.createdAt).getTime();
  const rightTime = new Date(right.createdAt).getTime();

  if (sort === "oldest") {
    return leftTime - rightTime;
  }

  return rightTime - leftTime;
}

function buildAvailableAnnouncements(questions) {
  const announcementMap = new Map();

  questions.forEach((question) => {
    const current = announcementMap.get(question.itemId) || {
      itemId: question.itemId,
      itemTitle: question.itemTitle,
      count: 0,
      unansweredCount: 0,
    };

    current.count += 1;

    if (!question.isAnswered) {
      current.unansweredCount += 1;
    }

    announcementMap.set(question.itemId, current);
  });

  return Array.from(announcementMap.values()).sort((left, right) =>
    String(left.itemTitle || "").localeCompare(String(right.itemTitle || ""))
  );
}

function buildOverview(questions) {
  const answeredQuestions = questions.filter((question) => question.isAnswered);
  const unansweredQuestions = questions.filter((question) => !question.isAnswered);
  const averageResponseHours =
    answeredQuestions.length > 0
      ? answeredQuestions.reduce(
          (accumulator, question) => accumulator + (question.answerDelayHours || 0),
          0
        ) / answeredQuestions.length
      : 0;

  return {
    total: questions.length,
    answered: answeredQuestions.length,
    unanswered: unansweredQuestions.length,
    urgent: unansweredQuestions.filter((question) => question.isUrgent).length,
    averageResponseHours,
    responseRate:
      questions.length > 0 ? answeredQuestions.length / questions.length : 0,
  };
}

function buildSuggestedReplies(question) {
  const genericReplies = [
    "Sim, temos esse detalhe confirmado no lote atual. Se quiser, tambem posso orientar sobre envio e garantia.",
    "Consigo te confirmar isso agora: o anuncio esta atualizado com as especificacoes do item e envio com nota fiscal.",
    "Se preferir, posso te passar a orientacao mais segura de compatibilidade e uso antes da compra.",
  ];

  const questionText = String(question.questionText || "").toLowerCase();

  if (questionText.includes("driver") || questionText.includes("software")) {
    return [
      "Sim. O item acompanha suporte para configuracao no Windows e funciona no modo plug and play para uso basico.",
      "Tem suporte de configuracao, sim. Se quiser, eu confirmo tambem os requisitos de compatibilidade antes da compra.",
      ...genericReplies,
    ].slice(0, 3);
  }

  if (questionText.includes("cor") || questionText.includes("vermelho")) {
    return [
      "No momento esse anuncio esta no SKU informado, mas posso verificar disponibilidade de outra variacao ou modelo equivalente.",
      "Hoje o anuncio ativo e esse, mas se voce quiser outra opcao eu consigo orientar qual modelo mais proximo atende melhor.",
      ...genericReplies,
    ].slice(0, 3);
  }

  if (questionText.includes("peso") || questionText.includes("suporta")) {
    return [
      "Sim. O limite de peso e o informado no anuncio e o produto segue com manual de montagem na caixa.",
      "Posso te confirmar o limite suportado e tambem as medidas completas do produto para evitar incompatibilidade.",
      ...genericReplies,
    ].slice(0, 3);
  }

  return genericReplies;
}

function buildQuestionDetail(question) {
  const enrichedQuestion = enrichQuestion(question);
  const timeline = [
    {
      id: `${enrichedQuestion.id}-question`,
      label: "Pergunta recebida",
      timestamp: enrichedQuestion.createdAt,
      description: `${enrichedQuestion.buyerNickname || "Cliente"} enviou a pergunta pelo anuncio.`,
    },
  ];

  if (enrichedQuestion.isAnswered) {
    timeline.push({
      id: `${enrichedQuestion.id}-answer`,
      label: "Resposta enviada",
      timestamp: enrichedQuestion.answeredAt,
      description: `Resposta publicada no Mercado Livre em ${enrichedQuestion.answerDelayLabel}.`,
    });
  }

  return {
    ...toQuestionListItem(enrichedQuestion),
    replyAllowed: !enrichedQuestion.isAnswered,
    timeline,
    suggestedReplies: buildSuggestedReplies(enrichedQuestion),
  };
}

function emptyQuestionsPayload(filters = {}, lastSyncAt = null) {
  return {
    items: [],
    meta: {
      filters: normalizeFilters(filters),
      total: 0,
      filteredTotal: 0,
      overview: {
        total: 0,
        answered: 0,
        unanswered: 0,
        urgent: 0,
        averageResponseHours: 0,
        responseRate: 0,
      },
      availableAnnouncements: [],
      announcementCount: 0,
      lastSyncAt,
      source: "database",
    },
  };
}

function buildQuestionsPayload(questions = [], filters = {}, lastSyncAt = null) {
  const resolvedFilters = normalizeFilters(filters);
  const visibleQuestions = questions
    .filter((question) => !question.dismissedAt)
    .map(enrichQuestion);
  const availableAnnouncements = buildAvailableAnnouncements(visibleQuestions);
  const filteredQuestions = visibleQuestions
    .filter((question) => matchStatus(question, resolvedFilters.status))
    .filter((question) => matchItem(question, resolvedFilters.itemId))
    .filter((question) => matchPeriod(question, resolvedFilters.period))
    .filter((question) => matchSearch(question, resolvedFilters.search))
    .sort((left, right) => sortQuestions(left, right, resolvedFilters.sort));

  return {
    items: filteredQuestions.map(toQuestionListItem),
    meta: {
      filters: resolvedFilters,
      total: visibleQuestions.length,
      filteredTotal: filteredQuestions.length,
      overview: buildOverview(visibleQuestions),
      availableAnnouncements,
      announcementCount: availableAnnouncements.length,
      lastSyncAt,
      source: "database",
    },
  };
}

function mercadoLivreAccountWhere(userId = null) {
  const where = {
    isActive: true,
    OR: [
      { marketplace: { contains: "mercado livre", mode: "insensitive" } },
      { marketplace: { contains: "mercadolivre", mode: "insensitive" } },
      { marketplace: { contains: "mercado", mode: "insensitive" } },
    ],
  };

  if (userId) {
    where.userId = userId;
  }

  return where;
}

async function resolveViewerUser(request = {}) {
  const sessionContext = await resolveSessionContextFromRequest(request);

  if (!sessionContext?.user?.id) {
    const error = new Error("Sessao invalida ou expirada.");
    error.status = 401;
    throw error;
  }

  const found = await prisma.user.findUnique({
    where: {
      id: sessionContext.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!found) {
    const error = new Error("Sessao invalida ou expirada.");
    error.status = 401;
    throw error;
  }

  return found;
}

async function resolveMercadoLivreAccount(userId) {
  if (!userId) {
    return null;
  }

  return prisma.marketplaceAccount.findFirst({
    where: mercadoLivreAccountWhere(userId),
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      userId: true,
      sellerId: true,
      accountName: true,
      accessToken: true,
      refreshToken: true,
      tokenType: true,
      scope: true,
      siteId: true,
      integrationStatus: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      marketplace: true,
      isActive: true,
    },
  });
}

async function resolveMercadoLivreAccountById(userId, accountId) {
  if (!userId || !accountId) {
    return null;
  }

  return prisma.marketplaceAccount.findFirst({
    where: {
      id: String(accountId),
      userId,
      ...mercadoLivreAccountWhere(),
    },
    select: {
      id: true,
      userId: true,
      sellerId: true,
      accountName: true,
      accessToken: true,
      refreshToken: true,
      tokenType: true,
      scope: true,
      siteId: true,
      integrationStatus: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      marketplace: true,
      isActive: true,
    },
  });
}

function buildAccountTokenSource(account) {
  if (!account?.accessToken) {
    return null;
  }

  return {
    accessToken: account.accessToken,
    refreshToken: account.refreshToken || null,
    sellerId: account.sellerId || null,
    accountId: account.id,
    accountName: account.accountName || null,
    tokenType: account.tokenType || null,
    scope: account.scope || null,
    siteId: account.siteId || null,
    tokenExpiresAt: account.tokenExpiresAt ? account.tokenExpiresAt.toISOString() : null,
    source: "database",
  };
}

function isTokenExpiringSoon(tokenExpiresAt) {
  if (!tokenExpiresAt) {
    return false;
  }

  const expiresAtMs = new Date(tokenExpiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  const nowMs = Date.now();
  return expiresAtMs - nowMs <= 1000 * 60 * 5;
}

async function persistAccountTokenState(account, tokenState = null, profile = null) {
  if (!account?.id) {
    return account;
  }

  const nextTokenState = tokenState || {};
  const tokenExpiresAt = ensureDate(nextTokenState.expiresAt, null);

  const updated = await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      accessToken: nextTokenState.accessToken || account.accessToken || null,
      refreshToken: nextTokenState.refreshToken || account.refreshToken || null,
      tokenType: nextTokenState.tokenType || account.tokenType || null,
      scope: nextTokenState.scope || account.scope || null,
      tokenExpiresAt,
      sellerId: profile?.sellerId || account.sellerId || null,
      accountName: profile?.nickname || account.accountName || "Conta Mercado Livre",
      siteId: profile?.siteId || account.siteId || null,
      integrationStatus: "connected",
      isActive: true,
    },
    select: {
      id: true,
      userId: true,
      sellerId: true,
      accountName: true,
      accessToken: true,
      refreshToken: true,
      tokenType: true,
      scope: true,
      siteId: true,
      integrationStatus: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      marketplace: true,
      isActive: true,
    },
  });

  return updated;
}

async function resolveOrCreateMercadoLivreAccount(userId, preferredAccountName = null) {
  if (!userId) {
    return null;
  }

  const trimmedPreferredName = normalizeText(preferredAccountName);

  if (trimmedPreferredName) {
    const existingByName = await prisma.marketplaceAccount.findFirst({
      where: {
        userId,
        ...mercadoLivreAccountWhere(),
        accountName: {
          equals: trimmedPreferredName,
          mode: "insensitive",
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        userId: true,
        sellerId: true,
        accountName: true,
        accessToken: true,
        refreshToken: true,
        tokenType: true,
        scope: true,
        siteId: true,
        integrationStatus: true,
        tokenExpiresAt: true,
        lastSyncedAt: true,
        marketplace: true,
        isActive: true,
      },
    });

    if (existingByName) {
      return existingByName;
    }
  }

  const existing = await resolveMercadoLivreAccount(userId);
  if (existing) {
    return existing;
  }

  return prisma.marketplaceAccount.create({
    data: {
      userId,
      marketplace: "Mercado Livre",
      accountName: trimmedPreferredName || "Conta Mercado Livre",
      isActive: true,
      integrationStatus: "disconnected",
    },
    select: {
      id: true,
      userId: true,
      sellerId: true,
      accountName: true,
      accessToken: true,
      refreshToken: true,
      tokenType: true,
      scope: true,
      siteId: true,
      integrationStatus: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      marketplace: true,
      isActive: true,
    },
  });
}

function mapQuestionRowToEntity(row) {
  if (!row) {
    return null;
  }

  return {
    databaseId: row.id,
    id: row.externalQuestionId,
    itemId: row.itemId || "",
    itemTitle: row.itemTitle || `Anuncio ${row.itemId || ""}`,
    questionText: row.questionText || "",
    answerText: row.answerText || null,
    createdAt: ensureIsoDate(row.createdAtMl, ensureIsoDate(row.createdAt, new Date().toISOString())),
    answeredAt: ensureIsoDate(row.answeredAtMl, null),
    buyerNickname: row.buyerNickname || "Comprador",
    thumbnail: row.thumbnail || null,
    sku: row.sku || null,
    status: row.status || (row.answerText ? "answered" : "unanswered"),
    dismissedAt: ensureIsoDate(row.dismissedAt, null),
  };
}

async function listStoredQuestionRows(userId, marketplaceAccountId) {
  if (!userId || !marketplaceAccountId) {
    return [];
  }

  return prisma.mercadoLivreQuestion.findMany({
    where: {
      userId,
      marketplaceAccountId,
    },
    orderBy: {
      createdAtMl: "desc",
    },
  });
}

async function findStoredQuestionRowByExternalId(
  userId,
  marketplaceAccountId,
  externalQuestionId
) {
  if (!userId || !marketplaceAccountId || !externalQuestionId) {
    return null;
  }

  return prisma.mercadoLivreQuestion.findUnique({
    where: {
      marketplaceAccountId_externalQuestionId: {
        marketplaceAccountId,
        externalQuestionId: String(externalQuestionId),
      },
    },
  });
}

function rememberLastSync(userId, lastSyncAt) {
  if (!userId || !lastSyncAt) {
    return;
  }

  lastSyncByUserId.set(userId, String(lastSyncAt));
}

async function resolveLastSyncAt(userId, marketplaceAccountId) {
  if (!userId || !marketplaceAccountId) {
    return null;
  }

  const fromMemory = lastSyncByUserId.get(userId);
  if (fromMemory) {
    return fromMemory;
  }

  const latest = await prisma.mercadoLivreQuestion.findFirst({
    where: {
      userId,
      marketplaceAccountId,
    },
    orderBy: {
      lastSyncedAt: "desc",
    },
    select: {
      lastSyncedAt: true,
    },
  });

  if (!latest?.lastSyncedAt) {
    return null;
  }

  return latest.lastSyncedAt.toISOString();
}

async function canUseLiveProvider(account) {
  const currentMode = liveProvider.mode();

  if (currentMode === "mock") {
    return false;
  }

  if (account?.accessToken) {
    return true;
  }

  if (currentMode === "live") {
    throw new MercadoLivreQuestionValidationError(
      "Modo live ativo, mas essa conta nao possui token OAuth valido."
    );
  }

  return false;
}

async function ensureLiveAccountToken(account) {
  if (!account?.id) {
    return account;
  }

  const canUseLive = await canUseLiveProvider(account);
  if (!canUseLive) {
    return account;
  }

  const shouldRefresh =
    !account.accessToken ||
    isTokenExpiringSoon(account.tokenExpiresAt) ||
    ensureDate(account.tokenExpiresAt, null) === null;

  if (!shouldRefresh || !account.refreshToken) {
    return account;
  }

  const refreshed = await liveProvider.refreshAccessToken(account.refreshToken);

  return persistAccountTokenState(account, refreshed);
}

function toQuestionUpsertData(question, syncTimestamp) {
  const externalQuestionId = String(question.id || "").trim();
  if (!externalQuestionId) {
    return null;
  }

  const createdAtMl = ensureDate(question.createdAt, new Date());
  const answeredAtMl = ensureDate(question.answeredAt, null);
  const answerText = question.answerText ? String(question.answerText).trim() : null;
  const isAnswered = Boolean(answerText && answeredAtMl);

  return {
    externalQuestionId,
    itemId: String(question.itemId || "").trim(),
    itemTitle: question.itemTitle ? String(question.itemTitle).trim() : null,
    questionText: String(question.questionText || "").trim(),
    answerText,
    buyerNickname: question.buyerNickname ? String(question.buyerNickname).trim() : null,
    thumbnail: question.thumbnail ? String(question.thumbnail).trim() : null,
    sku: question.sku ? String(question.sku).trim() : null,
    status: isAnswered ? "answered" : "unanswered",
    createdAtMl,
    answeredAtMl,
    lastSyncedAt: syncTimestamp,
    rawPayload: question,
  };
}

async function persistRemoteQuestions(userId, marketplaceAccountId, remoteQuestions, lastSyncAt) {
  const syncTimestamp = ensureDate(lastSyncAt, new Date()) || new Date();

  for (const remoteQuestion of remoteQuestions) {
    const payload = toQuestionUpsertData(remoteQuestion, syncTimestamp);
    if (!payload) {
      continue;
    }

    await prisma.mercadoLivreQuestion.upsert({
      where: {
        marketplaceAccountId_externalQuestionId: {
          marketplaceAccountId,
          externalQuestionId: payload.externalQuestionId,
        },
      },
      create: {
        userId,
        marketplaceAccountId,
        externalQuestionId: payload.externalQuestionId,
        itemId: payload.itemId,
        itemTitle: payload.itemTitle,
        questionText: payload.questionText,
        answerText: payload.answerText,
        buyerNickname: payload.buyerNickname,
        thumbnail: payload.thumbnail,
        sku: payload.sku,
        status: payload.status,
        createdAtMl: payload.createdAtMl,
        answeredAtMl: payload.answeredAtMl,
        lastSyncedAt: payload.lastSyncedAt,
        rawPayload: payload.rawPayload,
      },
      update: {
        itemId: payload.itemId,
        itemTitle: payload.itemTitle,
        questionText: payload.questionText,
        answerText: payload.answerText,
        buyerNickname: payload.buyerNickname,
        thumbnail: payload.thumbnail,
        sku: payload.sku,
        status: payload.status,
        createdAtMl: payload.createdAtMl,
        answeredAtMl: payload.answeredAtMl,
        lastSyncedAt: payload.lastSyncedAt,
        rawPayload: payload.rawPayload,
      },
    });
  }

  rememberLastSync(userId, syncTimestamp.toISOString());
}

async function pullAndPersistQuestions(user, account) {
  if (!user?.id) {
    return { synced: false, imported: 0, lastSyncAt: null };
  }

  if (!account?.id) {
    return { synced: false, imported: 0, lastSyncAt: null };
  }

  const accountWithFreshToken = await ensureLiveAccountToken(account);
  const usingLive = await canUseLiveProvider(accountWithFreshToken);
  if (!usingLive) {
    return {
      synced: false,
      imported: 0,
      lastSyncAt: await resolveLastSyncAt(user.id, account.id),
    };
  }

  const remotePayload = await liveProvider.pullQuestionsFromApi(
    buildAccountTokenSource(accountWithFreshToken)
  );
  const remoteQuestions = Array.isArray(remotePayload?.items) ? remotePayload.items : [];
  const syncTimestamp = ensureIsoDate(remotePayload?.meta?.lastSyncAt, new Date().toISOString());
  const tokenState = remotePayload?.meta?.tokenState || null;

  await persistRemoteQuestions(user.id, account.id, remoteQuestions, syncTimestamp);
  await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      lastSyncedAt: ensureDate(syncTimestamp, new Date()) || new Date(),
      integrationStatus: "connected",
      ...(tokenState
        ? {
            accessToken: tokenState.accessToken || undefined,
            refreshToken: tokenState.refreshToken || undefined,
            tokenType: tokenState.tokenType || undefined,
            scope: tokenState.scope || undefined,
            tokenExpiresAt: ensureDate(tokenState.expiresAt, null) || undefined,
          }
        : {}),
    },
  });

  return {
    synced: true,
    imported: remoteQuestions.length,
    lastSyncAt: syncTimestamp,
  };
}

async function buildQuestionsPayloadForUser(user, account, filters = {}) {
  if (!user?.id || !account?.id) {
    return emptyQuestionsPayload(filters, null);
  }

  const rows = await listStoredQuestionRows(user.id, account.id);
  const questions = rows.map(mapQuestionRowToEntity).filter(Boolean);
  const lastSyncAt = await resolveLastSyncAt(user.id, account.id);

  return buildQuestionsPayload(questions, filters, lastSyncAt);
}

async function listQuestions(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    return emptyQuestionsPayload(filters, null);
  }

  const payloadFromDb = await buildQuestionsPayloadForUser(user, account, filters);

  if (payloadFromDb.meta.total > 0) {
    return payloadFromDb;
  }

  try {
    const syncResult = await pullAndPersistQuestions(user, account);
    if (syncResult.synced) {
      return buildQuestionsPayloadForUser(user, account, filters);
    }
  } catch (error) {
    // Mantem fallback de listagem pelo banco quando o sync inicial nao for possivel.
  }

  return payloadFromDb;
}

async function getQuestionById(questionId, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  const row = await findStoredQuestionRowByExternalId(user.id, account.id, questionId);

  if (!row || row.dismissedAt) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  return {
    question: buildQuestionDetail(mapQuestionRowToEntity(row)),
    meta: {
      lastSyncAt: await resolveLastSyncAt(user.id, account.id),
      source: "database",
    },
  };
}

async function replyQuestion(questionId, answerText, request = {}) {
  const trimmedAnswer = String(answerText ?? "").trim();

  if (!trimmedAnswer) {
    throw new MercadoLivreQuestionValidationError("Informe a resposta da pergunta.");
  }

  if (trimmedAnswer.length < 8) {
    throw new MercadoLivreQuestionValidationError(
      "A resposta deve ter pelo menos 8 caracteres."
    );
  }

  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    throw new MercadoLivreQuestionValidationError(
      "Nenhuma conta do Mercado Livre encontrada para responder essa pergunta."
    );
  }

  const existingRow = await findStoredQuestionRowByExternalId(user.id, account.id, questionId);

  if (existingRow?.answerText && existingRow?.answeredAtMl) {
    throw new MercadoLivreQuestionValidationError("Essa pergunta ja foi respondida.");
  }

  const accountWithFreshToken = await ensureLiveAccountToken(account);
  const canReplyInLive = await canUseLiveProvider(accountWithFreshToken);

  if (!canReplyInLive) {
    throw new MercadoLivreQuestionValidationError(
      "Nao foi possivel responder na API do Mercado Livre porque nao ha credenciais live ativas."
    );
  }

  const replyResult = await liveProvider.replyQuestion(
    questionId,
    trimmedAnswer,
    buildAccountTokenSource(accountWithFreshToken)
  );
  const tokenState = replyResult?.tokenState || null;

  const syncedAt = new Date();

  if (existingRow) {
    await prisma.mercadoLivreQuestion.update({
      where: {
        id: existingRow.id,
      },
      data: {
        answerText: trimmedAnswer,
        answeredAtMl: syncedAt,
        status: "answered",
        dismissedAt: null,
        lastSyncedAt: syncedAt,
      },
    });
  } else {
    await prisma.mercadoLivreQuestion.create({
      data: {
        userId: user.id,
        marketplaceAccountId: account.id,
        externalQuestionId: String(questionId),
        itemId: "",
        itemTitle: null,
        questionText: "",
        answerText: trimmedAnswer,
        buyerNickname: null,
        thumbnail: null,
        sku: null,
        status: "answered",
        createdAtMl: syncedAt,
        answeredAtMl: syncedAt,
        lastSyncedAt: syncedAt,
      },
    });
  }

  rememberLastSync(user.id, syncedAt.toISOString());
  await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      lastSyncedAt: syncedAt,
      integrationStatus: "connected",
      ...(tokenState
        ? {
            accessToken: tokenState.accessToken || undefined,
            refreshToken: tokenState.refreshToken || undefined,
            tokenType: tokenState.tokenType || undefined,
            scope: tokenState.scope || undefined,
            tokenExpiresAt: ensureDate(tokenState.expiresAt, null) || undefined,
          }
        : {}),
    },
  });

  const updatedRow = await findStoredQuestionRowByExternalId(user.id, account.id, questionId);

  return {
    message: "Resposta enviada com sucesso para o Mercado Livre.",
    question: updatedRow
      ? buildQuestionDetail(mapQuestionRowToEntity(updatedRow))
      : null,
    meta: {
      lastSyncAt: await resolveLastSyncAt(user.id, account.id),
    },
  };
}

async function dismissQuestion(questionId, filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  const row = await findStoredQuestionRowByExternalId(user.id, account.id, questionId);
  if (!row) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  if (row.dismissedAt) {
    return {
      ...(await buildQuestionsPayloadForUser(user, account, filters)),
      message: "Essa pergunta ja foi removida da lista.",
    };
  }

  if (!row.answerText || !row.answeredAtMl) {
    throw new MercadoLivreQuestionValidationError(
      "So e possivel excluir da lista perguntas ja respondidas."
    );
  }

  await prisma.mercadoLivreQuestion.update({
    where: {
      id: row.id,
    },
    data: {
      dismissedAt: new Date(),
    },
  });

  return {
    ...(await buildQuestionsPayloadForUser(user, account, filters)),
    message: "Pergunta removida da lista visivel.",
  };
}

async function dismissAnsweredQuestions(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    return emptyQuestionsPayload(filters, null);
  }

  const dismissedAt = new Date();
  const result = await prisma.mercadoLivreQuestion.updateMany({
    where: {
      userId: user.id,
      marketplaceAccountId: account.id,
      dismissedAt: null,
      OR: [{ status: "answered" }, { answeredAtMl: { not: null } }],
    },
    data: {
      dismissedAt,
    },
  });

  if (!result.count) {
    return {
      ...(await buildQuestionsPayloadForUser(user, account, filters)),
      message: "Nenhuma pergunta respondida para remover neste recorte.",
    };
  }

  return {
    ...(await buildQuestionsPayloadForUser(user, account, filters)),
    message: `${result.count} pergunta(s) respondida(s) removida(s) da lista.`,
  };
}

async function refreshQuestions(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    return {
      ...emptyQuestionsPayload(filters, null),
      message: "Nenhuma conta do Mercado Livre encontrada.",
    };
  }

  const syncResult = await pullAndPersistQuestions(user, account);

  return {
    ...(await buildQuestionsPayloadForUser(user, account, filters)),
    message: syncResult.synced
      ? "Perguntas atualizadas a partir da API do Mercado Livre."
      : "Sem credenciais live ativas. Exibindo dados salvos no banco.",
  };
}

async function syncQuestions(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    return {
      ...emptyQuestionsPayload(filters, null),
      message: "Nenhuma conta do Mercado Livre encontrada.",
    };
  }

  const syncResult = await pullAndPersistQuestions(user, account);

  return {
    ...(await buildQuestionsPayloadForUser(user, account, filters)),
    message: syncResult.synced
      ? "Sincronizacao concluida com a API do Mercado Livre."
      : "Sem credenciais live ativas. Nao foi possivel sincronizar com a API.",
  };
}

async function upsertProductFromMarketplaceItem(userId, marketplaceAccountId, item, syncedAt) {
  const marketplaceProductId = normalizeText(item?.id);

  if (!userId || !marketplaceAccountId || !marketplaceProductId) {
    return null;
  }

  const title = normalizeText(item?.title) || `Item ${marketplaceProductId}`;
  const sku = normalizeText(item?.sku) || null;
  const listingPrice = toNumber(item?.price, 0);
  const listingStatus = normalizeText(item?.status) || "unknown";
  const availableQuantity = Math.max(0, Math.floor(toNumber(item?.availableQuantity, 0)));
  const thumbnail = normalizeText(item?.thumbnail) || null;
  const category = normalizeText(item?.category) || null;

  const existing = await prisma.product.findFirst({
    where: {
      userId,
      marketplaceAccountId,
      marketplaceProductId,
    },
    select: {
      id: true,
    },
  });

  if (existing?.id) {
    return prisma.product.update({
      where: {
        id: existing.id,
      },
      data: {
        title,
        sku,
        thumbnail,
        category,
        listingPrice: round2(listingPrice),
        listingStatus,
        availableQuantity,
        lastSyncedAt: syncedAt,
      },
      select: {
        id: true,
      },
    });
  }

  return prisma.product.create({
    data: {
      userId,
      marketplaceAccountId,
      marketplaceProductId,
      title,
      sku,
      thumbnail,
      category,
      listingPrice: round2(listingPrice),
      listingStatus,
      availableQuantity,
      lastSyncedAt: syncedAt,
    },
    select: {
      id: true,
    },
  });
}

async function ensureProductForOrderItem(userId, marketplaceAccountId, item = {}, syncedAt) {
  const marketplaceProductId = normalizeText(item.marketplaceItemId);

  if (!marketplaceProductId) {
    return null;
  }

  const existing = await prisma.product.findFirst({
    where: {
      userId,
      marketplaceAccountId,
      marketplaceProductId,
    },
    select: {
      id: true,
    },
  });

  if (existing?.id) {
    await prisma.product.update({
      where: {
        id: existing.id,
      },
      data: {
        title: normalizeText(item.title) || undefined,
        sku: normalizeText(item.sku) || undefined,
        lastSyncedAt: syncedAt,
      },
    });

    return existing.id;
  }

  const created = await prisma.product.create({
    data: {
      userId,
      marketplaceAccountId,
      marketplaceProductId,
      title: normalizeText(item.title) || `Item ${marketplaceProductId}`,
      sku: normalizeText(item.sku) || null,
      listingPrice: round2(toNumber(item.unitPrice, 0)),
      listingStatus: "active",
      availableQuantity: 0,
      lastSyncedAt: syncedAt,
    },
    select: {
      id: true,
    },
  });

  return created.id;
}

async function persistRemoteOrders(user, account, remoteOrders = [], lastSyncAt = null) {
  const syncTimestamp = ensureDate(lastSyncAt, new Date()) || new Date();
  let imported = 0;

  for (const remoteOrder of remoteOrders) {
    const marketplaceOrderId = normalizeText(remoteOrder?.id);
    if (!marketplaceOrderId) {
      continue;
    }

    const saleDate =
      ensureDate(remoteOrder?.saleDate, null) ||
      ensureDate(remoteOrder?.createdAt, null) ||
      syncTimestamp;
    const totalAmount = round2(toNumber(remoteOrder?.totalAmount, 0));
    const marketplaceFee = round2(toNumber(remoteOrder?.marketplaceFee, 0));
    const shippingFee = round2(toNumber(remoteOrder?.shippingFee, 0));
    const discountAmount = round2(toNumber(remoteOrder?.discountAmount, 0));
    const taxAmount = round2(toNumber(remoteOrder?.taxAmount, 0));
    const netReceived = round2(
      toNumber(
        remoteOrder?.netReceived,
        totalAmount - marketplaceFee - shippingFee - discountAmount - taxAmount
      )
    );

    const existingOrder = await prisma.order.findFirst({
      where: {
        userId: user.id,
        marketplaceAccountId: account.id,
        marketplaceOrderId,
      },
      select: {
        id: true,
      },
    });

    const orderRecord = existingOrder?.id
      ? await prisma.order.update({
          where: {
            id: existingOrder.id,
          },
          data: {
            orderNumber: marketplaceOrderId,
            status: normalizeText(remoteOrder?.status) || "EM_PROCESSAMENTO",
            buyerName: normalizeText(remoteOrder?.buyerName) || "Comprador",
            saleDate,
            totalAmount,
            marketplaceFee,
            shippingFee,
            discountAmount,
            taxAmount,
            netReceived,
            cancelled: false,
          },
          select: {
            id: true,
          },
        })
      : await prisma.order.create({
          data: {
            userId: user.id,
            marketplaceAccountId: account.id,
            marketplaceOrderId,
            orderNumber: marketplaceOrderId,
            status: normalizeText(remoteOrder?.status) || "EM_PROCESSAMENTO",
            buyerName: normalizeText(remoteOrder?.buyerName) || "Comprador",
            saleDate,
            totalAmount,
            marketplaceFee,
            shippingFee,
            discountAmount,
            taxAmount,
            netReceived,
            cancelled: false,
          },
          select: {
            id: true,
          },
        });

    await prisma.orderItem.deleteMany({
      where: {
        orderId: orderRecord.id,
      },
    });

    const items = Array.isArray(remoteOrder?.items) ? remoteOrder.items : [];
    const grossBase = items.reduce((sum, item) => {
      return sum + round2(toNumber(item.totalPrice, toNumber(item.quantity, 0) * toNumber(item.unitPrice, 0)));
    }, 0);
    const fallbackShare = items.length ? 1 / items.length : 0;

    for (const item of items) {
      const quantity = Math.max(0, Math.floor(toNumber(item.quantity, 0)));
      if (!quantity) {
        continue;
      }

      const unitPrice = round2(toNumber(item.unitPrice, 0));
      const totalPrice = round2(toNumber(item.totalPrice, quantity * unitPrice));
      const share = grossBase > 0 ? totalPrice / grossBase : fallbackShare;
      const feeShare = round2(marketplaceFee * share);
      const shippingShare = round2(shippingFee * share);
      const discountShare = round2(discountAmount * share);
      const taxShare = round2(taxAmount * share);
      const grossRevenue = round2(totalPrice - discountShare);
      const unitCost = 0;
      const extraCost = 0;
      const profit = round2(grossRevenue - feeShare - shippingShare - taxShare);
      const marginPercent = grossRevenue ? round2((profit / grossRevenue) * 100) : 0;
      const roiPercent = 0;
      const productId = await ensureProductForOrderItem(
        user.id,
        account.id,
        item,
        syncTimestamp
      );

      await prisma.orderItem.create({
        data: {
          orderId: orderRecord.id,
          productId,
          marketplaceItemId: normalizeText(item.marketplaceItemId) || null,
          title: normalizeText(item.title) || "Item sem titulo",
          sku: normalizeText(item.sku) || null,
          quantity,
          unitPrice,
          totalPrice: grossRevenue,
          unitCost,
          extraCost,
          taxPercent: grossRevenue ? round2((taxShare / grossRevenue) * 100) : 0,
          profit,
          marginPercent,
          roiPercent,
        },
      });
    }

    imported += 1;
  }

  await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      lastSyncedAt: syncTimestamp,
      integrationStatus: "connected",
    },
  });

  return {
    imported,
    lastSyncAt: syncTimestamp.toISOString(),
  };
}

async function persistRemoteItems(user, account, remoteItems = [], lastSyncAt = null) {
  const syncTimestamp = ensureDate(lastSyncAt, new Date()) || new Date();
  let imported = 0;

  for (const item of remoteItems) {
    const upserted = await upsertProductFromMarketplaceItem(
      user.id,
      account.id,
      item,
      syncTimestamp
    );

    if (upserted?.id) {
      imported += 1;
    }
  }

  await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      lastSyncedAt: syncTimestamp,
      integrationStatus: "connected",
    },
  });

  return {
    imported,
    lastSyncAt: syncTimestamp.toISOString(),
  };
}

async function receiveWebhook(payload = {}) {
  const eventId = payload.id || randomUUID();
  const receivedAt = new Date().toISOString();

  webhookEvents.unshift({
    id: eventId,
    topic: payload.topic || "questions",
    resource: payload.resource || null,
    receivedAt,
  });

  if (webhookEvents.length > 20) {
    webhookEvents.length = 20;
  }

  let queued = false;
  let imported = 0;
  const sellerIdFromWebhook = normalizeText(
    payload.user_id || payload.seller_id || payload.sellerId
  );

  try {
    const hasCredentials = await liveProvider.hasLiveCredentials();
    const currentMode = liveProvider.mode();

    if (currentMode !== "mock" && hasCredentials && sellerIdFromWebhook) {
      const account = await prisma.marketplaceAccount.findFirst({
        where: {
          ...mercadoLivreAccountWhere(),
          sellerId: sellerIdFromWebhook,
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          userId: true,
          sellerId: true,
          accountName: true,
          accessToken: true,
          refreshToken: true,
          tokenType: true,
          scope: true,
          siteId: true,
          integrationStatus: true,
          tokenExpiresAt: true,
          lastSyncedAt: true,
          marketplace: true,
          isActive: true,
        },
      });

      if (account?.userId) {
        const user = await prisma.user.findUnique({
          where: {
            id: account.userId,
          },
          select: {
            id: true,
          },
        });

        if (user) {
          const syncResult = await pullAndPersistQuestions(user, account);
          queued = syncResult.synced;
          imported = syncResult.imported;
        }
      }
    }
  } catch (error) {
    console.error("[mercadolivre-questions:webhook-sync]", error);
  }

  return {
    received: true,
    mode: (await liveProvider.hasLiveCredentials()) ? "live" : "mock",
    eventId,
    queued,
    imported,
    latestEvents: cloneData(webhookEvents.slice(0, 5)),
  };
}

async function getIntegrationStatus(request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);
  const currentMode = liveProvider.mode();

  if (!account) {
    return {
      mode: currentMode,
      usingLive: false,
      hasCredentials: false,
      source: "none",
      account: null,
      instructions: "Conecte uma conta do Mercado Livre para habilitar a integracao.",
    };
  }

  const hasCredentials = Boolean(account.accessToken);
  const tokenExpiresAt = account.tokenExpiresAt
    ? account.tokenExpiresAt.toISOString()
    : null;
  const tokenExpired = Boolean(
    tokenExpiresAt && new Date(tokenExpiresAt).getTime() <= Date.now()
  );
  const tokenExpiringSoon = Boolean(
    tokenExpiresAt &&
      new Date(tokenExpiresAt).getTime() > Date.now() &&
      new Date(tokenExpiresAt).getTime() - Date.now() <= 1000 * 60 * 60 * 24
  );

  return {
    mode: currentMode,
    usingLive:
      currentMode !== "mock" &&
      hasCredentials &&
      Boolean(account.sellerId) &&
      !tokenExpired,
    hasCredentials,
    source: hasCredentials ? "database" : "none",
    tokenExpired,
    tokenExpiringSoon,
    account: {
      sellerId: account.sellerId || null,
      accountName: account.accountName || null,
      siteId: account.siteId || null,
      tokenExpiresAt,
      lastSyncedAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
      integrationStatus: account.integrationStatus || "disconnected",
    },
    instructions: hasCredentials
      ? null
      : "Conecte via OAuth ou configure credenciais para essa conta.",
  };
}

async function refreshIntegrationToken(request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    throw createHttpError(404, "Nenhuma conta Mercado Livre encontrada para renovar token.");
  }

  if (!account.refreshToken) {
    throw createHttpError(400, "A conta nao possui refresh token para renovacao.");
  }

  const refreshedToken = await liveProvider.refreshAccessToken(account.refreshToken);
  const updatedAccount = await persistAccountTokenState(account, refreshedToken);

  return {
    refreshed: true,
    message: "Token Mercado Livre renovado com sucesso.",
    account: {
      id: updatedAccount.id,
      sellerId: updatedAccount.sellerId || null,
      accountName: updatedAccount.accountName || null,
      tokenExpiresAt: updatedAccount.tokenExpiresAt
        ? updatedAccount.tokenExpiresAt.toISOString()
        : null,
    },
  };
}

async function disconnectIntegration(request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    return {
      disconnected: true,
      message: "Nenhuma conta Mercado Livre vinculada para desconectar.",
    };
  }

  await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      accessToken: null,
      refreshToken: null,
      tokenType: null,
      scope: null,
      tokenExpiresAt: null,
      integrationStatus: "disconnected",
    },
  });

  return {
    disconnected: true,
    message: "Conta Mercado Livre desconectada com sucesso.",
  };
}

async function syncOrders(options = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    throw createHttpError(404, "Nenhuma conta Mercado Livre encontrada.");
  }

  const accountWithFreshToken = await ensureLiveAccountToken(account);
  const canUseLive = await canUseLiveProvider(accountWithFreshToken);

  if (!canUseLive) {
    throw createHttpError(
      400,
      "A conta Mercado Livre nao possui credenciais live validas para sincronizar pedidos."
    );
  }

  const remotePayload = await liveProvider.pullOrdersFromApi(
    buildAccountTokenSource(accountWithFreshToken),
    options
  );
  const tokenState = remotePayload?.meta?.tokenState || null;
  const accountAfterTokenRefresh = tokenState
    ? await persistAccountTokenState(accountWithFreshToken, tokenState)
    : accountWithFreshToken;
  const persisted = await persistRemoteOrders(
    user,
    accountAfterTokenRefresh,
    remotePayload?.items || [],
    remotePayload?.meta?.lastSyncAt
  );

  return {
    synced: true,
    imported: persisted.imported,
    lastSyncAt: persisted.lastSyncAt,
    message: "Pedidos sincronizados com sucesso a partir da API do Mercado Livre.",
  };
}

async function syncItems(options = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    throw createHttpError(404, "Nenhuma conta Mercado Livre encontrada.");
  }

  const accountWithFreshToken = await ensureLiveAccountToken(account);
  const canUseLive = await canUseLiveProvider(accountWithFreshToken);

  if (!canUseLive) {
    throw createHttpError(
      400,
      "A conta Mercado Livre nao possui credenciais live validas para sincronizar anuncios."
    );
  }

  const remotePayload = await liveProvider.pullItemsFromApi(
    buildAccountTokenSource(accountWithFreshToken),
    options
  );
  const tokenState = remotePayload?.meta?.tokenState || null;
  const accountAfterTokenRefresh = tokenState
    ? await persistAccountTokenState(accountWithFreshToken, tokenState)
    : accountWithFreshToken;
  const persisted = await persistRemoteItems(
    user,
    accountAfterTokenRefresh,
    remotePayload?.items || [],
    remotePayload?.meta?.lastSyncAt
  );

  return {
    synced: true,
    imported: persisted.imported,
    lastSyncAt: persisted.lastSyncAt,
    message: "Anuncios/produtos sincronizados com sucesso a partir da API do Mercado Livre.",
  };
}

async function syncMarketplaceData(options = {}, request = {}) {
  const questions = await syncQuestions(options, request);
  const orders = await syncOrders(options, request);
  const items = await syncItems(options, request);

  return {
    synced: true,
    message: "Sincronizacao completa do Mercado Livre concluida.",
    summary: {
      questionsImported: questions?.meta?.filteredTotal || questions?.meta?.total || 0,
      ordersImported: orders.imported || 0,
      itemsImported: items.imported || 0,
      lastSyncAt:
        items.lastSyncAt || orders.lastSyncAt || questions?.meta?.lastSyncAt || null,
    },
  };
}

async function listMarketplaceOrders(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    return {
      items: [],
      meta: {
        total: 0,
        source: "database",
      },
    };
  }

  const limit = Math.max(1, Math.min(Number(filters.limit) || 100, 300));
  const rows = await prisma.order.findMany({
    where: {
      userId: user.id,
      marketplaceAccountId: account.id,
    },
    orderBy: {
      saleDate: "desc",
    },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    take: limit,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      marketplaceOrderId: row.marketplaceOrderId,
      status: row.status,
      buyerName: row.buyerName || null,
      saleDate: row.saleDate ? row.saleDate.toISOString() : null,
      totalAmount: round2(row.totalAmount),
      marketplaceFee: round2(row.marketplaceFee),
      shippingFee: round2(row.shippingFee),
      discountAmount: round2(row.discountAmount),
      taxAmount: round2(row.taxAmount),
      netReceived: round2(row.netReceived),
      items: (row.items || []).map((item) => ({
        id: item.id,
        marketplaceItemId: item.marketplaceItemId || null,
        title: item.title,
        sku: item.sku || null,
        quantity: item.quantity,
        unitPrice: round2(item.unitPrice),
        totalPrice: round2(item.totalPrice),
      })),
    })),
    meta: {
      total: rows.length,
      source: "database",
      lastSyncAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
    },
  };
}

async function listMarketplaceItems(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    return {
      items: [],
      meta: {
        total: 0,
        source: "database",
      },
    };
  }

  const limit = Math.max(1, Math.min(Number(filters.limit) || 200, 500));
  const rows = await prisma.product.findMany({
    where: {
      userId: user.id,
      marketplaceAccountId: account.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      marketplaceProductId: row.marketplaceProductId || null,
      title: row.title,
      sku: row.sku || null,
      thumbnail: row.thumbnail || null,
      category: row.category || null,
      listingPrice: round2(row.listingPrice),
      listingStatus: row.listingStatus || null,
      availableQuantity: row.availableQuantity || 0,
      lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    })),
    meta: {
      total: rows.length,
      source: "database",
      lastSyncAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
    },
  };
}

async function getAuthorizationUrl(payload = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const preferredAccountName = normalizeText(payload.accountName);
  const account = await resolveOrCreateMercadoLivreAccount(user.id, preferredAccountName);
  const oauthState = createOAuthStatePayload(user.id, account);
  const authorizationPayload = liveProvider.getAuthorizationUrl({
    state: oauthState.state,
    scope: payload.scope,
  });

  return {
    ...authorizationPayload,
    expiresAt: oauthState.expiresAt,
    account: {
      id: account.id,
      accountName: account.accountName || null,
      sellerId: account.sellerId || null,
    },
  };
}

async function completeAuthorizationCallback(query = {}) {
  const deniedByUser = normalizeText(query.error);
  if (deniedByUser) {
    throw createHttpError(400, "Autorizacao Mercado Livre recusada pelo usuario.");
  }

  const oauthState = consumeOAuthStatePayload(query.state);
  if (!oauthState?.userId) {
    throw createHttpError(
      400,
      "State OAuth invalido ou expirado. Reinicie a conexao com o Mercado Livre."
    );
  }

  const oauthResult = await liveProvider.completeAuthorizationCallback(query);
  const accountFromState = oauthState.accountId
    ? await resolveMercadoLivreAccountById(oauthState.userId, oauthState.accountId)
    : null;
  const account =
    accountFromState ||
    (await resolveOrCreateMercadoLivreAccount(
      oauthState.userId,
      oauthState.accountName || oauthResult?.account?.nickname || "Conta Mercado Livre"
    ));

  const updatedAccount = await persistAccountTokenState(
    account,
    oauthResult?.credentials || {},
    {
      sellerId: oauthResult?.account?.sellerId || null,
      nickname: oauthResult?.account?.nickname || null,
      siteId: oauthResult?.account?.siteId || null,
    }
  );

  return {
    connected: true,
    message: "Conta Mercado Livre conectada com sucesso.",
    account: {
      id: updatedAccount.id,
      accountName: updatedAccount.accountName || null,
      sellerId: updatedAccount.sellerId || null,
      siteId: updatedAccount.siteId || null,
      tokenExpiresAt: updatedAccount.tokenExpiresAt
        ? updatedAccount.tokenExpiresAt.toISOString()
        : null,
    },
  };
}

module.exports = {
  completeAuthorizationCallback,
  disconnectIntegration,
  dismissAnsweredQuestions,
  dismissQuestion,
  getAuthorizationUrl,
  getIntegrationStatus,
  listMarketplaceItems,
  listMarketplaceOrders,
  MercadoLivreQuestionNotFoundError,
  MercadoLivreQuestionValidationError,
  refreshIntegrationToken,
  getQuestionById,
  listQuestions,
  receiveWebhook,
  refreshQuestions,
  replyQuestion,
  syncItems,
  syncMarketplaceData,
  syncOrders,
  syncQuestions,
};
