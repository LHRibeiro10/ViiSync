const prisma = require("../../../lib/prisma");
const { round2 } = require("./primitives");
const { resolveViewerUser, resolveMercadoLivreAccount } = require("./shared");

async function listMarketplaceOrders(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    return {
      items: [],
      meta: {
        total: 0,
        source: "database",
      },
    };
  }

  const limit = Math.max(1, Math.min(Number(filters.limit) || 100, 300));
  const rows = await prisma.order.findMany({
    where: {
      userId: user.id,
      marketplaceAccountId: account.id,
    },
    orderBy: {
      saleDate: "desc",
    },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    take: limit,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      marketplaceOrderId: row.marketplaceOrderId,
      status: row.status,
      buyerName: row.buyerName || null,
      saleDate: row.saleDate ? row.saleDate.toISOString() : null,
      totalAmount: round2(row.totalAmount),
      marketplaceFee: round2(row.marketplaceFee),
      marketplaceFeeMissing: Boolean(row.marketplaceFeeMissing),
      shippingFee: round2(row.shippingFee),
      shippingFeeMissing: Boolean(row.shippingFeeMissing),
      discountAmount: round2(row.discountAmount),
      taxAmount: round2(row.taxAmount),
      taxAmountMissing: Boolean(row.taxAmountMissing),
      netReceived: round2(row.netReceived),
      items: (row.items || []).map((item) => ({
        id: item.id,
        marketplaceItemId: item.marketplaceItemId || null,
        title: item.title,
        sku: item.sku || null,
        quantity: item.quantity,
        unitPrice: round2(item.unitPrice),
        totalPrice: round2(item.totalPrice),
        unitCost: round2(item.unitCost),
        unitCostMissing: Boolean(item.unitCostMissing),
      })),
    })),
    meta: {
      total: rows.length,
      source: "database",
      lastSyncAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
    },
  };
}

async function listMarketplaceItems(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const account = await resolveMercadoLivreAccount(user.id);

  if (!account) {
    return {
      items: [],
      meta: {
        total: 0,
        source: "database",
      },
    };
  }

  const limit = Math.max(1, Math.min(Number(filters.limit) || 200, 500));
  const rows = await prisma.product.findMany({
    where: {
      userId: user.id,
      marketplaceAccountId: account.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      marketplaceProductId: row.marketplaceProductId || null,
      title: row.title,
      sku: row.sku || null,
      thumbnail: row.thumbnail || null,
      category: row.category || null,
      listingPrice: round2(row.listingPrice),
      listingStatus: row.listingStatus || null,
      availableQuantity: row.availableQuantity || 0,
      lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    })),
    meta: {
      total: rows.length,
      source: "database",
      lastSyncAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
    },
  };
}

module.exports = {
  listMarketplaceOrders,
  listMarketplaceItems,
};
