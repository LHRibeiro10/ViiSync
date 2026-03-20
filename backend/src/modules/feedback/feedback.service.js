const feedbackSeed = require("../../data/mockFeedbackInbox");
const { getSettings } = require("../../services/analyticsDb.service");

const VALID_TYPES = ["feedback", "complaint", "bug", "feature"];
const VALID_STATUSES = ["new", "in_review", "resolved"];
const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_AREAS = [
  "dashboard",
  "assistant",
  "orders",
  "products",
  "mercado-livre",
  "accounts",
  "reports",
  "onboarding",
  "general",
];

const TYPE_LABELS = {
  feedback: "Feedback",
  complaint: "Reclamacao",
  bug: "Bug",
  feature: "Sugestao",
};

const STATUS_LABELS = {
  new: "Novo",
  in_review: "Em analise",
  resolved: "Resolvido",
};

const PRIORITY_LABELS = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
};

const AREA_LABELS = {
  dashboard: "Dashboard",
  assistant: "Assistente",
  orders: "Pedidos",
  products: "Produtos",
  "mercado-livre": "Perguntas ML",
  accounts: "Contas conectadas",
  reports: "Relatorios",
  onboarding: "Onboarding",
  general: "Geral",
};

let feedbackStore = cloneData(feedbackSeed);

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getStatusTone(status) {
  if (status === "resolved") {
    return "success";
  }

  if (status === "in_review") {
    return "warning";
  }

  return "danger";
}

function getPriorityTone(priority) {
  if (priority === "high") {
    return "danger";
  }

  if (priority === "medium") {
    return "warning";
  }

  return "neutral";
}

async function resolveSellerProfile(request = {}) {
  const settings = await getSettings(request);

  return {
    name: settings.profile.name,
    email: settings.profile.email,
    company: settings.profile.company,
  };
}

function resolveFilters(filters = {}) {
  return {
    status:
      filters.status && filters.status !== "all" && VALID_STATUSES.includes(filters.status)
        ? filters.status
        : "all",
    type:
      filters.type && filters.type !== "all" && VALID_TYPES.includes(filters.type)
        ? filters.type
        : "all",
    priority:
      filters.priority &&
      filters.priority !== "all" &&
      VALID_PRIORITIES.includes(filters.priority)
        ? filters.priority
        : "all",
    search: String(filters.search ?? "").trim(),
  };
}

function matchesFilters(item, filters) {
  if (filters.status !== "all" && item.status !== filters.status) {
    return false;
  }

  if (filters.type !== "all" && item.type !== filters.type) {
    return false;
  }

  if (filters.priority !== "all" && item.priority !== filters.priority) {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const haystack = [
    item.id,
    item.subject,
    item.message,
    item.submittedBy?.name,
    item.submittedBy?.company,
    AREA_LABELS[item.area],
  ]
    .filter(Boolean)
    .map(normalizeText)
    .join(" ");

  return haystack.includes(normalizeText(filters.search));
}

function sortByNewest(items) {
  return [...items].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function mapHistoryEntry(entry) {
  return {
    ...cloneData(entry),
    statusLabel: STATUS_LABELS[entry.status] || entry.status,
    statusTone: getStatusTone(entry.status),
  };
}

function mapFeedbackItem(item) {
  return {
    ...cloneData(item),
    typeLabel: TYPE_LABELS[item.type] || item.type,
    statusLabel: STATUS_LABELS[item.status] || item.status,
    priorityLabel: PRIORITY_LABELS[item.priority] || item.priority,
    areaLabel: AREA_LABELS[item.area] || AREA_LABELS.general,
    statusTone: getStatusTone(item.status),
    priorityTone: getPriorityTone(item.priority),
    isOpen: item.status !== "resolved",
    needsAttention: item.status === "new" || item.priority === "high",
    history: (item.history || []).map(mapHistoryEntry),
  };
}

function buildMeta(allItems, filteredItems) {
  return {
    total: allItems.length,
    filteredTotal: filteredItems.length,
    openCount: allItems.filter((item) => item.status !== "resolved").length,
    newCount: allItems.filter((item) => item.status === "new").length,
    inReviewCount: allItems.filter((item) => item.status === "in_review").length,
    resolvedCount: allItems.filter((item) => item.status === "resolved").length,
    highPriorityCount: allItems.filter((item) => item.priority === "high").length,
    latestAt: allItems[0]?.createdAt || null,
  };
}

async function getScopedSellerItems(request = {}) {
  const sellerProfile = await resolveSellerProfile(request);

  return sortByNewest(
    feedbackStore.filter((item) => item.submittedBy?.company === sellerProfile.company)
  );
}

async function listFeedback(filters = {}, request = {}) {
  const resolvedFilters = resolveFilters(filters);
  const sellerProfile = await resolveSellerProfile(request);
  const scopedItems = await getScopedSellerItems(request);
  const filteredItems = scopedItems.filter((item) => matchesFilters(item, resolvedFilters));

  return {
    seller: sellerProfile,
    filters: resolvedFilters,
    meta: buildMeta(scopedItems, filteredItems),
    items: filteredItems.map(mapFeedbackItem),
  };
}

function listAdminFeedback(filters = {}) {
  const resolvedFilters = resolveFilters(filters);
  const allItems = sortByNewest(feedbackStore);
  const filteredItems = allItems.filter((item) => matchesFilters(item, resolvedFilters));

  return {
    filters: resolvedFilters,
    meta: buildMeta(allItems, filteredItems),
    items: filteredItems.map(mapFeedbackItem),
  };
}

function getAdminFeedbackById(feedbackId) {
  const feedbackItem = feedbackStore.find((item) => item.id === feedbackId);

  if (!feedbackItem) {
    throw createHttpError(404, "Feedback nao encontrado.");
  }

  return {
    item: mapFeedbackItem(feedbackItem),
  };
}

function resolvePriority(type, message, customPriority) {
  if (VALID_PRIORITIES.includes(customPriority)) {
    return customPriority;
  }

  const normalizedMessage = normalizeText(message);

  if (
    type === "bug" ||
    normalizedMessage.includes("travou") ||
    normalizedMessage.includes("nao consigo") ||
    normalizedMessage.includes("erro") ||
    normalizedMessage.includes("quebrou")
  ) {
    return "high";
  }

  if (type === "complaint" || type === "feature") {
    return "medium";
  }

  return "low";
}

function buildNextId() {
  const maxNumericId = feedbackStore.reduce((highestValue, item) => {
    const numericPart = Number(String(item.id).replace(/[^\d]/g, ""));
    return Number.isFinite(numericPart) ? Math.max(highestValue, numericPart) : highestValue;
  }, 1200);

  return `FDB-${maxNumericId + 1}`;
}

async function createFeedback(payload = {}, request = {}) {
  const type = VALID_TYPES.includes(payload.type) ? payload.type : "feedback";
  const area = VALID_AREAS.includes(payload.area) ? payload.area : "general";
  const subject = String(payload.subject ?? "").trim();
  const message = String(payload.message ?? "").trim();
  const sellerProfile = await resolveSellerProfile(request);

  if (subject.length < 8) {
    throw createHttpError(400, "Informe um assunto com pelo menos 8 caracteres.");
  }

  if (message.length < 24) {
    throw createHttpError(400, "Descreva o contexto com pelo menos 24 caracteres.");
  }

  const now = new Date().toISOString();
  const nextId = buildNextId();
  const item = {
    id: nextId,
    type,
    area,
    subject,
    message,
    status: "new",
    priority: resolvePriority(type, message, payload.priority),
    sourcePath: String(payload.currentPath ?? "/feedback"),
    createdAt: now,
    updatedAt: now,
    submittedBy: sellerProfile,
    history: [
      {
        id: `${nextId}-event-1`,
        status: "new",
        note: "Feedback enviado pelo seller no portal do ViiSync.",
        actorType: "seller",
        createdAt: now,
      },
    ],
  };

  feedbackStore = [item, ...feedbackStore];

  return {
    item: mapFeedbackItem(item),
    meta: buildMeta(sortByNewest(feedbackStore), sortByNewest(feedbackStore)),
  };
}

function updateAdminFeedbackStatus(feedbackId, payload = {}) {
  const nextStatus = VALID_STATUSES.includes(payload.status) ? payload.status : null;

  if (!nextStatus) {
    throw createHttpError(400, "Informe um status valido para atualizar o feedback.");
  }

  const feedbackIndex = feedbackStore.findIndex((item) => item.id === feedbackId);

  if (feedbackIndex === -1) {
    throw createHttpError(404, "Feedback nao encontrado.");
  }

  const currentItem = feedbackStore[feedbackIndex];
  const now = new Date().toISOString();
  const adminNote = String(payload.note ?? "").trim();
  const historyEntry = {
    id: `${feedbackId}-event-${currentItem.history.length + 1}`,
    status: nextStatus,
    note:
      adminNote ||
      (nextStatus === "resolved"
        ? "Ticket tratado e encerrado pelo time interno."
        : "Ticket movido pelo time interno para uma nova etapa."),
    actorType: "admin",
    createdAt: now,
  };

  feedbackStore[feedbackIndex] = {
    ...currentItem,
    status: nextStatus,
    updatedAt: now,
    history: [...currentItem.history, historyEntry],
  };

  return {
    item: mapFeedbackItem(feedbackStore[feedbackIndex]),
    meta: buildMeta(sortByNewest(feedbackStore), sortByNewest(feedbackStore)),
  };
}

module.exports = {
  createFeedback,
  getAdminFeedbackById,
  listAdminFeedback,
  listFeedback,
  updateAdminFeedbackStatus,
};
