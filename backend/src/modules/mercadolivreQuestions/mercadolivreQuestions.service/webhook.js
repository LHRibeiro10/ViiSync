const { randomUUID } = require("crypto");

const prisma = require("../../../lib/prisma");
const liveProvider = require("../mercadolivreQuestions.live.service");
const { normalizeText } = require("./primitives");
const { mercadoLivreAccountWhere, MERCADO_LIVRE_ACCOUNT_SELECT } = require("./shared");
const { recordWebhookEvent, getRecentWebhookEvents, runAccountSyncWithLifecycle } = require("./state");
const { pullAndPersistQuestions } = require("./questionsSync");

async function receiveWebhook(payload = {}) {
  const eventId = payload.id || randomUUID();
  const receivedAt = new Date().toISOString();

  recordWebhookEvent({
    id: eventId,
    topic: payload.topic || "questions",
    resource: payload.resource || null,
    receivedAt,
  });

  let queued = false;
  let imported = 0;
  const sellerIdFromWebhook = normalizeText(
    payload.user_id || payload.seller_id || payload.sellerId
  );

  try {
    const hasCredentials = await liveProvider.hasLiveCredentials();
    const currentMode = liveProvider.mode();

    if (currentMode !== "mock" && hasCredentials && sellerIdFromWebhook) {
      const account = await prisma.marketplaceAccount.findFirst({
        where: {
          ...mercadoLivreAccountWhere(),
          sellerId: sellerIdFromWebhook,
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: MERCADO_LIVRE_ACCOUNT_SELECT,
      });

      if (account?.userId) {
        const user = await prisma.user.findUnique({
          where: {
            id: account.userId,
          },
          select: {
            id: true,
          },
        });

        if (user) {
          const syncResult = await runAccountSyncWithLifecycle(
            account.id,
            async () => pullAndPersistQuestions(user, account),
            {
              resolveLastSyncAt: (result) => result?.lastSyncAt || null,
            }
          );
          queued = syncResult.synced;
          imported = syncResult.imported;
        }
      }
    }
  } catch (error) {
    console.error("[mercadolivre-questions:webhook-sync]", error);
  }

  return {
    received: true,
    mode: (await liveProvider.hasLiveCredentials()) ? "live" : "mock",
    eventId,
    queued,
    imported,
    latestEvents: getRecentWebhookEvents(5),
  };
}

module.exports = {
  receiveWebhook,
};
