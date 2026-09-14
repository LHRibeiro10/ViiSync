const prisma = require("../../lib/prisma");
const {
  resolveViewerUser,
  normalizeText,
  buildRealMarketplaceAccountWhere,
  dateTimeFormatter,
} = require("./shared");

function normalizeStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (normalized.includes("pend")) return "Pendente";
  if (normalized.includes("env")) return "Enviado";
  if (normalized.includes("entreg")) return "Entregue";
  if (normalized.includes("cancel")) return "Cancelado";

  return status ? String(status) : "Em processamento";
}

async function getAccounts(request = {}) {
  const user = await resolveViewerUser(request);

  const accounts = await prisma.marketplaceAccount.findMany({
    where: {
      userId: user.id,
      ...buildRealMarketplaceAccountWhere(),
    },
    include: {
      orders: {
        select: {
          id: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return accounts.map((account) => {
    const latestOrderUpdate = account.orders.reduce((latest, order) => {
      const time = new Date(order.updatedAt).getTime();
      return time > latest ? time : latest;
    }, 0);
    const syncReference = account.lastSyncedAt
      ? new Date(account.lastSyncedAt)
      : latestOrderUpdate
        ? new Date(latestOrderUpdate)
        : new Date(account.updatedAt);
    const hasCredentials = Boolean(account.accessToken || account.refreshToken);
    const hasSellerId = Boolean(normalizeText(account.sellerId));
    const status =
      hasSellerId &&
      hasCredentials &&
      normalizeText(account.integrationStatus).toLowerCase() === "connected"
        ? "Conectada"
        : "Pendente";

    return {
      id: account.id,
      name: account.accountName,
      marketplace: account.marketplace,
      status,
      lastSync: dateTimeFormatter.format(syncReference),
      orders: account.orders.length,
      syncStatus: normalizeText(account.syncStatus) || "idle",
      syncLastError: account.syncLastError || null,
    };
  });
}

module.exports = {
  normalizeStatus,
  getAccounts,
};
