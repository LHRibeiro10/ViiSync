const prisma = require("../../../lib/prisma");
const liveProvider = require("../mercadolivreQuestions.live.service");
const { normalizeText, createHttpError } = require("./primitives");
const { resolveViewerUser, resolveMercadoLivreAccount, persistAccountTokenState } = require("./shared");
const { SYNC_STATUS, normalizeSyncStatus, getSyncStatusLabel } = require("./state");

function hasPersistedIntegrationCredentials(account) {
  return Boolean(account?.accessToken || account?.refreshToken);
}

function hasSellerIdentity(account) {
  return Boolean(normalizeText(account?.sellerId));
}

function hasConnectedIntegrationStatus(account) {
  return normalizeText(account?.integrationStatus).toLowerCase() === "connected";
}

function isMarketplaceAccountOperationallyConnected(account, currentMode) {
  if (!account || currentMode === "mock") {
    return false;
  }

  return (
    Boolean(account.isActive) &&
    hasConnectedIntegrationStatus(account) &&
    hasSellerIdentity(account) &&
    hasPersistedIntegrationCredentials(account)
  );
}

function buildSyncPayloadFromAccount(account) {
  if (!account) {
    return {
      status: SYNC_STATUS.IDLE,
      statusLabel: getSyncStatusLabel(SYNC_STATUS.IDLE),
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSyncedAt: null,
      lastError: null,
    };
  }

  const syncStatus = normalizeSyncStatus(account.syncStatus);

  return {
    status: syncStatus,
    statusLabel: getSyncStatusLabel(syncStatus),
    lastStartedAt: account.syncLastStartedAt
      ? account.syncLastStartedAt.toISOString()
      : null,
    lastFinishedAt: account.syncLastFinishedAt
      ? account.syncLastFinishedAt.toISOString()
      : null,
    lastSyncedAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
    lastError: account.syncLastError || null,
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
      connectionStatus: "pending",
      sync: buildSyncPayloadFromAccount(null),
      account: null,
      instructions: "Conecte uma conta do Mercado Livre para habilitar a integracao.",
    };
  }

  const hasCredentials = hasPersistedIntegrationCredentials(account);
  const hasRefreshToken = Boolean(account.refreshToken);
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
  const usingLive = isMarketplaceAccountOperationallyConnected(account, currentMode);
  const needsReconnect =
    !usingLive || (tokenExpired && !hasRefreshToken);

  return {
    mode: currentMode,
    usingLive,
    hasCredentials,
    source: hasCredentials ? "database" : "none",
    connectionStatus: usingLive ? "connected" : "pending",
    tokenExpired,
    tokenExpiringSoon,
    tokenCanRefresh: hasRefreshToken,
    needsReconnect,
    sync: buildSyncPayloadFromAccount(account),
    account: {
      sellerId: account.sellerId || null,
      accountName: account.accountName || null,
      siteId: account.siteId || null,
      tokenExpiresAt,
      lastSyncedAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
      integrationStatus: account.integrationStatus || "disconnected",
      syncStatus: normalizeSyncStatus(account.syncStatus),
      syncStatusLabel: getSyncStatusLabel(account.syncStatus),
      syncLastError: account.syncLastError || null,
      syncLastStartedAt: account.syncLastStartedAt
        ? account.syncLastStartedAt.toISOString()
        : null,
      syncLastFinishedAt: account.syncLastFinishedAt
        ? account.syncLastFinishedAt.toISOString()
        : null,
    },
    instructions: needsReconnect
      ? "Conecte via OAuth para restaurar a integracao desta conta."
      : null,
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
      syncStatus: SYNC_STATUS.IDLE,
      syncLastError: null,
      syncLastFinishedAt: new Date(),
    },
  });

  return {
    disconnected: true,
    message: "Conta Mercado Livre desconectada com sucesso.",
  };
}

module.exports = {
  getIntegrationStatus,
  refreshIntegrationToken,
  disconnectIntegration,
};
