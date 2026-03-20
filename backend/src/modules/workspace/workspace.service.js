const { getProfitReport, resolvePeriod } = require("../../services/analyticsDb.service");
const {
  automationExecutions,
  automationRulesSeed,
  calendarEvents,
  productDetails,
  sellerIntegrationHub,
} = require("../../data/mockSellerWorkspaceData");

let automationStore = cloneData(automationRulesSeed);

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

const RECURRING_EXPENSE_TEMPLATES = {
  "7d": [
    {
      id: "rec-1",
      description: "ERP fiscal",
      category: "Software",
      nextCharge: "2026-03-25",
      status: "Programado",
      weight: 0.22,
    },
    {
      id: "rec-2",
      description: "Time de atendimento",
      category: "Operacao",
      nextCharge: "2026-03-28",
      status: "Programado",
      weight: 0.48,
    },
    {
      id: "rec-3",
      description: "Ads always-on",
      category: "Marketing",
      nextCharge: "2026-03-29",
      status: "Em uso",
      weight: 0.3,
    },
  ],
  "30d": [
    {
      id: "rec-4",
      description: "ERP fiscal",
      category: "Software",
      nextCharge: "2026-03-25",
      status: "Programado",
      weight: 0.12,
    },
    {
      id: "rec-5",
      description: "Atendimento compartilhado",
      category: "Operacao",
      nextCharge: "2026-03-28",
      status: "Programado",
      weight: 0.41,
    },
    {
      id: "rec-6",
      description: "Performance media",
      category: "Marketing",
      nextCharge: "2026-03-26",
      status: "Em uso",
      weight: 0.26,
    },
    {
      id: "rec-7",
      description: "Ferramentas de BI",
      category: "Software",
      nextCharge: "2026-03-30",
      status: "Em uso",
      weight: 0.21,
    },
  ],
  "90d": [
    {
      id: "rec-8",
      description: "ERP fiscal",
      category: "Software",
      nextCharge: "2026-03-25",
      status: "Programado",
      weight: 0.08,
    },
    {
      id: "rec-9",
      description: "Time de operacao",
      category: "Operacao",
      nextCharge: "2026-03-28",
      status: "Em uso",
      weight: 0.41,
    },
    {
      id: "rec-10",
      description: "Midia de performance",
      category: "Marketing",
      nextCharge: "2026-03-26",
      status: "Em uso",
      weight: 0.27,
    },
    {
      id: "rec-11",
      description: "Ferramentas",
      category: "Software",
      nextCharge: "2026-03-30",
      status: "Em uso",
      weight: 0.24,
    },
  ],
};

const RECURRING_EXPENSE_RATIOS = {
  "7d": 0.18,
  "30d": 0.2,
  "90d": 0.22,
};

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

function buildRecurringExpenses(base, period) {
  const resolvedPeriod = resolvePeriod(period);
  const templates = RECURRING_EXPENSE_TEMPLATES[resolvedPeriod] || [];
  const totalBudget = base.inflow * (RECURRING_EXPENSE_RATIOS[resolvedPeriod] || 0.2);

  return templates.map((template, index) => {
    const isLastItem = index === templates.length - 1;
    const allocated = templates
      .slice(0, index)
      .reduce((sum, item) => sum + roundAmount(totalBudget * item.weight), 0);
    const amount = isLastItem
      ? roundAmount(totalBudget - allocated)
      : roundAmount(totalBudget * template.weight);

    return {
      id: template.id,
      description: template.description,
      amount,
      category: template.category,
      nextCharge: template.nextCharge,
      status: template.status,
    };
  });
}

function buildReceivables(rows, period) {
  const resolvedPeriod = resolvePeriod(period);
  const ratios = RECEIVABLE_RATIOS[resolvedPeriod] || RECEIVABLE_RATIOS["30d"];

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
      expectedAt: index === 0 ? "2026-03-21" : "2026-03-22",
      status: "Previsto",
    }));

  if (resolvedPeriod !== "7d") {
    receivables.push({
      id: `recv-${resolvedPeriod}-extra`,
      marketplace: resolvedPeriod === "90d" ? "Gateway bancario" : "Cartao corporativo",
      amount: roundAmount(
        rows.reduce((sum, row) => sum + row.grossRevenue, 0) * ratios.secondary
      ),
      expectedAt: "2026-03-24",
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

function buildNetProfitBridge(base) {
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
      label: "Lucro liquido",
      amount: roundAmount(base.netProfit),
      tone: "positive",
    },
  ];
}

function buildFinanceInsights({
  base,
  recurringExpenses,
  receivables,
  feesByChannel,
}) {
  const recurringTotal = recurringExpenses.reduce((sum, item) => sum + item.amount, 0);
  const receivablesTotal = receivables.reduce((sum, item) => sum + item.amount, 0);
  const strongestChannel = feesByChannel[0];
  const weakestChannel = feesByChannel[feesByChannel.length - 1];
  const recurringShare = base.netProfit ? (recurringTotal / base.netProfit) * 100 : 0;

  return [
    strongestChannel
      ? `${strongestChannel.channel} concentra o maior volume financeiro e fecha com margem liquida de ${strongestChannel.netMarginPercent.toFixed(1)}% no recorte.`
      : "Ainda nao ha canal dominante o suficiente para leitura financeira.",
    `Os repasses previstos somam R$ ${receivablesTotal.toFixed(2).replace(".", ",")} e ajudam a sustentar o caixa de curto prazo.`,
    `As despesas recorrentes monitoradas equivalem a ${recurringShare.toFixed(1).replace(".", ",")}% do lucro liquido do mesmo periodo.`,
    weakestChannel && weakestChannel.channel !== strongestChannel?.channel
      ? `${weakestChannel.channel} pede revisao de taxa e mix porque entrega o menor retorno relativo entre os canais ativos.`
      : "O mix de canais ainda esta concentrado, entao vale monitorar dependencia operacional.",
  ];
}

function getProductDetail(productId, period = "30d") {
  const resolvedPeriod = resolvePeriod(period);
  const product = productDetails.find((item) => item.id === productId);

  if (!product) {
    throw createHttpError(404, "Produto nao encontrado.");
  }

  return {
    period: resolvedPeriod,
    item: {
      ...cloneData(product),
      summary: cloneData(product.summaryByPeriod[resolvedPeriod]),
      evolution: cloneData(product.evolutionByPeriod[resolvedPeriod]),
    },
  };
}

async function getFinanceCenter(period = "30d", request = {}) {
  const resolvedPeriod = resolvePeriod(period);
  const rows = await getProfitReport(resolvedPeriod, request);
  const base = buildFinanceBase(rows);
  const recurringExpenses = buildRecurringExpenses(base, resolvedPeriod);
  const receivables = buildReceivables(rows, resolvedPeriod);
  const feesByChannel = buildFeesByChannel(rows);
  const netProfitBridge = buildNetProfitBridge(base);
  const insights = buildFinanceInsights({
    base,
    recurringExpenses,
    receivables,
    feesByChannel,
  });

  return {
    period: resolvedPeriod,
    summary: {
      inflow: roundAmount(base.inflow),
      outflow: roundAmount(base.inflow - base.netProfit),
      netProfit: roundAmount(base.netProfit),
      receivables: roundAmount(
        receivables.reduce((sum, item) => sum + item.amount, 0)
      ),
      recurringExpenses: roundAmount(
        recurringExpenses.reduce((sum, item) => sum + item.amount, 0)
      ),
    },
    cashFlow: buildFinanceGroups(rows, resolvedPeriod),
    recurringExpenses,
    receivables,
    feesByChannel,
    netProfitBridge,
    insights,
  };
}

function getOperationalCalendar(filters = {}) {
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
  return {
    summary: buildAutomationSummary(automationStore),
    rules: cloneData(automationStore),
    executions: cloneData(automationExecutions),
  };
}

function toggleAutomationRule(ruleId, enabled) {
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

function getIntegrationHub() {
  return cloneData(sellerIntegrationHub);
}

module.exports = {
  getAutomations,
  getFinanceCenter,
  getIntegrationHub,
  getOperationalCalendar,
  getProductDetail,
  toggleAutomationRule,
};
