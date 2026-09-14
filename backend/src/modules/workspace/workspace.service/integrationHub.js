const prisma = require("../../../lib/prisma");
const { resolveViewerUser } = require("./shared");

function isMercadoLivreMarketplace(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("mercado livre") || normalized.includes("mercadolivre");
}

function normalizeSyncStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (["idle", "syncing", "success", "error"].includes(normalized)) {
    return normalized;
  }

  return "idle";
}

function getSyncStatusLabel(status) {
  const normalized = normalizeSyncStatus(status);

  if (normalized === "syncing") {
    return "Sincronizando";
  }

  if (normalized === "success") {
    return "Sucesso";
  }

  if (normalized === "error") {
    return "Erro";
  }

  return "Aguardando";
}

async function getIntegrationHub(request = {}) {
  const user = await resolveViewerUser(request);
  const now = new Date();
  const nowMs = now.getTime();

  const accounts = await prisma.marketplaceAccount.findMany({
    where: {
      userId: user.id,
      OR: [
        {
          marketplace: {
            contains: "mercado livre",
            mode: "insensitive",
          },
        },
        {
          marketplace: {
            contains: "mercadolivre",
            mode: "insensitive",
          },
        },
      ],
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const accountIds = accounts.map((account) => account.id);
  const questionRows = accountIds.length
    ? await prisma.mercadoLivreQuestion.findMany({
        where: {
          userId: user.id,
          marketplaceAccountId: {
            in: accountIds,
          },
          dismissedAt: null,
        },
        select: {
          marketplaceAccountId: true,
          status: true,
          answeredAtMl: true,
        },
      })
    : [];

  const pendingByAccountId = questionRows.reduce((accumulator, question) => {
    const isAnswered =
      String(question.status || "").trim().toLowerCase() === "answered" ||
      Boolean(question.answeredAtMl);

    if (!isAnswered) {
      const current = accumulator.get(question.marketplaceAccountId) || 0;
      accumulator.set(question.marketplaceAccountId, current + 1);
    }

    return accumulator;
  }, new Map());

  const accountsPayload = accounts
    .filter((account) => isMercadoLivreMarketplace(account.marketplace))
    .map((account) => {
      const hasAccessToken = Boolean(account.accessToken);
      const hasRefreshToken = Boolean(account.refreshToken);
      const hasCredentials = hasAccessToken || hasRefreshToken;
      const hasSellerId = Boolean(String(account.sellerId || "").trim());
      const integrationConnected =
        String(account.integrationStatus || "").trim().toLowerCase() === "connected";
      const tokenExpiresAtMs = account.tokenExpiresAt
        ? new Date(account.tokenExpiresAt).getTime()
        : null;
      const tokenExpired = Boolean(
        hasAccessToken && tokenExpiresAtMs && tokenExpiresAtMs <= nowMs
      );
      const tokenExpiringSoon = Boolean(
        hasAccessToken &&
          tokenExpiresAtMs &&
          tokenExpiresAtMs > nowMs &&
          tokenExpiresAtMs - nowMs <= 1000 * 60 * 60 * 48
      );
      const connected =
        Boolean(account.isActive) &&
        integrationConnected &&
        hasSellerId &&
        hasCredentials;
      const reconnectRecommended = !connected || (tokenExpired && !hasRefreshToken);
      const queueBacklog = Number(pendingByAccountId.get(account.id) || 0);
      const syncStatus = normalizeSyncStatus(account.syncStatus);
      const syncStatusLabel = getSyncStatusLabel(syncStatus);
      const lastSyncAt = (
        account.lastSyncedAt ||
        account.syncLastFinishedAt ||
        account.updatedAt
      )?.toISOString?.() || null;

      let tokenStatus = "Sem token";
      if (hasAccessToken && tokenExpired && hasRefreshToken) {
        tokenStatus = "Expirado (renovavel)";
      } else if (hasAccessToken && tokenExpired) {
        tokenStatus = "Expirado";
      } else if (hasAccessToken && tokenExpiringSoon) {
        tokenStatus = "Expira em breve";
      } else if (hasAccessToken) {
        tokenStatus = "Ativo";
      } else if (hasRefreshToken) {
        tokenStatus = "Renovavel";
      }

      return {
        id: account.id,
        name: account.accountName || "Conta Mercado Livre",
        marketplace: account.marketplace || "Mercado Livre",
        status: connected ? "Conectado" : "Pendente",
        connected,
        reconnectRecommended,
        lastSyncAt,
        latency: "N/D",
        queueBacklog,
        tokenStatus,
        syncStatus,
        syncStatusLabel,
        syncLastError: account.syncLastError || null,
        syncLastStartedAt: account.syncLastStartedAt
          ? account.syncLastStartedAt.toISOString()
          : null,
        syncLastFinishedAt: account.syncLastFinishedAt
          ? account.syncLastFinishedAt.toISOString()
          : null,
        note: reconnectRecommended
          ? "Conecte via OAuth para sincronizar perguntas, pedidos e produtos."
          : syncStatus === "error" && account.syncLastError
            ? `Ultima falha: ${String(account.syncLastError).slice(0, 180)}`
            : "Conta pronta para sincronizacao operacional com o Mercado Livre.",
      };
    });

  const connectedCount = accountsPayload.filter(
    (account) => account.connected
  ).length;
  const reconnectCount = accountsPayload.filter(
    (account) => account.reconnectRecommended
  ).length;
  const pendingQuestions = accountsPayload.reduce(
    (sum, account) => sum + Number(account.queueBacklog || 0),
    0
  );

  const summary = [
    {
      id: "integration-summary-accounts",
      label: "Contas Mercado Livre",
      value: String(accountsPayload.length),
      tone: "neutral",
    },
    {
      id: "integration-summary-connected",
      label: "Contas conectadas",
      value: String(connectedCount),
      tone: connectedCount > 0 ? "success" : "warning",
    },
    {
      id: "integration-summary-actions",
      label: "Acoes pendentes",
      value: String(reconnectCount + (pendingQuestions > 0 ? 1 : 0)),
      tone: reconnectCount > 0 ? "warning" : "success",
    },
    {
      id: "integration-summary-questions",
      label: "Perguntas pendentes",
      value: String(pendingQuestions),
      tone: pendingQuestions > 0 ? "warning" : "success",
    },
  ];

  const syncEvents = accountsPayload.map((account) => ({
    id: `event-${account.id}`,
    title: account.reconnectRecommended
      ? `${account.name} precisa de reconexao`
      : `${account.name} em status ${account.syncStatusLabel.toLowerCase()}`,
    source: "Mercado Livre",
    createdAt: account.lastSyncAt,
  }));

  const actions = [];

  if (!accountsPayload.length) {
    actions.push({
      id: "action-connect-first-account",
      title: "Conectar primeira conta do Mercado Livre",
      description:
        "Conecte via OAuth para habilitar perguntas, dashboard e relatorios por canal.",
      cta: "Conectar conta",
    });
  }

  accountsPayload
    .filter((account) => account.reconnectRecommended)
    .forEach((account) => {
      actions.push({
        id: `action-reconnect-${account.id}`,
        title: `Reconectar ${account.name}`,
        description:
          "A conta esta sem credenciais validas. Refaca a autorizacao para normalizar a sincronizacao.",
        cta: "Reconectar agora",
      });
    });

  if (pendingQuestions > 0) {
    actions.push({
      id: "action-review-questions",
      title: `${pendingQuestions} pergunta(s) aguardando resposta`,
      description:
        "Priorize a inbox de perguntas para manter SLA operacional no Mercado Livre.",
      cta: "Abrir perguntas ML",
    });
  }

  if (!actions.length) {
    actions.push({
      id: "action-all-good",
      title: "Integracao operacionalizada",
      description:
        "Sua conta Mercado Livre esta conectada e sem pendencias criticas no momento.",
      cta: "Tudo em dia",
    });
  }

  return {
    summary,
    accounts: accountsPayload,
    syncEvents,
    actions,
  };
}

module.exports = {
  getIntegrationHub,
};
