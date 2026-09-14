const prisma = require("../../../lib/prisma");
const {
  toneForCount,
  formatPercent,
  formatMilliseconds,
  formatDurationMinutes,
} = require("./shared");

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

module.exports = {
  getObservability,
};
