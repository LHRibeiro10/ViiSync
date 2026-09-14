const prisma = require("../../../lib/prisma");
const liveProvider = require("../mercadolivreQuestions.live.service");
const { normalizeText, createHttpError, ensureDate } = require("./primitives");
const {
  resolveViewerUser,
  resolveMercadoLivreAccount,
  buildAccountTokenSource,
  canUseLiveProvider,
  ensureLiveAccountToken,
  persistAccountTokenState,
  mercadoLivreAccountWhere,
  MERCADO_LIVRE_ACCOUNT_SELECT,
} = require("./shared");
const { runAccountSyncWithLifecycle } = require("./state");
const { pullAndPersistQuestions } = require("./questionsSync");
const { persistRemoteOrders } = require("./ordersSync");
const { persistRemoteItems } = require("./itemsSync");

// So usada aqui: apesar de estar fisicamente perto do grupo de integration
// status no arquivo original, o unico call site real e syncMarketplaceDataForUserAndAccount.
function resolveLastSyncTimestamp(...values) {
  for (const value of values) {
    const parsed = ensureDate(value, null);
    if (parsed) {
      return parsed.toISOString();
    }
  }

  return null;
}

async function syncQuestionsForAccount(user, account) {
  const syncResult = await pullAndPersistQuestions(user, account);

  return {
    synced: Boolean(syncResult?.synced),
    imported: Number(syncResult?.imported || 0),
    lastSyncAt: syncResult?.lastSyncAt || null,
  };
}

async function syncOrdersForAccount(user, account, options = {}) {
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
    imported: Number(persisted?.imported || 0),
    lastSyncAt: persisted?.lastSyncAt || null,
  };
}

async function syncItemsForAccount(user, account, options = {}) {
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
    imported: Number(persisted?.imported || 0),
    lastSyncAt: persisted?.lastSyncAt || null,
  };
}

async function syncMarketplaceDataForUserAndAccount(user, account, options = {}) {
  const questions = await syncQuestionsForAccount(user, account);
  const orders = await syncOrdersForAccount(user, account, options);
  const items = await syncItemsForAccount(user, account, options);
  const lastSyncAt = resolveLastSyncTimestamp(
    items?.lastSyncAt,
    orders?.lastSyncAt,
    questions?.lastSyncAt
  );

  return {
    synced: true,
    summary: {
      questionsImported: questions.imported || 0,
      ordersImported: orders.imported || 0,
      itemsImported: items.imported || 0,
      lastSyncAt,
    },
  };
}

async function syncMarketplaceDataByAccountId(accountId, options = {}) {
  const normalizedAccountId = normalizeText(accountId);
  if (!normalizedAccountId) {
    throw createHttpError(400, "Conta Mercado Livre invalida.");
  }

  const account = await prisma.marketplaceAccount.findFirst({
    where: {
      id: normalizedAccountId,
      ...mercadoLivreAccountWhere(),
    },
    select: MERCADO_LIVRE_ACCOUNT_SELECT,
  });

  if (!account?.id || !account?.userId) {
    throw createHttpError(404, "Conta Mercado Livre nao encontrada.");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: account.userId,
    },
    select: {
      id: true,
    },
  });

  if (!user?.id) {
    throw createHttpError(404, "Usuario da conta Mercado Livre nao encontrado.");
  }

  const result = await runAccountSyncWithLifecycle(
    account.id,
    async () => syncMarketplaceDataForUserAndAccount(user, account, options),
    {
      resolveLastSyncAt: (payload) => payload?.summary?.lastSyncAt || null,
    }
  );

  return {
    synced: true,
    message: "Sincronizacao completa do Mercado Livre concluida.",
    summary: result.summary,
  };
}

async function syncOrders(options = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    throw createHttpError(404, "Nenhuma conta Mercado Livre encontrada.");
  }

  const result = await runAccountSyncWithLifecycle(
    account.id,
    async () => syncOrdersForAccount(user, account, options),
    {
      resolveLastSyncAt: (payload) => payload?.lastSyncAt || null,
    }
  );

  return {
    synced: true,
    imported: result.imported,
    lastSyncAt: result.lastSyncAt,
    message: "Pedidos sincronizados com sucesso a partir da API do Mercado Livre.",
  };
}

async function syncItems(options = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    throw createHttpError(404, "Nenhuma conta Mercado Livre encontrada.");
  }

  const result = await runAccountSyncWithLifecycle(
    account.id,
    async () => syncItemsForAccount(user, account, options),
    {
      resolveLastSyncAt: (payload) => payload?.lastSyncAt || null,
    }
  );

  return {
    synced: true,
    imported: result.imported,
    lastSyncAt: result.lastSyncAt,
    message: "Anuncios/produtos sincronizados com sucesso a partir da API do Mercado Livre.",
  };
}

async function syncMarketplaceData(options = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    throw createHttpError(404, "Nenhuma conta Mercado Livre encontrada.");
  }

  const result = await runAccountSyncWithLifecycle(
    account.id,
    async () => syncMarketplaceDataForUserAndAccount(user, account, options),
    {
      resolveLastSyncAt: (payload) => payload?.summary?.lastSyncAt || null,
    }
  );

  return {
    synced: true,
    message: "Sincronizacao completa do Mercado Livre concluida.",
    summary: result.summary,
  };
}

module.exports = {
  syncMarketplaceDataByAccountId,
  syncOrders,
  syncItems,
  syncMarketplaceData,
};
