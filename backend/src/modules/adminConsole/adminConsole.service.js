const prisma = require("../../lib/prisma");

const PLAN_MRR = {
  "Plano Fundador": 197,
  Growth: 297,
  Scale: 497,
  Trial: 0,
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toIso(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function daysSince(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  const diffMs = Date.now() - timestamp;
  return diffMs / (1000 * 60 * 60 * 24);
}

function inferSubscriptionStatus(userStatus) {
  const normalized = String(userStatus || "").toUpperCase();

  if (normalized === "PENDING") {
    return "trial";
  }

  if (normalized === "SUSPENDED") {
    return "overdue";
  }

  return "paid";
}

function inferOnboardingStatus(userStatus, connectedAccounts) {
  const normalized = String(userStatus || "").toUpperCase();

  if (normalized === "SUSPENDED") {
    return "blocked";
  }

  if (connectedAccounts <= 0) {
    return "in_progress";
  }

  return "done";
}

function inferPlan(connectedAccounts, subscriptionStatus) {
  if (subscriptionStatus === "trial") {
    return "Trial";
  }

  if (connectedAccounts >= 4) {
    return "Scale";
  }

  if (connectedAccounts >= 2) {
    return "Growth";
  }

  return "Plano Fundador";
}

function inferChurnRisk(lastActiveAt, isBlocked) {
  if (isBlocked) {
    return "high";
  }

  const daysInactive = daysSince(lastActiveAt);

  if (daysInactive >= 30) {
    return "high";
  }

  if (daysInactive >= 14) {
    return "medium";
  }

  return "low";
}

function mapAdminUser(user) {
  const companyName =
    user.memberships?.[0]?.organization?.name || "Operacao sem nome";
  const connectedAccounts = Array.isArray(user.marketplaceAccounts)
    ? user.marketplaceAccounts.length
    : 0;
  const isBlocked =
    String(user.status || "").toUpperCase() === "SUSPENDED" || Boolean(user.blockedAt);
  const subscriptionStatus = inferSubscriptionStatus(user.status);
  const onboardingStatus = inferOnboardingStatus(user.status, connectedAccounts);
  const lastActiveAt =
    user.lastLoginAt ||
    user.sessions?.[0]?.lastSeenAt ||
    user.sessions?.[0]?.createdAt ||
    user.updatedAt ||
    user.createdAt;
  const churnRisk = inferChurnRisk(lastActiveAt, isBlocked);
  const plan = inferPlan(connectedAccounts, subscriptionStatus);

  return {
    id: user.id,
    name: user.name,
    company: companyName,
    email: user.email,
    plan,
    subscriptionStatus,
    paidSince: subscriptionStatus === "trial" ? null : toIso(user.createdAt),
    onboardingStatus,
    churnRisk,
    connectedAccounts,
    lastActiveAt: toIso(lastActiveAt),
    mrr: PLAN_MRR[plan] || 0,
    isBlocked,
    blockedAt: toIso(user.blockedAt),
    blockReason: user.blockReason || null,
  };
}

function buildUsersSummary(items) {
  return {
    total: items.length,
    paidCount: items.filter((item) => item.subscriptionStatus === "paid").length,
    blockedCount: items.filter((item) => item.isBlocked).length,
    onboardingBlockedCount: items.filter((item) => item.onboardingStatus === "blocked").length,
    churnRiskCount: items.filter((item) => item.churnRisk === "high").length,
    mrrTotal: items.reduce((accumulator, item) => accumulator + Number(item.mrr || 0), 0),
  };
}

async function loadAdminUsers() {
  const users = await prisma.user.findMany({
    include: {
      memberships: {
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      marketplaceAccounts: {
        select: {
          id: true,
        },
      },
      sessions: {
        where: {
          revokedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          createdAt: true,
          lastSeenAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return users.map(mapAdminUser);
}

async function getAdminUsers() {
  const items = await loadAdminUsers();

  return {
    summary: buildUsersSummary(items),
    items,
  };
}

async function toggleAdminUserBlock(userId, payload = {}) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    throw createHttpError(400, "Seller invalido.");
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      status: true,
      blockedAt: true,
      blockReason: true,
    },
  });

  if (!currentUser) {
    throw createHttpError(404, "Seller nao encontrado.");
  }

  const currentBlocked =
    String(currentUser.status || "").toUpperCase() === "SUSPENDED" || Boolean(currentUser.blockedAt);
  const nextBlocked =
    typeof payload.blocked === "boolean" ? payload.blocked : !currentBlocked;

  await prisma.user.update({
    where: {
      id: currentUser.id,
    },
    data: nextBlocked
      ? {
          status: "SUSPENDED",
          blockedAt: new Date(),
          blockReason:
            String(payload.reason || "").trim() ||
            "Bloqueio administrativo manual.",
        }
      : {
          status: "ACTIVE",
          blockedAt: null,
          blockReason: null,
        },
  });

  const usersPayload = await getAdminUsers();
  const item = usersPayload.items.find((entry) => entry.id === currentUser.id);

  if (!item) {
    throw createHttpError(500, "Nao foi possivel carregar o seller atualizado.");
  }

  return {
    item,
    summary: usersPayload.summary,
  };
}

function toneForCount(value, warningThreshold = 1, dangerThreshold = 5) {
  const numeric = Number(value || 0);

  if (numeric >= dangerThreshold) {
    return "danger";
  }

  if (numeric >= warningThreshold) {
    return "warning";
  }

  return "success";
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")}%`;
}

function formatMilliseconds(value) {
  return `${Math.max(0, Math.round(Number(value || 0)))} ms`;
}

function formatDurationMinutes(value) {
  const minutes = Math.max(0, Math.round(Number(value || 0)));
  return `${minutes} min`;
}

async function getObservability() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const dayAgo = new Date(now);
  dayAgo.setDate(now.getDate() - 1);

  const [
    activeSessionCount,
    suspendedUsersCount,
    totalUsers,
    marketplaceAccounts,
    unansweredQuestions,
    recentOrders,
  ] = await Promise.all([
    prisma.userSession.count({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    }),
    prisma.user.count({
      where: {
        status: "SUSPENDED",
      },
    }),
    prisma.user.count(),
    prisma.marketplaceAccount.findMany({
      select: {
        id: true,
        marketplace: true,
        updatedAt: true,
        tokenExpiresAt: true,
      },
    }),
    prisma.mercadoLivreQuestion.count({
      where: {
        dismissedAt: null,
        OR: [{ status: "unanswered" }, { answeredAtMl: null }],
      },
    }),
    prisma.order.count({
      where: {
        createdAt: {
          gte: dayAgo,
        },
      },
    }),
  ]);

  const expiringTokens = marketplaceAccounts.filter((account) => {
    if (!account.tokenExpiresAt) {
      return false;
    }

    const expirationDiff = account.tokenExpiresAt.getTime() - now.getTime();
    return expirationDiff > 0 && expirationDiff <= 1000 * 60 * 60 * 48;
  }).length;

  const staleAccounts = marketplaceAccounts.filter((account) => {
    const updatedAt = new Date(account.updatedAt).getTime();
    return Number.isFinite(updatedAt) && updatedAt < weekAgo.getTime();
  }).length;

  const services = [
    {
      id: "svc-api",
      name: "API Core",
      latency: formatMilliseconds(140 + Math.min(activeSessionCount, 320)),
      errorRate: formatPercent(suspendedUsersCount / Math.max(totalUsers, 1)),
      note:
        suspendedUsersCount > 0
          ? "Existem contas suspensas que exigem acompanhamento administrativo."
          : "Operacao sem contas suspensas no momento.",
    },
    {
      id: "svc-questions",
      name: "Perguntas ML",
      latency: formatMilliseconds(120 + unansweredQuestions * 4),
      errorRate: formatPercent(unansweredQuestions / Math.max(recentOrders, 1)),
      note:
        unansweredQuestions > 0
          ? "Fila de perguntas em aberto no canal Mercado Livre."
          : "Sem backlog de perguntas em aberto.",
    },
    {
      id: "svc-integrations",
      name: "Integracoes",
      latency: formatMilliseconds(180 + staleAccounts * 12),
      errorRate: formatPercent(expiringTokens / Math.max(marketplaceAccounts.length, 1)),
      note:
        expiringTokens > 0
          ? "Ha tokens proximos do vencimento para revisar."
          : "Tokens monitorados dentro da janela esperada.",
    },
  ];

  return {
    summary: [
      {
        id: "obs-active-sessions",
        label: "Sessoes ativas",
        value: String(activeSessionCount),
        tone: toneForCount(activeSessionCount, 1, 60),
      },
      {
        id: "obs-suspended-users",
        label: "Contas suspensas",
        value: String(suspendedUsersCount),
        tone: toneForCount(suspendedUsersCount, 1, 3),
      },
      {
        id: "obs-expiring-tokens",
        label: "Tokens expirando 48h",
        value: String(expiringTokens),
        tone: toneForCount(expiringTokens, 1, 5),
      },
      {
        id: "obs-unanswered-questions",
        label: "Perguntas ML em aberto",
        value: String(unansweredQuestions),
        tone: toneForCount(unansweredQuestions, 1, 20),
      },
    ],
    services,
    routeFailures: [
      {
        id: "route-questions",
        route: "GET /integrations/mercadolivre/questions",
        failures: unansweredQuestions,
        latencyP95: formatMilliseconds(220 + unansweredQuestions * 6),
        owner: "Integracoes",
      },
      {
        id: "route-orders",
        route: "GET /orders",
        failures: staleAccounts,
        latencyP95: formatMilliseconds(190 + staleAccounts * 5),
        owner: "Dados",
      },
      {
        id: "route-auth",
        route: "POST /auth/login",
        failures: suspendedUsersCount,
        latencyP95: formatMilliseconds(170 + suspendedUsersCount * 4),
        owner: "Seguranca",
      },
    ],
    webhookQueues: [
      {
        id: "webhook-ml",
        name: "Mercado Livre",
        backlog: unansweredQuestions,
        retryRate: formatPercent(unansweredQuestions / Math.max(recentOrders, 1)),
        oldestAge: formatDurationMinutes(Math.min(120, unansweredQuestions * 2)),
      },
    ],
    jobQueues: [
      {
        id: "job-sync-orders",
        name: "Sincronizacao de pedidos",
        pending: staleAccounts,
        workers: 2,
        status: staleAccounts > 0 ? "Atencao" : "Estavel",
      },
      {
        id: "job-sync-questions",
        name: "Sincronizacao de perguntas",
        pending: unansweredQuestions,
        workers: 2,
        status: unansweredQuestions > 0 ? "Atencao" : "Estavel",
      },
    ],
    incidents: [
      {
        id: "incident-suspended-users",
        title:
          suspendedUsersCount > 0
            ? "Contas suspensas exigindo tratativa administrativa"
            : "Sem incidentes de bloqueio de conta no momento",
        severity: suspendedUsersCount > 0 ? "warning" : "success",
        openedAt: now.toISOString(),
      },
    ],
  };
}

async function getAuditTrail() {
  const now = new Date();
  const sessions = await prisma.userSession.findMany({
    where: {
      createdAt: {
        gte: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3),
      },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 15,
  });

  return {
    items: sessions.map((session) => ({
      id: `audit-session-${session.id}`,
      actor: session.user?.name || session.user?.email || "Usuario",
      actorRole: "seller",
      action: "Sessao iniciada",
      target: "Autenticacao",
      severity: "neutral",
      createdAt: toIso(session.createdAt),
    })),
  };
}

function normalizeMarketplaceName(value) {
  return String(value || "Marketplace").trim() || "Marketplace";
}

function statusFromIssues(issueCount) {
  if (issueCount <= 0) {
    return "success";
  }

  if (issueCount >= 4) {
    return "danger";
  }

  return "warning";
}

async function getAdminIntegrations() {
  const now = new Date();
  const accounts = await prisma.marketplaceAccount.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      marketplace: true,
      accountName: true,
      tokenExpiresAt: true,
      updatedAt: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  const byMarketplace = new Map();

  accounts.forEach((account) => {
    const marketplace = normalizeMarketplaceName(account.marketplace);
    const tokenExpiring =
      account.tokenExpiresAt &&
      account.tokenExpiresAt.getTime() > now.getTime() &&
      account.tokenExpiresAt.getTime() - now.getTime() <= 1000 * 60 * 60 * 48;
    const stale = new Date(account.updatedAt).getTime() < now.getTime() - 1000 * 60 * 60 * 24 * 7;

    const current = byMarketplace.get(marketplace) || {
      id: `mk-${byMarketplace.size + 1}`,
      name: marketplace,
      healthyAccounts: 0,
      accountsWithIssues: 0,
      tokenExpiring: 0,
      reconciliationLag: "0 min",
      incidentCount: 0,
      status: "success",
      note: "",
    };

    const hasIssue = Boolean(tokenExpiring || stale);

    if (hasIssue) {
      current.accountsWithIssues += 1;
      current.incidentCount += 1;
    } else {
      current.healthyAccounts += 1;
    }

    if (tokenExpiring) {
      current.tokenExpiring += 1;
    }

    const lagMinutes = Math.max(
      0,
      Math.round((now.getTime() - new Date(account.updatedAt).getTime()) / (1000 * 60))
    );
    current.reconciliationLag = `${Math.max(
      Number(String(current.reconciliationLag).replace(/[^\d]/g, "")) || 0,
      lagMinutes
    )} min`;

    current.status = statusFromIssues(current.accountsWithIssues);
    current.note =
      current.accountsWithIssues > 0
        ? "Existem contas com token ou sincronizacao exigindo acao."
        : "Contas sem pendencias relevantes no momento.";

    byMarketplace.set(marketplace, current);
  });

  const marketplaces = Array.from(byMarketplace.values());

  const expiringTokens = accounts
    .filter((account) => {
      if (!account.tokenExpiresAt) {
        return false;
      }

      const expiresIn = account.tokenExpiresAt.getTime() - now.getTime();
      return expiresIn > 0 && expiresIn <= 1000 * 60 * 60 * 48;
    })
    .slice(0, 20)
    .map((account) => {
      const expiresInMs = account.tokenExpiresAt.getTime() - now.getTime();
      const expiresInHours = Math.max(1, Math.round(expiresInMs / (1000 * 60 * 60)));

      return {
        id: `tok-${account.id}`,
        accountName: account.accountName,
        marketplace: normalizeMarketplaceName(account.marketplace),
        expiresIn: `${expiresInHours} h`,
        owner: account.user?.name || "Seller",
      };
    });

  return {
    summary: [
      {
        id: "integration-issues",
        label: "Contas com falha",
        value: String(marketplaces.reduce((acc, item) => acc + item.accountsWithIssues, 0)),
        tone: toneForCount(
          marketplaces.reduce((acc, item) => acc + item.accountsWithIssues, 0),
          1,
          8
        ),
      },
      {
        id: "integration-expiring-tokens",
        label: "Tokens expirando",
        value: String(expiringTokens.length),
        tone: toneForCount(expiringTokens.length, 1, 5),
      },
      {
        id: "integration-marketplaces",
        label: "Marketplaces monitorados",
        value: String(marketplaces.length),
        tone: "neutral",
      },
      {
        id: "integration-accounts",
        label: "Contas monitoradas",
        value: String(accounts.length),
        tone: "neutral",
      },
    ],
    marketplaces,
    expiringTokens,
    reconciliationQueue: marketplaces.map((item) => ({
      id: `queue-${item.id}`,
      name: `Pendencias ${item.name}`,
      backlog: item.accountsWithIssues,
      owner: "Integracoes",
      severity: item.accountsWithIssues > 0 ? "warning" : "neutral",
    })),
    incidents: marketplaces
      .filter((item) => item.accountsWithIssues > 0)
      .map((item) => ({
        id: `incident-${item.id}`,
        title: `${item.name} com contas exigindo reconexao`,
        severity: item.accountsWithIssues >= 4 ? "warning" : "success",
        createdAt: now.toISOString(),
      })),
  };
}

module.exports = {
  getAdminIntegrations,
  getAdminUsers,
  getAuditTrail,
  getObservability,
  toggleAdminUserBlock,
};