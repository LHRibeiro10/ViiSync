const prisma = require("../../../lib/prisma");
const { ensureDate } = require("./primitives");
const { upsertProductFromMarketplaceItem } = require("./productUpsert");

async function persistRemoteItems(user, account, remoteItems = [], lastSyncAt = null) {
  const syncTimestamp = ensureDate(lastSyncAt, new Date()) || new Date();
  let imported = 0;

  for (const item of remoteItems) {
    const upserted = await upsertProductFromMarketplaceItem(
      user.id,
      account.id,
      item,
      syncTimestamp
    );

    if (upserted?.id) {
      imported += 1;
    }
  }

  await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      lastSyncedAt: syncTimestamp,
      integrationStatus: "connected",
    },
  });

  return {
    imported,
    lastSyncAt: syncTimestamp.toISOString(),
  };
}

module.exports = {
  persistRemoteItems,
};
