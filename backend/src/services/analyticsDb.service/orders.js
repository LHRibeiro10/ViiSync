const prisma = require("../../lib/prisma");
const { DEFAULT_PERIOD, resolvePeriodRange } = require("../../lib/period");
const { normalizeStatus } = require("./accounts");
const {
  round2,
  createHttpError,
  formatCurrency,
  resolveViewerUser,
  buildRealMarketplaceAccountWhere,
  dateTimeFormatter,
} = require("./shared");

function parseDateTimeInput(value) {
  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function resolveOrdersDateRange(filters = {}) {
  const startAt = parseDateTimeInput(filters.startAt);
  const endAt = parseDateTimeInput(filters.endAt);

  if ((startAt && !endAt) || (!startAt && endAt)) {
    throw createHttpError(
      400,
      "Informe data inicial e final para filtrar pedidos."
    );
  }

  if (startAt && endAt) {
    if (startAt.getTime() > endAt.getTime()) {
      throw createHttpError(
        400,
        "A data inicial deve ser menor ou igual a data final."
      );
    }

    return {
      source: "custom-range",
      period: String(filters.preset || "").trim() || "custom",
      startDate: startAt,
      endDate: endAt,
    };
  }

  if (filters.period) {
    const range = resolvePeriodRange(filters.period, {
      fallbackPeriod: DEFAULT_PERIOD,
    });

    return {
      source: "period",
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
    };
  }

  return null;
}

function mapOrderRowToListItem(order) {
  return {
    id: order.marketplaceOrderId || order.id,
    marketplaceOrderId: order.marketplaceOrderId || null,
    product: order.items[0]?.title || "Pedido sem item",
    marketplace: order.marketplaceAccount?.marketplace || "Marketplace",
    account: order.marketplaceAccount?.accountName || "Conta",
    value: formatCurrency(Number(order.totalAmount || 0)),
    valueAmount: round2(Number(order.totalAmount || 0)),
    netReceived: round2(Number(order.netReceived || 0)),
    status: normalizeStatus(order.status),
    saleDate: order.saleDate ? order.saleDate.toISOString() : null,
    saleDateLabel: order.saleDate ? dateTimeFormatter.format(order.saleDate) : "--",
  };
}

function buildOrdersSummary(items = []) {
  const totalOrders = items.length;
  const grossRevenue = items.reduce((sum, item) => sum + Number(item.valueAmount || 0), 0);
  const netReceived = items.reduce((sum, item) => sum + Number(item.netReceived || 0), 0);

  return {
    totalOrders,
    grossRevenue: round2(grossRevenue),
    netReceived: round2(netReceived),
    averageTicket: totalOrders ? round2(grossRevenue / totalOrders) : 0,
  };
}

async function getOrdersPayload(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);
  const range = resolveOrdersDateRange(filters);
  const where = {
    userId: user.id,
    marketplaceAccount: {
      is: buildRealMarketplaceAccountWhere(),
    },
  };

  if (range?.startDate && range?.endDate) {
    where.saleDate = {
      gte: range.startDate,
      lte: range.endDate,
    };
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      marketplaceAccount: true,
      items: {
        select: {
          title: true,
        },
        take: 1,
      },
    },
    orderBy: {
      saleDate: "desc",
    },
  });

  const items = orders.map(mapOrderRowToListItem);
  const summary = buildOrdersSummary(items);

  return {
    items,
    summary,
    meta: {
      total: items.length,
      period: range?.period || null,
      source: range?.source || "all",
      startAt: range?.startDate ? range.startDate.toISOString() : null,
      endAt: range?.endDate ? range.endDate.toISOString() : null,
    },
  };
}

async function getOrders(request = {}) {
  const payload = await getOrdersPayload({}, request);
  return payload.items;
}

module.exports = {
  resolveOrdersDateRange,
  mapOrderRowToListItem,
  buildOrdersSummary,
  getOrdersPayload,
  getOrders,
  parseDateTimeInput,
};
