const prisma = require("../../../lib/prisma");
const { normalizeText, round2, toNumber } = require("./primitives");

async function upsertProductFromMarketplaceItem(userId, marketplaceAccountId, item, syncedAt) {
  const marketplaceProductId = normalizeText(item?.id);

  if (!userId || !marketplaceAccountId || !marketplaceProductId) {
    return null;
  }

  const title = normalizeText(item?.title) || `Item ${marketplaceProductId}`;
  const sku = normalizeText(item?.sku) || null;
  const listingPrice = toNumber(item?.price, 0);
  const listingStatus = normalizeText(item?.status) || "unknown";
  const availableQuantity = Math.max(0, Math.floor(toNumber(item?.availableQuantity, 0)));
  const thumbnail = normalizeText(item?.thumbnail) || null;
  const category = normalizeText(item?.category) || null;

  const existing = await prisma.product.findFirst({
    where: {
      userId,
      marketplaceAccountId,
      marketplaceProductId,
    },
    select: {
      id: true,
    },
  });

  if (existing?.id) {
    return prisma.product.update({
      where: {
        id: existing.id,
      },
      data: {
        title,
        sku,
        thumbnail,
        category,
        listingPrice: round2(listingPrice),
        listingStatus,
        availableQuantity,
        lastSyncedAt: syncedAt,
      },
      select: {
        id: true,
      },
    });
  }

  return prisma.product.create({
    data: {
      userId,
      marketplaceAccountId,
      marketplaceProductId,
      title,
      sku,
      thumbnail,
      category,
      listingPrice: round2(listingPrice),
      listingStatus,
      availableQuantity,
      lastSyncedAt: syncedAt,
    },
    select: {
      id: true,
    },
  });
}

async function ensureProductForOrderItem(userId, marketplaceAccountId, item = {}, syncedAt) {
  const marketplaceProductId = normalizeText(item.marketplaceItemId);
  const thumbnail = normalizeText(item.thumbnail) || null;

  if (!marketplaceProductId) {
    return null;
  }

  const existing = await prisma.product.findFirst({
    where: {
      userId,
      marketplaceAccountId,
      marketplaceProductId,
    },
    select: {
      id: true,
    },
  });

  if (existing?.id) {
    await prisma.product.update({
      where: {
        id: existing.id,
      },
      data: {
        title: normalizeText(item.title) || undefined,
        sku: normalizeText(item.sku) || undefined,
        thumbnail: thumbnail || undefined,
        lastSyncedAt: syncedAt,
      },
    });

    return existing.id;
  }

  const created = await prisma.product.create({
    data: {
      userId,
      marketplaceAccountId,
      marketplaceProductId,
      title: normalizeText(item.title) || `Item ${marketplaceProductId}`,
      sku: normalizeText(item.sku) || null,
      thumbnail,
      listingPrice: round2(toNumber(item.unitPrice, 0)),
      listingStatus: "active",
      availableQuantity: 0,
      lastSyncedAt: syncedAt,
    },
    select: {
      id: true,
    },
  });

  return created.id;
}

module.exports = {
  upsertProductFromMarketplaceItem,
  ensureProductForOrderItem,
};
