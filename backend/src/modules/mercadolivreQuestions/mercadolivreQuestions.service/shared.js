const prisma = require("../../../lib/prisma");
const { resolveSessionContextFromRequest } = require("../../auth/auth.service");
const liveProvider = require("../mercadolivreQuestions.live.service");
const {
  createHttpError,
  normalizeText,
  ensureDate,
  MercadoLivreQuestionValidationError,
} = require("./primitives");
const { SYNC_STATUS, normalizeSyncStatus } = require("./state");

const MERCADO_LIVRE_ACCOUNT_SELECT = {
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
  autoSyncEnabled: true,
  syncStatus: true,
  syncLastStartedAt: true,
  syncLastFinishedAt: true,
  syncLastError: true,
  marketplace: true,
  isActive: true,
};

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
    select: MERCADO_LIVRE_ACCOUNT_SELECT,
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
    select: MERCADO_LIVRE_ACCOUNT_SELECT,
  });
}

function buildAccountTokenSource(account) {
  if (!account?.accessToken && !account?.refreshToken) {
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
  const tokenExpiresAt =
    ensureDate(nextTokenState.expiresAt, account.tokenExpiresAt || null) ||
    new Date(Date.now() + 1000 * 60 * 60 * 6);

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
      syncStatus: normalizeSyncStatus(account.syncStatus) || SYNC_STATUS.IDLE,
      isActive: true,
    },
    select: MERCADO_LIVRE_ACCOUNT_SELECT,
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
      select: MERCADO_LIVRE_ACCOUNT_SELECT,
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
      autoSyncEnabled: true,
      syncStatus: SYNC_STATUS.IDLE,
    },
    select: MERCADO_LIVRE_ACCOUNT_SELECT,
  });
}

async function canUseLiveProvider(account) {
  const currentMode = liveProvider.mode();

  if (currentMode === "mock") {
    return false;
  }

  if (account?.accessToken || account?.refreshToken) {
    return true;
  }

  if (currentMode === "live") {
    throw new MercadoLivreQuestionValidationError(
      "Modo live ativo, mas essa conta nao possui credenciais OAuth persistidas."
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
    if (!account.accessToken && !account.refreshToken) {
      throw createHttpError(
        400,
        "Conta Mercado Livre sem credenciais OAuth para sincronizar."
      );
    }

    return account;
  }

  const refreshed = await liveProvider.refreshAccessToken(account.refreshToken);

  return persistAccountTokenState(account, refreshed);
}

module.exports = {
  MERCADO_LIVRE_ACCOUNT_SELECT,
  mercadoLivreAccountWhere,
  resolveViewerUser,
  resolveMercadoLivreAccount,
  resolveMercadoLivreAccountById,
  buildAccountTokenSource,
  persistAccountTokenState,
  resolveOrCreateMercadoLivreAccount,
  canUseLiveProvider,
  ensureLiveAccountToken,
};
