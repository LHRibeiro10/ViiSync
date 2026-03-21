const { randomUUID } = require("crypto");

const prisma = require("../../lib/prisma");
const { resolveSessionContextFromRequest } = require("../auth/auth.service");

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

const feedbackTicketInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        select: {
          organization: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  },
  history: {
    orderBy: {
      createdAt: "asc",
    },
  },
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeSearchText(value) {
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

function resolveSellerCompany(user) {
  return user?.memberships?.[0]?.organization?.name || "Operacao atual";
}

function resolveSellerProfile(user) {
  return {
    name: user?.name || "Seller",
    email: user?.email || "",
    company: resolveSellerCompany(user),
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
    item.ticketCode,
    item.subject,
    item.message,
    item.user?.name,
    item.user?.email,
    resolveSellerCompany(item.user),
    AREA_LABELS[item.area],
  ]
    .filter(Boolean)
    .map(normalizeSearchText)
    .join(" ");

  return haystack.includes(normalizeSearchText(filters.search));
}

function mapHistoryEntry(entry) {
  return {
    id: entry.id,
    status: entry.status,
    note: entry.note,
    actorType: entry.actorType,
    responseText: entry.responseText || null,
    resolutionEta: entry.resolutionEta ? entry.resolutionEta.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    statusLabel: STATUS_LABELS[entry.status] || entry.status,
    statusTone: getStatusTone(entry.status),
  };
}

function mapFeedbackItem(item) {
  const submittedBy = resolveSellerProfile(item.user);

  return {
    id: item.ticketCode,
    internalId: item.id,
    type: item.type,
    area: item.area,
    subject: item.subject,
    message: item.message,
    status: item.status,
    priority: item.priority,
    sourcePath: item.sourcePath,
    adminResponse: item.adminResponse || null,
    resolutionEta: item.resolutionEta ? item.resolutionEta.toISOString() : null,
    resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    submittedBy,
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
    latestAt: allItems[0]?.createdAt?.toISOString?.() || null,
  };
}

function resolvePriority(type, message, customPriority) {
  if (VALID_PRIORITIES.includes(customPriority)) {
    return customPriority;
  }

  const normalizedMessage = normalizeSearchText(message);

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

function buildTicketCode() {
  const uniqueSeed = randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `FDB-${uniqueSeed}`;
}

function parseResolutionEta(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, "Informe uma previsao valida para o retorno.");
  }

  return parsed;
}

async function resolveViewerUser(request = {}) {
  const sessionContext = await resolveSessionContextFromRequest(request);

  if (!sessionContext?.user?.id) {
    throw createHttpError(401, "Sessao invalida ou expirada.");
  }

  const found = await prisma.user.findUnique({
    where: {
      id: sessionContext.user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        select: {
          organization: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  });

  if (!found) {
    throw createHttpError(401, "Sessao invalida ou expirada.");
  }

  return found;
}

async function listTicketRows(where = {}) {
  return prisma.feedbackTicket.findMany({
    where,
    include: feedbackTicketInclude,
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function listFeedback(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const resolvedFilters = resolveFilters(filters);
  const scopedItems = await listTicketRows({ userId: user.id });
  const filteredItems = scopedItems.filter((item) => matchesFilters(item, resolvedFilters));

  return {
    seller: resolveSellerProfile(user),
    filters: resolvedFilters,
    meta: buildMeta(scopedItems, filteredItems),
    items: filteredItems.map(mapFeedbackItem),
  };
}

async function listAdminFeedback(filters = {}) {
  const resolvedFilters = resolveFilters(filters);
  const allItems = await listTicketRows();
  const filteredItems = allItems.filter((item) => matchesFilters(item, resolvedFilters));

  return {
    filters: resolvedFilters,
    meta: buildMeta(allItems, filteredItems),
    items: filteredItems.map(mapFeedbackItem),
  };
}

async function findTicketByPublicId(feedbackId) {
  const identifier = normalizeText(feedbackId);

  if (!identifier) {
    throw createHttpError(400, "Feedback invalido.");
  }

  return prisma.feedbackTicket.findFirst({
    where: {
      OR: [{ ticketCode: identifier }, { id: identifier }],
    },
    include: feedbackTicketInclude,
  });
}

async function getAdminFeedbackById(feedbackId) {
  const item = await findTicketByPublicId(feedbackId);

  if (!item) {
    throw createHttpError(404, "Feedback nao encontrado.");
  }

  return {
    item: mapFeedbackItem(item),
  };
}

async function createFeedback(payload = {}, request = {}) {
  const type = VALID_TYPES.includes(payload.type) ? payload.type : "feedback";
  const area = VALID_AREAS.includes(payload.area) ? payload.area : "general";
  const subject = normalizeText(payload.subject);
  const message = normalizeText(payload.message);
  const user = await resolveViewerUser(request);

  if (subject.length < 8) {
    throw createHttpError(400, "Informe um assunto com pelo menos 8 caracteres.");
  }

  if (message.length < 24) {
    throw createHttpError(400, "Descreva o contexto com pelo menos 24 caracteres.");
  }

  const priority = resolvePriority(type, message, payload.priority);
  const ticketCode = buildTicketCode();
  const now = new Date();

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.feedbackTicket.create({
      data: {
        ticketCode,
        userId: user.id,
        type,
        area,
        subject,
        message,
        status: "new",
        priority,
        sourcePath: normalizeText(payload.currentPath || "/feedback") || "/feedback",
      },
    });

    await tx.feedbackTicketHistory.create({
      data: {
        ticketId: created.id,
        status: "new",
        note: "Feedback enviado pelo seller no portal do ViiSync.",
        actorType: "seller",
        createdAt: now,
      },
    });

    return tx.feedbackTicket.findUnique({
      where: {
        id: created.id,
      },
      include: feedbackTicketInclude,
    });
  });

  const scopedItems = await listTicketRows({ userId: user.id });

  return {
    item: mapFeedbackItem(item),
    meta: buildMeta(scopedItems, scopedItems),
  };
}

async function updateAdminFeedbackStatus(feedbackId, payload = {}) {
  const nextStatus = VALID_STATUSES.includes(payload.status) ? payload.status : null;

  if (!nextStatus) {
    throw createHttpError(400, "Informe um status valido para atualizar o feedback.");
  }

  const currentItem = await findTicketByPublicId(feedbackId);

  if (!currentItem) {
    throw createHttpError(404, "Feedback nao encontrado.");
  }

  const adminNote = normalizeText(payload.note);
  const hasResponsePayload = Object.prototype.hasOwnProperty.call(payload, "response");
  const responseText = normalizeText(payload.response);

  if (hasResponsePayload && responseText && responseText.length < 8) {
    throw createHttpError(400, "A resposta para o seller deve ter pelo menos 8 caracteres.");
  }

  const etaValue = parseResolutionEta(
    Object.prototype.hasOwnProperty.call(payload, "resolutionEta")
      ? payload.resolutionEta
      : payload.eta
  );

  const historyNote =
    adminNote ||
    (nextStatus === "resolved"
      ? "Ticket tratado e encerrado pelo time interno."
      : "Ticket movido pelo time interno para uma nova etapa.");

  const updatedItem = await prisma.$transaction(async (tx) => {
    const updated = await tx.feedbackTicket.update({
      where: {
        id: currentItem.id,
      },
      data: {
        status: nextStatus,
        resolvedAt: nextStatus === "resolved" ? new Date() : null,
        ...(hasResponsePayload ? { adminResponse: responseText || null } : {}),
        ...(etaValue !== undefined ? { resolutionEta: etaValue } : {}),
      },
      include: feedbackTicketInclude,
    });

    await tx.feedbackTicketHistory.create({
      data: {
        ticketId: currentItem.id,
        status: nextStatus,
        note: historyNote,
        actorType: "admin",
        responseText: hasResponsePayload ? responseText || null : null,
        resolutionEta: etaValue !== undefined ? etaValue : null,
      },
    });

    return tx.feedbackTicket.findUnique({
      where: {
        id: updated.id,
      },
      include: feedbackTicketInclude,
    });
  });

  const allItems = await listTicketRows();

  return {
    item: mapFeedbackItem(updatedItem),
    meta: buildMeta(allItems, allItems),
  };
}

module.exports = {
  createFeedback,
  getAdminFeedbackById,
  listAdminFeedback,
  listFeedback,
  updateAdminFeedbackStatus,
};
