const liveProvider = require("../mercadolivreQuestions.live.service");
const { normalizeText, createHttpError } = require("./primitives");
const {
  resolveViewerUser,
  resolveOrCreateMercadoLivreAccount,
  resolveMercadoLivreAccountById,
  persistAccountTokenState,
} = require("./shared");
const { createOAuthStatePayload, consumeOAuthStatePayload } = require("./state");

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
  getAuthorizationUrl,
  completeAuthorizationCallback,
};
