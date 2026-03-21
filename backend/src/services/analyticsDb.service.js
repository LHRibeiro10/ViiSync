const prisma = require("../lib/prisma");
const { resolveSessionContextFromRequest } = require("../modules/auth/auth.service");

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});
const reportDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const tableDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function resolvePeriod(period) {
  if (period === "7d" || period === "30d" || period === "90d") {
    return period;
  }

  return "30d";
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function startDateForPeriod(period) {
  const resolved = resolvePeriod(period);
  const now = new Date();
  const start = new Date(now);

  if (resolved === "7d") {
    start.setDate(now.getDate() - 6);
  } else if (resolved === "30d") {
    start.setDate(now.getDate() - 29);
  } else {
    start.setDate(now.getDate() - 89);
  }

  start.setHours(0, 0, 0, 0);
  return start;
}

function toMonthKeyFromDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseReferenceMonth(referenceMonth) {
  const text = String(referenceMonth || "").trim();
  const match = /^(\d{4})-(\d{2})$/.exec(text);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return text;
}

function listMonthKeysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  if (start.getTime() > end.getTime()) {
    return [];
  }

  const keys = [];
  let year = start.getFullYear();
  let month = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month + 1).padStart(2, "0")}`);

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return keys;
}

function clampDueDayToMonth(dueDay, year, monthIndex) {
  const monthLastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(Number(dueDay) || 1, monthLastDay));
}

function countRecurringOccurrencesInRange(dueDay, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  let occurrences = 0;
  let year = start.getFullYear();
  let month = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const day = clampDueDayToMonth(dueDay, year, month);
    const dueDate = new Date(year, month, day, 0, 0, 0, 0);

    if (dueDate.getTime() >= start.getTime() && dueDate.getTime() <= end.getTime()) {
      occurrences += 1;
    }

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return occurrences;
}

function mapAdditionalCostRow(row) {
  return {
    id: row.id,
    description: row.description,
    value: round2(Number(row.amount || 0)),
    monthReference: row.referenceMonth,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null,
  };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeAdditionalCostInput(payload = {}, { partial = false } = {}) {
  const normalized = {};

  if (!partial || payload.description !== undefined) {
    const description = normalizeText(payload.description);

    if (description.length < 2) {
      throw createHttpError(400, "Informe a descricao do gasto adicional.");
    }

    normalized.description = description;
  }

  if (!partial || payload.amount !== undefined || payload.value !== undefined) {
    const amount = Number(
      payload.amount !== undefined ? payload.amount : payload.value
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      throw createHttpError(400, "Informe um valor valido maior que zero.");
    }

    normalized.amount = round2(amount);
  }

  if (!partial || payload.referenceMonth !== undefined || payload.monthReference !== undefined) {
    const referenceMonth = parseReferenceMonth(
      payload.referenceMonth !== undefined
        ? payload.referenceMonth
        : payload.monthReference
    );

    if (!referenceMonth) {
      throw createHttpError(400, "Informe um mes de referencia valido no formato YYYY-MM.");
    }

    normalized.referenceMonth = referenceMonth;
  }

  return normalized;
}

async function getFinancialAdjustmentsForUser(userId, period = "30d") {
  if (!userId) {
    return {
      recurringTotal: 0,
      additionalTotal: 0,
      totalAdjustments: 0,
      additionalCosts: [],
      monthKeys: [],
    };
  }

  const resolvedPeriod = resolvePeriod(period);
  const periodStart = startDateForPeriod(resolvedPeriod);
  const periodEnd = new Date();
  const monthKeys = listMonthKeysBetween(periodStart, periodEnd);

  const [recurringExpenses, additionalCosts] = await Promise.all([
    prisma.recurringExpense.findMany({
      where: {
        userId,
      },
      select: {
        amount: true,
        dueDay: true,
      },
    }),
    prisma.additionalCost.findMany({
      where: {
        userId,
        ...(monthKeys.length
          ? {
              referenceMonth: {
                in: monthKeys,
              },
            }
          : {}),
      },
      orderBy: [{ referenceMonth: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const recurringTotal = round2(
    recurringExpenses.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return sum;
      }

      const occurrences = countRecurringOccurrencesInRange(
        item.dueDay,
        periodStart,
        periodEnd
      );

      return sum + amount * occurrences;
    }, 0)
  );

  const additionalTotal = round2(
    additionalCosts.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );

  return {
    recurringTotal,
    additionalTotal,
    totalAdjustments: round2(recurringTotal + additionalTotal),
    additionalCosts: additionalCosts.map(mapAdditionalCostRow),
    monthKeys,
  };
}

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

function createProductPhoto(label, startColor, endColor) {
  const safeLabel = String(label || "")
    .trim()
    .slice(0, 2)
    .toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="24" fill="url(#g)" />
      <rect x="12" y="12" width="72" height="72" rx="18" fill="rgba(255,255,255,0.18)" />
      <text x="48" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff">
        ${safeLabel}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function photoColorsForId(id = "") {
  const palette = [
    ["#1d4ed8", "#60a5fa"],
    ["#7c3aed", "#8b5cf6"],
    ["#0891b2", "#22d3ee"],
    ["#16a34a", "#4ade80"],
    ["#dc2626", "#fb7185"],
    ["#0f172a", "#334155"],
  ];

  let acc = 0;
  const text = String(id || "");
  for (let index = 0; index < text.length; index += 1) {
    acc += text.charCodeAt(index);
  }

  return palette[acc % palette.length];
}

function emptyDashboardPayload() {
  return {
    summary: {
      revenue: 0,
      profit: 0,
      sales: 0,
      averageTicket: 0,
    },
    topProducts: [],
    recentOrders: [],
  };
}

function emptyReportsPayload() {
  return {
    summary: {
      totalRevenue: formatCurrency(0),
      totalProfit: formatCurrency(0),
      totalOrders: 0,
      averageMargin: formatPercent(0),
    },
    channels: [],
    topProfitableProducts: [],
    rows: [],
  };
}

function emptySettingsPayload() {
  return {
    profile: {
      name: "Seller",
      email: "",
      company: "ViiSync Seller",
    },
    preferences: {
      theme: "Claro",
      periodDefault: "30 dias",
      notifications: "Ativadas",
    },
    security: {
      lastPasswordChange: "",
      twoFactor: "Desativado",
    },
  };
}

async function resolveViewerUser(request = {}) {
  const sessionContext = await resolveSessionContextFromRequest(request);

  if (!sessionContext?.user?.id) {
    throw createHttpError(401, "Sessao invalida ou expirada.");
  }

  const found = await prisma.user.findUnique({
    where: {
      id: sessionContext.user.id,
    },
    include: {
      memberships: {
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!found) {
    throw createHttpError(401, "Sessao invalida ou expirada.");
  }

  return found;
}

function toItemGrossRevenue(item) {
  if (Number.isFinite(item.totalPrice)) {
    return Number(item.totalPrice);
  }

  return round2((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0));
}

function allocateByShare(totalAmount, share) {
  return round2((Number(totalAmount) || 0) * share);
}

function buildProfitRowsFromOrders(orders = []) {
  const rows = [];

  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) {
      continue;
    }

    const itemsGrossBase = items.reduce((sum, item) => sum + toItemGrossRevenue(item), 0);
    const fallbackShare = items.length ? 1 / items.length : 0;

    for (const item of items) {
      const itemGross = toItemGrossRevenue(item);
      const share = itemsGrossBase > 0 ? itemGross / itemsGrossBase : fallbackShare;
      const marketplaceFee = allocateByShare(order.marketplaceFee, share);
      const shippingPaid = allocateByShare(order.shippingFee, share);
      const discountAmount = allocateByShare(order.discountAmount, share);
      const taxAmount = allocateByShare(order.taxAmount, share);
      const grossRevenue = round2(itemGross - discountAmount);
      const quantity = Number(item.quantity || 0);
      const unitCost = Number(item.unitCost || 0);
      const extraCost = Number(item.extraCost || 0);
      const productCost = round2(unitCost * quantity + extraCost);
      const calculatedProfit = round2(
        grossRevenue - marketplaceFee - shippingPaid - productCost - taxAmount
      );
      const netProfit =
        Number.isFinite(item.profit) && Number(item.profit) !== 0
          ? round2(item.profit)
          : calculatedProfit;
      const profitMargin = grossRevenue ? round2((netProfit / grossRevenue) * 100) : 0;
      const roi = productCost ? round2((netProfit / productCost) * 100) : 0;
      const productTitle = item.product?.title || item.title || "Produto sem titulo";
      const accountName = order.marketplaceAccount?.accountName || "Conta";
      const marketplace = order.marketplaceAccount?.marketplace || "Marketplace";
      const taxPercent =
        Number.isFinite(item.taxPercent) && Number(item.taxPercent) > 0
          ? Number(item.taxPercent)
          : grossRevenue
            ? round2((taxAmount / grossRevenue) * 100)
            : 0;
      const [startColor, endColor] = photoColorsForId(item.id || productTitle);
      const label = productTitle
        .split(" ")
        .slice(0, 2)
        .map((word) => word[0] || "")
        .join("");

      rows.push({
        id: item.id,
        orderId: order.id,
        marketplaceOrderId: order.marketplaceOrderId,
        dateValue: order.saleDate,
        date: reportDateFormatter.format(new Date(order.saleDate)),
        dateShort: tableDateFormatter.format(new Date(order.saleDate)),
        marketplace,
        account: accountName,
        product: productTitle,
        title: productTitle,
        supplier: item.product?.category || "Nao informado",
        sku: item.sku || item.product?.sku || "N/A",
        quantity,
        salePrice: Number(item.unitPrice || 0),
        value: grossRevenue,
        fee: marketplaceFee,
        sellerShipping: shippingPaid,
        productCost,
        taxPercent,
        taxAmount,
        grossRevenue,
        netProfit,
        profit: netProfit,
        profitMargin,
        roi,
        status: normalizeStatus(order.status),
        photo: createProductPhoto(label, startColor, endColor),
      });
    }
  }

  return rows.sort((left, right) => {
    return new Date(right.dateValue).getTime() - new Date(left.dateValue).getTime();
  });
}

function groupRowsByPeriod(rows = [], period = "30d") {
  const resolvedPeriod = resolvePeriod(period);
  const bucketMap = new Map();

  rows.forEach((row) => {
    const rowDate = new Date(row.dateValue);
    const isQuarter = resolvedPeriod === "90d";
    const key = isQuarter
      ? `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}`
      : shortDateFormatter.format(rowDate);
    const label = isQuarter
      ? `${MONTH_LABELS[rowDate.getMonth()]}/${rowDate.getFullYear()}`
      : shortDateFormatter.format(rowDate);
    const current = bucketMap.get(key) || {
      id: key,
      period: label,
      revenueValue: 0,
      profitValue: 0,
      ordersValue: 0,
      timestamp: rowDate.getTime(),
    };

    current.revenueValue += row.grossRevenue;
    current.profitValue += row.netProfit;
    current.ordersValue += row.quantity;
    bucketMap.set(key, current);
  });

  return Array.from(bucketMap.values()).sort((left, right) => left.timestamp - right.timestamp);
}

async function fetchOrderDomainRows(userId, period = "30d") {
  const periodStart = startDateForPeriod(period);
  const orders = await prisma.order.findMany({
    where: {
      userId,
      saleDate: {
        gte: periodStart,
      },
    },
    include: {
      marketplaceAccount: true,
      items: {
        include: {
          product: {
            include: {
              cost: true,
            },
          },
        },
      },
    },
    orderBy: {
      saleDate: "desc",
    },
  });

  return buildProfitRowsFromOrders(orders);
}

async function getDashboard(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const rows = await fetchOrderDomainRows(user.id, period);
  const revenue = rows.reduce((sum, row) => sum + row.grossRevenue, 0);
  const profitBeforeAdjustments = rows.reduce((sum, row) => sum + row.netProfit, 0);
  const sales = rows.reduce((sum, row) => sum + row.quantity, 0);
  const adjustments = await getFinancialAdjustmentsForUser(user.id, period);
  const adjustedProfit = round2(profitBeforeAdjustments - adjustments.totalAdjustments);
  const productsByRevenue = rows.reduce((map, row) => {
    const current = map.get(row.product) || {
      id: row.id,
      name: row.product,
      revenueValue: 0,
    };

    current.revenueValue += row.grossRevenue;
    map.set(row.product, current);
    return map;
  }, new Map());
  const topProducts = Array.from(productsByRevenue.values())
    .sort((left, right) => right.revenueValue - left.revenueValue)
    .slice(0, 3)
    .map((product, index) => ({
      id: `${index + 1}`,
      name: product.name,
      revenue: formatCurrency(product.revenueValue),
    }));
  const recentOrders = rows.slice(0, 3).map((row, index) => ({
    id: `${index + 1}`,
    product: row.product,
    marketplace: row.marketplace,
    value: formatCurrency(row.grossRevenue),
  }));

  return {
    summary: {
      revenue: round2(revenue),
      profit: adjustedProfit,
      profitBeforeAdjustments: round2(profitBeforeAdjustments),
      recurringExpenses: adjustments.recurringTotal,
      additionalCosts: adjustments.additionalTotal,
      adjustmentsTotal: adjustments.totalAdjustments,
      sales,
      averageTicket: sales ? round2(revenue / sales) : 0,
    },
    topProducts,
    recentOrders,
  };
}

async function getProfitTable(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const rows = await fetchOrderDomainRows(user.id, period);

  return rows.map((row) => ({
    id: row.id,
    photo: row.photo,
    title: row.title,
    account: row.account,
    sku: row.sku,
    date: row.dateShort,
    quantity: row.quantity,
    value: round2(row.value),
    fee: round2(row.fee),
    sellerShipping: round2(row.sellerShipping),
    productCost: round2(row.productCost),
    taxPercent: round2(row.taxPercent),
    profit: round2(
      row.value -
        row.fee -
        row.sellerShipping -
        row.productCost -
        row.value * (row.taxPercent / 100)
    ),
  }));
}

async function getProfitReport(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const rows = await fetchOrderDomainRows(user.id, period);

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    marketplace: row.marketplace,
    product: row.product,
    supplier: row.supplier,
    quantity: row.quantity,
    salePrice: round2(row.salePrice),
    productCost: round2(row.productCost),
    marketplaceFee: round2(row.fee),
    shippingPaid: round2(row.sellerShipping),
    grossRevenue: round2(row.grossRevenue),
    netProfit: round2(row.netProfit),
    profitMargin: round2(row.profitMargin),
    roi: round2(row.roi),
  }));
}

async function getOrders(request = {}) {
  const user = await resolveViewerUser(request);

  const orders = await prisma.order.findMany({
    where: {
      userId: user.id,
    },
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

  return orders.map((order) => ({
    id: order.marketplaceOrderId || order.id,
    product: order.items[0]?.title || "Pedido sem item",
    marketplace: order.marketplaceAccount?.marketplace || "Marketplace",
    value: formatCurrency(Number(order.totalAmount || 0)),
    status: normalizeStatus(order.status),
  }));
}

async function getProducts(request = {}) {
  const user = await resolveViewerUser(request);

  const products = await prisma.product.findMany({
    where: {
      userId: user.id,
    },
    include: {
      cost: true,
      marketplaceAccount: true,
      orderItems: {
        include: {
          order: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 60,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const activeCutoff = new Date();
  activeCutoff.setDate(activeCutoff.getDate() - 90);

  return products.map((product) => {
    const orderItems = Array.isArray(product.orderItems) ? product.orderItems : [];
    const avgPrice = orderItems.length
      ? orderItems.reduce((sum, item) => sum + Number(item.unitPrice || 0), 0) / orderItems.length
      : 0;
    const baseCost = Number(product.cost?.costPrice || 0) + Number(product.cost?.extraCost || 0);
    const avgCost = baseCost || (orderItems.length
      ? orderItems.reduce((sum, item) => sum + Number(item.unitCost || 0), 0) / orderItems.length
      : 0);
    const marginFromItems = orderItems.length
      ? orderItems.reduce((sum, item) => sum + Number(item.marginPercent || 0), 0) / orderItems.length
      : 0;
    const taxPercent = Number(product.cost?.taxPercent || 0);
    const computedMargin = avgPrice
      ? ((avgPrice - avgCost - avgPrice * (taxPercent / 100)) / avgPrice) * 100
      : 0;
    const margin = Number.isFinite(marginFromItems) && marginFromItems > 0
      ? marginFromItems
      : computedMargin;
    const hasRecentOrders = orderItems.some((item) => {
      const saleDate = item.order?.saleDate ? new Date(item.order.saleDate) : null;
      return saleDate && saleDate.getTime() >= activeCutoff.getTime();
    });
    const isActive = Boolean(product.marketplaceAccount?.isActive) && hasRecentOrders;

    return {
      id: product.id,
      name: product.title,
      sku: product.sku || "N/A",
      price: formatCurrency(avgPrice),
      cost: formatCurrency(avgCost),
      margin: formatPercent(margin),
      status: isActive ? "Ativo" : "Pausado",
    };
  });
}

async function getAccounts(request = {}) {
  const user = await resolveViewerUser(request);

  const accounts = await prisma.marketplaceAccount.findMany({
    where: {
      userId: user.id,
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
    const syncReference = latestOrderUpdate
      ? new Date(latestOrderUpdate)
      : new Date(account.updatedAt);

    return {
      id: account.id,
      name: account.accountName,
      marketplace: account.marketplace,
      status: account.isActive ? "Conectada" : "Pendente",
      lastSync: dateTimeFormatter.format(syncReference),
      orders: account.orders.length,
    };
  });
}

async function getReports(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const rows = await fetchOrderDomainRows(user.id, period);
  const totalRevenue = rows.reduce((sum, row) => sum + row.grossRevenue, 0);
  const totalProfitBeforeAdjustments = rows.reduce((sum, row) => sum + row.netProfit, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.quantity, 0);
  const adjustments = await getFinancialAdjustmentsForUser(user.id, period);
  const totalProfit = round2(totalProfitBeforeAdjustments - adjustments.totalAdjustments);
  const averageMargin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

  const channelsMap = rows.reduce((map, row) => {
    const current = map.get(row.marketplace) || {
      id: String(map.size + 1),
      name: row.marketplace,
      revenueValue: 0,
      profitValue: 0,
    };

    current.revenueValue += row.grossRevenue;
    current.profitValue += row.netProfit;
    map.set(row.marketplace, current);
    return map;
  }, new Map());

  const channels = Array.from(channelsMap.values())
    .sort((left, right) => right.revenueValue - left.revenueValue)
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      revenue: formatCurrency(channel.revenueValue),
      profit: formatCurrency(channel.profitValue),
    }));

  const productProfitMap = rows.reduce((map, row) => {
    const current = map.get(row.product) || {
      id: String(map.size + 1),
      name: row.product,
      profitValue: 0,
    };

    current.profitValue += row.netProfit;
    map.set(row.product, current);
    return map;
  }, new Map());

  const topProfitableProducts = Array.from(productProfitMap.values())
    .sort((left, right) => right.profitValue - left.profitValue)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      name: item.name,
      profit: formatCurrency(item.profitValue),
    }));

  const groupedRows = groupRowsByPeriod(rows, period).map((group, index) => ({
    id: `${index + 1}`,
    period: group.period,
    revenue: formatCurrency(group.revenueValue),
    profit: formatCurrency(group.profitValue),
    orders: group.ordersValue,
  }));

  return {
    summary: {
      totalRevenue: formatCurrency(totalRevenue),
      totalProfit: formatCurrency(totalProfit),
      totalProfitBeforeAdjustments: formatCurrency(totalProfitBeforeAdjustments),
      totalOrders,
      averageMargin: formatPercent(averageMargin),
      adjustments: {
        recurringExpenses: formatCurrency(adjustments.recurringTotal),
        additionalCosts: formatCurrency(adjustments.additionalTotal),
        total: formatCurrency(adjustments.totalAdjustments),
      },
    },
    channels,
    topProfitableProducts,
    rows: groupedRows,
  };
}

async function getSettings(request = {}) {
  const user = await resolveViewerUser(request);

  const company = user.memberships?.[0]?.organization?.name || "ViiSync Seller";

  return {
    profile: {
      name: user.name,
      email: user.email,
      company,
    },
    preferences: {
      theme: "Claro",
      periodDefault: "30 dias",
      notifications: "Ativadas",
    },
    security: {
      lastPasswordChange: user.updatedAt
        ? reportDateFormatter.format(new Date(user.updatedAt))
        : "",
      twoFactor: "Desativado",
    },
  };
}

async function getChartData(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const rows = await fetchOrderDomainRows(user.id, period);
  const groupedRows = groupRowsByPeriod(rows, period);

  return groupedRows.map((group) => ({
    label: group.period,
    revenue: round2(group.revenueValue),
  }));
}

async function listAdditionalCosts(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);
  const resolvedPeriod = resolvePeriod(period);
  const adjustments = await getFinancialAdjustmentsForUser(user.id, resolvedPeriod);

  return {
    period: resolvedPeriod,
    summary: {
      count: adjustments.additionalCosts.length,
      total: round2(adjustments.additionalTotal),
    },
    items: adjustments.additionalCosts,
  };
}

async function createAdditionalCost(payload = {}, period = "30d", request = {}) {
  const user = await resolveViewerUser(request);
  const normalized = normalizeAdditionalCostInput(payload, { partial: false });

  await prisma.additionalCost.create({
    data: {
      userId: user.id,
      description: normalized.description,
      amount: normalized.amount,
      referenceMonth: normalized.referenceMonth,
    },
  });

  return {
    ...(await listAdditionalCosts(period, request)),
    message: "Gasto adicional cadastrado com sucesso.",
  };
}

async function updateAdditionalCost(costId, payload = {}, period = "30d", request = {}) {
  const user = await resolveViewerUser(request);
  const id = normalizeText(costId);

  if (!id) {
    throw createHttpError(400, "Gasto adicional invalido.");
  }

  const existing = await prisma.additionalCost.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!existing) {
    throw createHttpError(404, "Gasto adicional nao encontrado.");
  }

  const normalized = normalizeAdditionalCostInput(payload, { partial: true });

  if (!Object.keys(normalized).length) {
    throw createHttpError(400, "Nenhuma alteracao valida foi informada.");
  }

  await prisma.additionalCost.update({
    where: {
      id: existing.id,
    },
    data: normalized,
  });

  return {
    ...(await listAdditionalCosts(period, request)),
    message: "Gasto adicional atualizado com sucesso.",
  };
}

async function removeAdditionalCost(costId, period = "30d", request = {}) {
  const user = await resolveViewerUser(request);
  const id = normalizeText(costId);

  if (!id) {
    throw createHttpError(400, "Gasto adicional invalido.");
  }

  const existing = await prisma.additionalCost.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw createHttpError(404, "Gasto adicional nao encontrado.");
  }

  await prisma.additionalCost.delete({
    where: {
      id: existing.id,
    },
  });

  return {
    ...(await listAdditionalCosts(period, request)),
    message: "Gasto adicional removido com sucesso.",
  };
}

async function getAnalyticsSnapshot(period = "30d", request = {}) {
  const resolvedPeriod = resolvePeriod(period);

  return {
    period: resolvedPeriod,
    dashboard: await getDashboard(resolvedPeriod, request),
    chartData: await getChartData(resolvedPeriod, request),
    profitTable: await getProfitTable(resolvedPeriod, request),
    profitReport: await getProfitReport(resolvedPeriod, request),
    orders: await getOrders(request),
    products: await getProducts(request),
    accounts: await getAccounts(request),
    reports: await getReports(resolvedPeriod, request),
    settings: await getSettings(request),
  };
}

module.exports = {
  createAdditionalCost,
  getAccounts,
  getFinancialAdjustmentsForUser,
  getAnalyticsSnapshot,
  getChartData,
  getDashboard,
  listAdditionalCosts,
  getOrders,
  getProducts,
  getProfitReport,
  getProfitTable,
  getReports,
  getSettings,
  removeAdditionalCost,
  resolvePeriod,
  updateAdditionalCost,
};
