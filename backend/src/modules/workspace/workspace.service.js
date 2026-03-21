const {
  getFinancialAdjustmentsForUser,
  getProfitReport,
  resolvePeriod,
} = require("../../services/analyticsDb.service");
const prisma = require("../../lib/prisma");
const { resolveSessionContextFromRequest } = require("../auth/auth.service");
const {
  automationExecutions,
  automationRulesSeed,
  calendarEvents,
  productDetails,
} = require("../../data/mockSellerWorkspaceData");

let automationStore = cloneData(automationRulesSeed);
const ENABLE_WORKSPACE_DEMO_DATA =
  String(process.env.ENABLE_WORKSPACE_DEMO_DATA || "")
    .trim()
    .toLowerCase() === "true";

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

const RECEIVABLE_RATIOS = {
  "7d": { marketplace: 0.34, secondary: 0.08 },
  "30d": { marketplace: 0.32, secondary: 0.1 },
  "90d": { marketplace: 0.3, secondary: 0.12 },
};

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function roundAmount(value) {
  return Number(value.toFixed(2));
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeRecurringExpenseCategory(value) {
  const category = normalizeText(value);

  if (!category) {
    return "Operacao";
  }

  return category.slice(0, 40);
}

function normalizeRecurringExpenseInput(payload = {}) {
  const description = normalizeText(payload.description);
  const amount = Number(payload.amount);
  const dueDay = Number(payload.dueDay);
  const category = normalizeRecurringExpenseCategory(payload.category);

  if (description.length < 2) {
    throw createHttpError(400, "Informe a descricao da despesa recorrente.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, "Informe um valor valido maior que zero.");
  }

  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw createHttpError(400, "Informe um dia de vencimento entre 1 e 31.");
  }

  return {
    description,
    amount: roundAmount(amount),
    dueDay,
    category,
  };
}

function clampDueDayToMonth(dueDay, year, monthIndex) {
  const safeDueDay = Math.max(1, Math.min(31, Number(dueDay) || 1));
  const monthLastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(safeDueDay, monthLastDay);
}

function resolveNextChargeDate(dueDay, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  let year = today.getFullYear();
  let monthIndex = today.getMonth();
  let day = clampDueDayToMonth(dueDay, year, monthIndex);
  let nextCharge = new Date(year, monthIndex, day);

  if (nextCharge.getTime() < today.getTime()) {
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }

    day = clampDueDayToMonth(dueDay, year, monthIndex);
    nextCharge = new Date(year, monthIndex, day);
  }

  nextCharge.setHours(0, 0, 0, 0);
  return nextCharge;
}

function mapRecurringExpenseRow(row) {
  return {
    id: row.id,
    description: row.description,
    amount: roundAmount(Number(row.amount || 0)),
    category: row.category || "Operacao",
    nextCharge: resolveNextChargeDate(row.dueDay).toISOString(),
    status: row.status || "Em uso",
    dueDay: row.dueDay,
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
    select: {
      id: true,
    },
  });

  if (!found) {
    throw createHttpError(401, "Sessao invalida ou expirada.");
  }

  return found;
}

async function listRecurringExpenseRowsByUser(userId) {
  if (!userId) {
    return [];
  }

  return prisma.recurringExpense.findMany({
    where: {
      userId,
    },
    orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }],
  });
}

function parseReportDate(dateText) {
  const [day, month, year] = String(dateText || "")
    .split("/")
    .map(Number);

  if (!day || !month || !year) {
    return new Date(0);
  }

  return new Date(year, month - 1, day);
}

function formatPeriodLabel(date, period) {
  if (period === "90d") {
    return `${MONTH_LABELS[date.getMonth()]}/${date.getFullYear()}`;
  }

  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildFinanceBase(rows) {
  return rows.reduce(
    (accumulator, row) => ({
      inflow: accumulator.inflow + row.grossRevenue,
      netProfit: accumulator.netProfit + row.netProfit,
      productCost: accumulator.productCost + row.productCost,
      marketplaceFee: accumulator.marketplaceFee + row.marketplaceFee,
      shippingPaid: accumulator.shippingPaid + row.shippingPaid,
    }),
    {
      inflow: 0,
      netProfit: 0,
      productCost: 0,
      marketplaceFee: 0,
      shippingPaid: 0,
    }
  );
}

function buildFinanceGroups(rows, period) {
  const resolvedPeriod = resolvePeriod(period);

  const groups = rows.reduce((accumulator, row) => {
    const date = parseReportDate(row.date);
    const key =
      resolvedPeriod === "90d"
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : row.date;
    const currentGroup = accumulator.get(key) || {
      id: key,
      label: formatPeriodLabel(date, resolvedPeriod),
      inflow: 0,
      net: 0,
      timestamp: date.getTime(),
    };

    currentGroup.inflow += row.grossRevenue;
    currentGroup.net += row.netProfit;
    accumulator.set(key, currentGroup);

    return accumulator;
  }, new Map());

  return Array.from(groups.values())
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((group, index) => ({
      id: `cash-${resolvedPeriod}-${index + 1}`,
      label: group.label,
      inflow: roundAmount(group.inflow),
      outflow: roundAmount(group.inflow - group.net),
      net: roundAmount(group.net),
    }));
}

function buildReceivables(rows, period) {
  const resolvedPeriod = resolvePeriod(period);
  const ratios = RECEIVABLE_RATIOS[resolvedPeriod] || RECEIVABLE_RATIOS["30d"];
  const now = new Date();

  const channels = rows.reduce((accumulator, row) => {
    const current = accumulator.get(row.marketplace) || {
      marketplace: row.marketplace,
      revenue: 0,
    };

    current.revenue += row.grossRevenue;
    accumulator.set(row.marketplace, current);

    return accumulator;
  }, new Map());

  const receivables = Array.from(channels.values())
    .sort((left, right) => right.revenue - left.revenue)
    .map((channel, index) => ({
      id: `recv-${resolvedPeriod}-${index + 1}`,
      marketplace: channel.marketplace,
      amount: roundAmount(channel.revenue * ratios.marketplace),
      expectedAt: toIsoDate(addDays(now, index + 1)),
      status: "Previsto",
    }));

  if (resolvedPeriod !== "7d") {
    receivables.push({
      id: `recv-${resolvedPeriod}-extra`,
      marketplace: resolvedPeriod === "90d" ? "Gateway bancario" : "Cartao corporativo",
      amount: roundAmount(
        rows.reduce((sum, row) => sum + row.grossRevenue, 0) * ratios.secondary
      ),
      expectedAt: toIsoDate(addDays(now, 4)),
      status: "Conciliacao",
    });
  }

  return receivables;
}

function buildFeesByChannel(rows) {
  const channels = rows.reduce((accumulator, row) => {
    const current = accumulator.get(row.marketplace) || {
      id: `fee-${accumulator.size + 1}`,
      channel: row.marketplace,
      revenue: 0,
      feeAmount: 0,
      profit: 0,
    };

    current.revenue += row.grossRevenue;
    current.feeAmount += row.marketplaceFee;
    current.profit += row.netProfit;
    accumulator.set(row.marketplace, current);

    return accumulator;
  }, new Map());

  return Array.from(channels.values())
    .sort((left, right) => right.revenue - left.revenue)
    .map((channel) => ({
      id: channel.id,
      channel: channel.channel,
      feeAmount: roundAmount(channel.feeAmount),
      feePercent: channel.revenue ? roundAmount((channel.feeAmount / channel.revenue) * 100) : 0,
      netMarginPercent: channel.revenue
        ? roundAmount((channel.profit / channel.revenue) * 100)
        : 0,
    }));
}

function buildNetProfitBridge(base, adjustments) {
  const recurringAmount = roundAmount(-(adjustments?.recurringTotal || 0));
  const additionalAmount = roundAmount(-(adjustments?.additionalTotal || 0));
  const adjustedNetProfit = roundAmount(base.netProfit + recurringAmount + additionalAmount);

  return [
    {
      id: "bridge-1",
      label: "Receita bruta",
      amount: roundAmount(base.inflow),
      tone: "positive",
    },
    {
      id: "bridge-2",
      label: "Custos de produto",
      amount: roundAmount(-base.productCost),
      tone: "negative",
    },
    {
      id: "bridge-3",
      label: "Taxas marketplace",
      amount: roundAmount(-base.marketplaceFee),
      tone: "negative",
    },
    {
      id: "bridge-4",
      label: "Frete subsidiado",
      amount: roundAmount(-base.shippingPaid),
      tone: "negative",
    },
    {
      id: "bridge-5",
      label: "Despesas recorrentes",
      amount: recurringAmount,
      tone: recurringAmount < 0 ? "negative" : "neutral",
    },
    {
      id: "bridge-6",
      label: "Gastos adicionais",
      amount: additionalAmount,
      tone: additionalAmount < 0 ? "negative" : "neutral",
    },
    {
      id: "bridge-7",
      label: "Lucro liquido",
      amount: adjustedNetProfit,
      tone: adjustedNetProfit >= 0 ? "positive" : "negative",
    },
  ];
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

function formatEvolutionLabel(date, period) {
  const resolvedPeriod = resolvePeriod(period);
  const currentDate = date instanceof Date ? date : new Date(date);

  if (resolvedPeriod === "90d") {
    return `${MONTH_LABELS[currentDate.getMonth()]}/${currentDate.getFullYear()}`;
  }

  return `${String(currentDate.getDate()).padStart(2, "0")}/${String(
    currentDate.getMonth() + 1
  ).padStart(2, "0")}`;
}

function classifyProductHealth(marginPercent) {
  if (marginPercent >= 18) {
    return "Saude forte";
  }

  if (marginPercent >= 8) {
    return "Saude em atencao";
  }

  return "Margem critica";
}

function buildFinanceInsights({
  base,
  recurringTotal,
  additionalTotal,
  receivables,
  feesByChannel,
}) {
  const receivablesTotal = receivables.reduce((sum, item) => sum + item.amount, 0);
  const strongestChannel = feesByChannel[0];
  const weakestChannel = feesByChannel[feesByChannel.length - 1];
  const consolidatedAdjustments = recurringTotal + additionalTotal;
  const recurringShare = base.netProfit ? (consolidatedAdjustments / base.netProfit) * 100 : 0;

  return [
    strongestChannel
      ? `${strongestChannel.channel} concentra o maior volume financeiro e fecha com margem liquida de ${strongestChannel.netMarginPercent.toFixed(1)}% no recorte.`
      : "Ainda nao ha canal dominante o suficiente para leitura financeira.",
    `Os repasses previstos somam R$ ${receivablesTotal.toFixed(2).replace(".", ",")} e ajudam a sustentar o caixa de curto prazo.`,
    `Despesas recorrentes e gastos adicionais representam ${recurringShare.toFixed(1).replace(".", ",")}% do lucro liquido transacional no mesmo periodo.`,
    weakestChannel && weakestChannel.channel !== strongestChannel?.channel
      ? `${weakestChannel.channel} pede revisao de taxa e mix porque entrega o menor retorno relativo entre os canais ativos.`
      : "O mix de canais ainda esta concentrado, entao vale monitorar dependencia operacional.",
  ];
}

async function getProductDetail(productId, period = "30d", request = {}) {
  const resolvedPeriod = resolvePeriod(period);
  const user = await resolveViewerUser(request);

  const product = await prisma.product.findFirst({
    where: {
      id: String(productId || "").trim(),
      userId: user.id,
    },
    include: {
      cost: true,
      marketplaceAccount: true,
      orderItems: {
        include: {
          order: {
            include: {
              marketplaceAccount: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 400,
      },
    },
  });

  if (!product) {
    if (ENABLE_WORKSPACE_DEMO_DATA) {
      const demoProduct = productDetails.find((item) => item.id === productId);
      if (demoProduct) {
        return {
          period: resolvedPeriod,
          item: {
            ...cloneData(demoProduct),
            summary: cloneData(demoProduct.summaryByPeriod[resolvedPeriod]),
            evolution: cloneData(demoProduct.evolutionByPeriod[resolvedPeriod]),
          },
        };
      }
    }

    throw createHttpError(404, "Produto nao encontrado.");
  }

  const periodStart = startDateForPeriod(resolvedPeriod);
  const rows = (product.orderItems || []).filter((orderItem) => {
    const saleDate = orderItem.order?.saleDate ? new Date(orderItem.order.saleDate) : null;
    return saleDate && saleDate.getTime() >= periodStart.getTime();
  });

  const summary = rows.reduce(
    (accumulator, row) => {
      const revenue = Number(row.totalPrice || row.unitPrice * row.quantity || 0);
      const profit = Number(row.profit || 0);
      const extraCost = Number(row.extraCost || 0);

      return {
        revenue: accumulator.revenue + revenue,
        profit: accumulator.profit + profit,
        feeAmount: accumulator.feeAmount + extraCost,
        sales: accumulator.sales + Number(row.quantity || 0),
      };
    },
    {
      revenue: 0,
      profit: 0,
      feeAmount: 0,
      sales: 0,
    }
  );

  summary.marginPercent = summary.revenue
    ? roundAmount((summary.profit / summary.revenue) * 100)
    : 0;

  const groupedEvolution = rows.reduce((accumulator, row) => {
    const saleDate = row.order?.saleDate ? new Date(row.order.saleDate) : new Date();
    const key =
      resolvedPeriod === "90d"
        ? `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, "0")}`
        : formatEvolutionLabel(saleDate, resolvedPeriod);
    const current = accumulator.get(key) || {
      id: key,
      label: formatEvolutionLabel(saleDate, resolvedPeriod),
      revenue: 0,
      profit: 0,
      orders: 0,
      timestamp: saleDate.getTime(),
    };

    current.revenue += Number(row.totalPrice || row.unitPrice * row.quantity || 0);
    current.profit += Number(row.profit || 0);
    current.orders += Number(row.quantity || 0);
    accumulator.set(key, current);
    return accumulator;
  }, new Map());

  const evolution = Array.from(groupedEvolution.values())
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((item) => ({
      label: item.label,
      revenue: roundAmount(item.revenue),
      profit: roundAmount(item.profit),
      orders: item.orders,
    }));

  const channelMixMap = rows.reduce((accumulator, row) => {
    const marketplace = row.order?.marketplaceAccount?.marketplace || "Marketplace";
    const current = accumulator.get(marketplace) || {
      id: `channel-${accumulator.size + 1}`,
      marketplace,
      revenue: 0,
      profit: 0,
    };

    current.revenue += Number(row.totalPrice || row.unitPrice * row.quantity || 0);
    current.profit += Number(row.profit || 0);
    accumulator.set(marketplace, current);
    return accumulator;
  }, new Map());

  const channelMix = Array.from(channelMixMap.values()).map((channel) => ({
    ...channel,
    revenue: roundAmount(channel.revenue),
    profit: roundAmount(channel.profit),
    marginPercent: channel.revenue
      ? roundAmount((channel.profit / channel.revenue) * 100)
      : 0,
  }));

  const productCostTotal = rows.reduce(
    (sum, row) => sum + Number(row.unitCost || 0) * Number(row.quantity || 0),
    0
  );
  const extraCostTotal = rows.reduce((sum, row) => sum + Number(row.extraCost || 0), 0);
  const estimatedTaxTotal = rows.reduce((sum, row) => {
    const revenue = Number(row.totalPrice || row.unitPrice * row.quantity || 0);
    return sum + revenue * (Number(row.taxPercent || 0) / 100);
  }, 0);

  const feeBreakdown = [
    {
      id: "fee-product-cost",
      label: "Custo dos itens",
      amount: roundAmount(productCostTotal),
    },
    {
      id: "fee-extra-cost",
      label: "Custos extras",
      amount: roundAmount(extraCostTotal),
    },
    {
      id: "fee-tax",
      label: "Tributos estimados",
      amount: roundAmount(estimatedTaxTotal),
    },
  ];

  const recentSales = rows
    .slice()
    .sort((left, right) => {
      const leftTime = left.order?.saleDate ? new Date(left.order.saleDate).getTime() : 0;
      const rightTime = right.order?.saleDate ? new Date(right.order.saleDate).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      orderId: row.order?.marketplaceOrderId || row.order?.id || "Pedido",
      marketplace: row.order?.marketplaceAccount?.marketplace || "Marketplace",
      soldAt: row.order?.saleDate || row.createdAt,
      revenue: roundAmount(Number(row.totalPrice || row.unitPrice * row.quantity || 0)),
      profit: roundAmount(Number(row.profit || 0)),
    }));

  const recommendations = [];

  if (summary.marginPercent < 8) {
    recommendations.push(
      "Revise preco, taxa e custo unitario para recuperar margem minima do SKU."
    );
  }

  if (rows.length < 3) {
    recommendations.push("Volume baixo no recorte atual. Vale revisar distribuicao por canal.");
  }

  if (!recommendations.length) {
    recommendations.push(
      "SKU com desempenho estavel no periodo. Mantenha monitoramento de taxa e conversao."
    );
  }

  const status = rows.length ? "Ativo" : "Pausado";

  return {
    period: resolvedPeriod,
    item: {
      id: product.id,
      name: product.title,
      category: product.category || "Sem categoria",
      sku: product.sku || "N/A",
      status,
      healthLabel: classifyProductHealth(summary.marginPercent),
      summary: {
        revenue: roundAmount(summary.revenue),
        profit: roundAmount(summary.profit),
        marginPercent: roundAmount(summary.marginPercent),
        feeAmount: roundAmount(summary.feeAmount),
        sales: summary.sales,
      },
      evolution,
      channelMix,
      feeBreakdown,
      recentSales,
      recommendations,
    },
  };
}

async function getFinanceCenter(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);
  const resolvedPeriod = resolvePeriod(period);
  const rows = await getProfitReport(resolvedPeriod, request);
  const base = buildFinanceBase(rows);
  const recurringExpenses = (await listRecurringExpenseRowsByUser(user.id)).map(
    mapRecurringExpenseRow
  );
  const receivables = buildReceivables(rows, resolvedPeriod);
  const feesByChannel = buildFeesByChannel(rows);
  const adjustments = await getFinancialAdjustmentsForUser(user.id, resolvedPeriod);
  const adjustedNetProfit = roundAmount(base.netProfit - adjustments.totalAdjustments);
  const netProfitBridge = buildNetProfitBridge(base, adjustments);
  const insights = buildFinanceInsights({
    base,
    recurringTotal: adjustments.recurringTotal,
    additionalTotal: adjustments.additionalTotal,
    receivables,
    feesByChannel,
  });

  return {
    period: resolvedPeriod,
    summary: {
      inflow: roundAmount(base.inflow),
      outflow: roundAmount(base.inflow - adjustedNetProfit),
      netProfit: adjustedNetProfit,
      netProfitBeforeAdjustments: roundAmount(base.netProfit),
      receivables: roundAmount(
        receivables.reduce((sum, item) => sum + item.amount, 0)
      ),
      recurringExpenses: roundAmount(adjustments.recurringTotal),
      additionalCosts: roundAmount(adjustments.additionalTotal),
    },
    cashFlow: buildFinanceGroups(rows, resolvedPeriod),
    recurringExpenses,
    receivables,
    feesByChannel,
    netProfitBridge,
    insights,
  };
}

async function createRecurringExpense(payload = {}, period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const normalized = normalizeRecurringExpenseInput(payload);

  await prisma.recurringExpense.create({
    data: {
      userId: user.id,
      description: normalized.description,
      amount: normalized.amount,
      category: normalized.category,
      dueDay: normalized.dueDay,
      status: "Em uso",
    },
  });

  return {
    ...(await getFinanceCenter(period, request)),
    message: "Despesa recorrente cadastrada com sucesso.",
  };
}

async function removeRecurringExpense(expenseId, period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const id = normalizeText(expenseId);

  if (!id) {
    throw createHttpError(400, "Despesa recorrente invalida.");
  }

  const found = await prisma.recurringExpense.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!found) {
    throw createHttpError(404, "Despesa recorrente nao encontrada.");
  }

  await prisma.recurringExpense.delete({
    where: {
      id: found.id,
    },
  });

  return {
    ...(await getFinanceCenter(period, request)),
    message: "Despesa recorrente removida com sucesso.",
  };
}

function getOperationalCalendar(filters = {}) {
  if (!ENABLE_WORKSPACE_DEMO_DATA) {
    return {
      meta: {
        total: 0,
        filteredTotal: 0,
        upcomingCount: 0,
        attentionCount: 0,
      },
      items: [],
    };
  }

  const type = String(filters.type ?? "all");
  const status = String(filters.status ?? "all");

  const items = calendarEvents.filter((event) => {
    if (type !== "all" && event.type !== type) {
      return false;
    }

    if (status !== "all" && event.status !== status) {
      return false;
    }

    return true;
  });

  return {
    meta: {
      total: calendarEvents.length,
      filteredTotal: items.length,
      upcomingCount: calendarEvents.filter((event) => event.status === "upcoming").length,
      attentionCount: calendarEvents.filter((event) => event.status === "attention").length,
    },
    items: cloneData(items),
  };
}

function buildAutomationSummary(items) {
  return {
    total: items.length,
    enabledCount: items.filter((item) => item.isEnabled).length,
    attentionCount: items.filter((item) => item.status === "attention").length,
    successRateAverage:
      items.length > 0
        ? Math.round(
            items.reduce((accumulator, item) => accumulator + item.successRate, 0) /
              items.length
          )
        : 0,
  };
}

function getAutomations() {
  if (!ENABLE_WORKSPACE_DEMO_DATA) {
    return {
      summary: {
        total: 0,
        enabledCount: 0,
        attentionCount: 0,
        successRateAverage: 0,
      },
      rules: [],
      executions: [],
    };
  }

  return {
    summary: buildAutomationSummary(automationStore),
    rules: cloneData(automationStore),
    executions: cloneData(automationExecutions),
  };
}

function toggleAutomationRule(ruleId, enabled) {
  if (!ENABLE_WORKSPACE_DEMO_DATA) {
    throw createHttpError(
      503,
      "As automacoes avancadas nao estao habilitadas neste ambiente."
    );
  }

  const index = automationStore.findIndex((item) => item.id === ruleId);

  if (index === -1) {
    throw createHttpError(404, "Regra de automacao nao encontrada.");
  }

  const currentRule = automationStore[index];
  const nextEnabled = typeof enabled === "boolean" ? enabled : !currentRule.isEnabled;

  automationStore[index] = {
    ...currentRule,
    isEnabled: nextEnabled,
    status: nextEnabled ? currentRule.status : "healthy",
  };

  return {
    rule: cloneData(automationStore[index]),
    summary: buildAutomationSummary(automationStore),
  };
}

function isMercadoLivreMarketplace(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("mercado livre") || normalized.includes("mercadolivre");
}

async function getIntegrationHub(request = {}) {
  const user = await resolveViewerUser(request);
  const now = new Date();
  const nowMs = now.getTime();

  const accounts = await prisma.marketplaceAccount.findMany({
    where: {
      userId: user.id,
      OR: [
        {
          marketplace: {
            contains: "mercado livre",
            mode: "insensitive",
          },
        },
        {
          marketplace: {
            contains: "mercadolivre",
            mode: "insensitive",
          },
        },
      ],
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const accountIds = accounts.map((account) => account.id);
  const questionRows = accountIds.length
    ? await prisma.mercadoLivreQuestion.findMany({
        where: {
          userId: user.id,
          marketplaceAccountId: {
            in: accountIds,
          },
          dismissedAt: null,
        },
        select: {
          marketplaceAccountId: true,
          status: true,
          answeredAtMl: true,
        },
      })
    : [];

  const pendingByAccountId = questionRows.reduce((accumulator, question) => {
    const isAnswered =
      String(question.status || "").trim().toLowerCase() === "answered" ||
      Boolean(question.answeredAtMl);

    if (!isAnswered) {
      const current = accumulator.get(question.marketplaceAccountId) || 0;
      accumulator.set(question.marketplaceAccountId, current + 1);
    }

    return accumulator;
  }, new Map());

  const accountsPayload = accounts
    .filter((account) => isMercadoLivreMarketplace(account.marketplace))
    .map((account) => {
      const hasToken = Boolean(account.accessToken);
      const tokenExpiresAtMs = account.tokenExpiresAt
        ? new Date(account.tokenExpiresAt).getTime()
        : null;
      const tokenExpired = Boolean(hasToken && tokenExpiresAtMs && tokenExpiresAtMs <= nowMs);
      const tokenExpiringSoon = Boolean(
        hasToken &&
          tokenExpiresAtMs &&
          tokenExpiresAtMs > nowMs &&
          tokenExpiresAtMs - nowMs <= 1000 * 60 * 60 * 48
      );
      const reconnectRecommended = !hasToken || tokenExpired || tokenExpiringSoon;
      const queueBacklog = Number(pendingByAccountId.get(account.id) || 0);

      let tokenStatus = "Sem token";
      if (hasToken && tokenExpired) {
        tokenStatus = "Expirado";
      } else if (hasToken && tokenExpiringSoon) {
        tokenStatus = "Expira em breve";
      } else if (hasToken) {
        tokenStatus = "Ativo";
      }

      return {
        id: account.id,
        name: account.accountName || "Conta Mercado Livre",
        marketplace: account.marketplace || "Mercado Livre",
        status: reconnectRecommended ? "Reconectar" : "Conectada",
        reconnectRecommended,
        lastSyncAt: (account.lastSyncedAt || account.updatedAt).toISOString(),
        latency: "N/D",
        queueBacklog,
        tokenStatus,
        note: reconnectRecommended
          ? "Conecte via OAuth para sincronizar perguntas e manter o token valido."
          : "Conta pronta para sincronizacao operacional com o Mercado Livre.",
      };
    });

  const connectedCount = accountsPayload.filter(
    (account) => !account.reconnectRecommended
  ).length;
  const reconnectCount = accountsPayload.filter(
    (account) => account.reconnectRecommended
  ).length;
  const pendingQuestions = accountsPayload.reduce(
    (sum, account) => sum + Number(account.queueBacklog || 0),
    0
  );

  const summary = [
    {
      id: "integration-summary-accounts",
      label: "Contas Mercado Livre",
      value: String(accountsPayload.length),
      tone: "neutral",
    },
    {
      id: "integration-summary-connected",
      label: "Contas conectadas",
      value: String(connectedCount),
      tone: connectedCount > 0 ? "success" : "warning",
    },
    {
      id: "integration-summary-actions",
      label: "Acoes pendentes",
      value: String(reconnectCount + (pendingQuestions > 0 ? 1 : 0)),
      tone: reconnectCount > 0 ? "warning" : "success",
    },
    {
      id: "integration-summary-questions",
      label: "Perguntas pendentes",
      value: String(pendingQuestions),
      tone: pendingQuestions > 0 ? "warning" : "success",
    },
  ];

  const syncEvents = accountsPayload.map((account) => ({
    id: `event-${account.id}`,
    title: account.reconnectRecommended
      ? `${account.name} precisa de reconexao`
      : `${account.name} conectada com sucesso`,
    source: "Mercado Livre",
    createdAt: account.lastSyncAt,
  }));

  const actions = [];

  if (!accountsPayload.length) {
    actions.push({
      id: "action-connect-first-account",
      title: "Conectar primeira conta do Mercado Livre",
      description:
        "Conecte via OAuth para habilitar perguntas, dashboard e relatorios por canal.",
      cta: "Conectar conta",
    });
  }

  accountsPayload
    .filter((account) => account.reconnectRecommended)
    .forEach((account) => {
      actions.push({
        id: `action-reconnect-${account.id}`,
        title: `Reconectar ${account.name}`,
        description:
          "A conta esta sem token valido. Refaça a autorizacao para normalizar a sincronizacao.",
        cta: "Reconectar agora",
      });
    });

  if (pendingQuestions > 0) {
    actions.push({
      id: "action-review-questions",
      title: `${pendingQuestions} pergunta(s) aguardando resposta`,
      description:
        "Priorize a inbox de perguntas para manter SLA operacional no Mercado Livre.",
      cta: "Abrir perguntas ML",
    });
  }

  if (!actions.length) {
    actions.push({
      id: "action-all-good",
      title: "Integracao operacionalizada",
      description:
        "Sua conta Mercado Livre esta conectada e sem pendencias criticas no momento.",
      cta: "Tudo em dia",
    });
  }

  return {
    summary,
    accounts: accountsPayload,
    syncEvents,
    actions,
  };
}

module.exports = {
  createRecurringExpense,
  getAutomations,
  getFinanceCenter,
  getIntegrationHub,
  getOperationalCalendar,
  getProductDetail,
  removeRecurringExpense,
  toggleAutomationRule,
};
