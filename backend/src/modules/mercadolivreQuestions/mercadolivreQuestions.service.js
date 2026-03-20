const { randomUUID } = require("crypto");

const {
  mercadolivreQuestionsSeed,
} = require("../../data/mockMercadoLivreQuestions");
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

let questionsStore = cloneData(mercadolivreQuestionsSeed);
let lastSyncAt = new Date().toISOString();
const webhookEvents = [];

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

function hoursBetween(olderTimestamp, newerTimestamp) {
  const older = new Date(olderTimestamp).getTime();
  const newer = new Date(newerTimestamp).getTime();

  return Math.max((newer - older) / (1000 * 60 * 60), 0);
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
    .join(" ")
    .toLowerCase();

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

function buildSuggestedReplies(question) {
  const genericReplies = [
    "Sim, temos esse detalhe confirmado no lote atual. Se quiser, tambem posso orientar sobre envio e garantia.",
    "Consigo te confirmar isso agora: o anuncio esta atualizado com as especificacoes do item e envio com nota fiscal.",
    "Se preferir, posso te passar a orientacao mais segura de compatibilidade e uso antes da compra.",
  ];

  const questionText = question.questionText.toLowerCase();

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
      description: `Resposta publicada no mock local em ${enrichedQuestion.answerDelayLabel}.`,
    });
  }

  return {
    ...toQuestionListItem(enrichedQuestion),
    replyAllowed: !enrichedQuestion.isAnswered,
    timeline,
    suggestedReplies: buildSuggestedReplies(enrichedQuestion),
  };
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
    left.itemTitle.localeCompare(right.itemTitle)
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

function buildQuestionsPayload(filters = {}) {
  const resolvedFilters = normalizeFilters(filters);
  const visibleQuestions = questionsStore
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
    },
  };
}

function listQuestions(filters = {}) {
  return buildQuestionsPayload(filters);
}

function getQuestionById(questionId) {
  const question = questionsStore.find(
    (item) => item.id === questionId && !item.dismissedAt
  );

  if (!question) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  return {
    question: buildQuestionDetail(question),
    meta: {
      lastSyncAt,
    },
  };
}

function replyQuestion(questionId, answerText) {
  const trimmedAnswer = String(answerText ?? "").trim();

  if (!trimmedAnswer) {
    throw new MercadoLivreQuestionValidationError("Informe a resposta da pergunta.");
  }

  if (trimmedAnswer.length < 8) {
    throw new MercadoLivreQuestionValidationError(
      "A resposta deve ter pelo menos 8 caracteres."
    );
  }

  const questionIndex = questionsStore.findIndex((item) => item.id === questionId);

  if (questionIndex === -1) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  const question = questionsStore[questionIndex];

  if (question.answerText && question.answeredAt) {
    throw new MercadoLivreQuestionValidationError(
      "Essa pergunta ja foi respondida no mock atual."
    );
  }

  questionsStore[questionIndex] = {
    ...question,
    answerText: trimmedAnswer,
    answeredAt: new Date().toISOString(),
    status: "answered",
  };
  lastSyncAt = new Date().toISOString();

  return {
    message: "Resposta registrada com sucesso no mock local.",
    question: buildQuestionDetail(questionsStore[questionIndex]),
    meta: {
      lastSyncAt,
      overview: buildOverview(
        questionsStore.filter((item) => !item.dismissedAt).map(enrichQuestion)
      ),
    },
  };
}

function dismissQuestion(questionId, filters = {}) {
  const questionIndex = questionsStore.findIndex((item) => item.id === questionId);

  if (questionIndex === -1) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  const question = questionsStore[questionIndex];

  if (question.dismissedAt) {
    return {
      ...buildQuestionsPayload(filters),
      message: "Essa pergunta ja foi removida da lista.",
    };
  }

  if (!question.answerText || !question.answeredAt) {
    throw new MercadoLivreQuestionValidationError(
      "So e possivel excluir da lista perguntas ja respondidas."
    );
  }

  questionsStore[questionIndex] = {
    ...question,
    dismissedAt: new Date().toISOString(),
  };
  lastSyncAt = new Date().toISOString();

  return {
    ...buildQuestionsPayload(filters),
    message: "Pergunta removida da lista visivel no mock local.",
  };
}

function dismissAnsweredQuestions(filters = {}) {
  const payload = buildQuestionsPayload(filters);
  const answeredIds = new Set(
    payload.items.filter((question) => question.isAnswered).map((question) => question.id)
  );

  if (!answeredIds.size) {
    return {
      ...payload,
      message: "Nenhuma pergunta respondida para remover neste recorte.",
    };
  }

  const dismissedAt = new Date().toISOString();

  questionsStore = questionsStore.map((question) => {
    if (!answeredIds.has(question.id)) {
      return question;
    }

    return {
      ...question,
      dismissedAt,
    };
  });
  lastSyncAt = dismissedAt;

  return {
    ...buildQuestionsPayload(filters),
    message: `${answeredIds.size} pergunta(s) respondida(s) removida(s) da lista.`,
  };
}

function refreshQuestions(filters = {}) {
  lastSyncAt = new Date().toISOString();

  return {
    ...buildQuestionsPayload(filters),
    message: "Perguntas atualizadas a partir do mock local.",
  };
}

function syncQuestions(filters = {}) {
  lastSyncAt = new Date().toISOString();

  return {
    ...buildQuestionsPayload(filters),
    message: "Sincronizacao mock concluida. Integre a API real aqui depois.",
  };
}

function receiveWebhook(payload = {}) {
  // No fluxo real, esse payload deve acionar a fila de sincronizacao da conta OAuth.
  const eventId = payload.id || randomUUID();

  webhookEvents.unshift({
    id: eventId,
    topic: payload.topic || "questions",
    resource: payload.resource || null,
    receivedAt: new Date().toISOString(),
  });

  if (webhookEvents.length > 20) {
    webhookEvents.length = 20;
  }

  return {
    received: true,
    mode: "mock",
    eventId,
    queued: false,
    latestEvents: cloneData(webhookEvents.slice(0, 5)),
  };
}

async function shouldUseLiveProvider() {
  const currentMode = liveProvider.mode();

  if (currentMode === "mock") {
    return false;
  }

  const hasCredentials = await liveProvider.hasLiveCredentials();

  if (currentMode === "live" && !hasCredentials) {
    throw new MercadoLivreQuestionValidationError(
      "Modo live ativo, mas sem credenciais. Configure MERCADOLIVRE_ACCESS_TOKEN ou conecte via OAuth."
    );
  }

  return hasCredentials;
}

async function listQuestionsWithProvider(filters = {}) {
  if (await shouldUseLiveProvider()) {
    return liveProvider.listQuestions(filters);
  }

  return listQuestions(filters);
}

async function getQuestionByIdWithProvider(questionId) {
  if (await shouldUseLiveProvider()) {
    return liveProvider.getQuestionById(questionId);
  }

  return getQuestionById(questionId);
}

async function replyQuestionWithProvider(questionId, answerText) {
  if (await shouldUseLiveProvider()) {
    return liveProvider.replyQuestion(questionId, answerText);
  }

  return replyQuestion(questionId, answerText);
}

async function dismissQuestionWithProvider(questionId, filters = {}) {
  if (await shouldUseLiveProvider()) {
    return liveProvider.dismissQuestion(questionId, filters);
  }

  return dismissQuestion(questionId, filters);
}

async function dismissAnsweredQuestionsWithProvider(filters = {}) {
  if (await shouldUseLiveProvider()) {
    return liveProvider.dismissAnsweredQuestions(filters);
  }

  return dismissAnsweredQuestions(filters);
}

async function refreshQuestionsWithProvider(filters = {}) {
  if (await shouldUseLiveProvider()) {
    return liveProvider.refreshQuestions(filters);
  }

  return refreshQuestions(filters);
}

async function syncQuestionsWithProvider(filters = {}) {
  if (await shouldUseLiveProvider()) {
    return liveProvider.syncQuestions(filters);
  }

  return syncQuestions(filters);
}

async function receiveWebhookWithProvider(payload = {}) {
  if (await shouldUseLiveProvider()) {
    return liveProvider.receiveWebhook(payload);
  }

  return receiveWebhook(payload);
}

async function getIntegrationStatus() {
  const currentMode = liveProvider.mode();
  const hasCredentials = await liveProvider.hasLiveCredentials();

  if (currentMode === "mock") {
    return {
      mode: "mock",
      usingLive: false,
      hasCredentials,
      source: "mock",
      account: null,
      instructions: null,
    };
  }

  return liveProvider.getIntegrationStatus();
}

function getAuthorizationUrl(payload = {}) {
  return liveProvider.getAuthorizationUrl(payload);
}

async function completeAuthorizationCallback(query = {}) {
  return liveProvider.completeAuthorizationCallback(query);
}

module.exports = {
  completeAuthorizationCallback,
  dismissAnsweredQuestions: dismissAnsweredQuestionsWithProvider,
  dismissQuestion: dismissQuestionWithProvider,
  getAuthorizationUrl,
  getIntegrationStatus,
  MercadoLivreQuestionNotFoundError,
  MercadoLivreQuestionValidationError,
  getQuestionById: getQuestionByIdWithProvider,
  listQuestions: listQuestionsWithProvider,
  receiveWebhook: receiveWebhookWithProvider,
  refreshQuestions: refreshQuestionsWithProvider,
  replyQuestion: replyQuestionWithProvider,
  syncQuestions: syncQuestionsWithProvider,
};
