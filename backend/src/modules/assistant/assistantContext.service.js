const {
  getAnalyticsSnapshot,
  getDashboard,
  getProfitReport,
  getReports,
} = require("../../services/analyticsDb.service");

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const PORTFOLIO_CANDIDATE_POOL = [
  {
    name: "Webcam Full HD Stream Pro",
    themes: ["gamer", "home-office"],
    reason: "complementa teclado, fone e cadeira em kits de setup completo.",
  },
  {
    name: "Mousepad Deskmat XL",
    themes: ["gamer", "perifericos"],
    reason: "e um acessorio de giro mais leve para subir ticket medio em bundles.",
  },
  {
    name: "Apoio Ergonomico para Punho",
    themes: ["ergonomia", "perifericos"],
    reason: "reforca ergonomia e conversa bem com teclado e mouse.",
  },
  {
    name: "Hub USB-C 7 em 1",
    themes: ["home-office", "produtividade"],
    reason: "abre uma linha adjacente de produtividade sem fugir do perfil atual.",
  },
  {
    name: "Suporte Vertical para Notebook",
    themes: ["ergonomia", "home-office"],
    reason: "amplia o mix de organizacao e setup de trabalho.",
  },
];

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseCurrencyValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return 0;
  }

  if (text.includes(",")) {
    const normalized = text
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safePercent(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function calculateDeltaPercent(currentValue, previousValue) {
  if (!Number.isFinite(previousValue) || previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

function getViewLabel(currentView) {
  switch (currentView) {
    case "/pedidos":
      return "pagina de pedidos";
    case "/produtos":
      return "pagina de produtos";
    case "/contas":
      return "pagina de contas conectadas";
    case "/relatorios":
      return "pagina de relatorios";
    case "/configuracoes":
      return "pagina de configuracoes";
    default:
      return "dashboard";
  }
}

function createAlert(id, severity, title, description) {
  return { id, severity, title, description };
}

function buildAlerts(metrics) {
  const alerts = [];

  if (metrics.monthlyComparison.profitDeltaPercent < 0) {
    alerts.push(
      createAlert(
        "profit-drop",
        "warning",
        "Lucro mensal em desaceleracao",
        `O lucro do periodo mais recente caiu ${formatPercent(
          Math.abs(metrics.monthlyComparison.profitDeltaPercent)
        )} em relacao ao mes anterior.`
      )
    );
  }

  if (metrics.orders.pendingRate >= 25) {
    alerts.push(
      createAlert(
        "pending-orders",
        "warning",
        "Fila de pedidos pendentes acima do ideal",
        `${metrics.orders.pending} pedido(s) ainda estao pendentes, o que representa ${formatPercent(
          metrics.orders.pendingRate
        )} da operacao recente.`
      )
    );
  }

  if (metrics.products.lowestMarginProducts.length && metrics.products.lowestMarginProducts[0].margin <= 22) {
    const worstMarginProduct = metrics.products.lowestMarginProducts[0];

    alerts.push(
      createAlert(
        "margin-pressure",
        "warning",
        "Produto com margem pressionada",
        `${worstMarginProduct.name} esta operando com margem estimada de ${formatPercent(
          worstMarginProduct.margin
        )}.`
      )
    );
  }

  if (metrics.costPressure.shippingSharePercent >= 7) {
    alerts.push(
      createAlert(
        "shipping-pressure",
        "info",
        "Frete consumindo parte relevante da receita",
        `O frete representa ${formatPercent(
          metrics.costPressure.shippingSharePercent
        )} da receita bruta do periodo analisado.`
      )
    );
  }

  if (metrics.products.pausedCount > 0) {
    alerts.push(
      createAlert(
        "paused-products",
        "info",
        "Produtos pausados exigem revisao",
        `Existem ${metrics.products.pausedCount} produto(s) pausado(s) no catalogo atual.`
      )
    );
  }

  if (metrics.accounts.pendingCount > 0) {
    alerts.push(
      createAlert(
        "account-sync",
        "info",
        "Conta com sincronizacao pendente",
        `${metrics.accounts.pendingCount} conta(s) conectada(s) ainda nao estao plenamente sincronizadas.`
      )
    );
  }

  return alerts.slice(0, 4);
}

function buildQuickQuestions(metrics, currentView) {
  const baseQuestions = [
    "Qual produto vendeu mais no periodo?",
    "Como estao minhas margens?",
    "Onde estou gastando mais?",
    "Resuma meu desempenho da semana.",
    "Quais pedidos precisam de atencao?",
    "Me de sugestoes para aumentar lucro.",
  ];

  if (currentView === "/pedidos") {
    return [
      "Quais pedidos estao pendentes?",
      "Qual canal concentra mais pedidos?",
      "Ha gargalo operacional nos pedidos?",
      ...baseQuestions,
    ].slice(0, 6);
  }

  if (currentView === "/produtos") {
    return [
      "Qual produto tem a pior margem?",
      "Quais produtos estao pausados?",
      "Onde devo ajustar preco ou custo?",
      "Que produto diferente faz sentido adicionar?",
      ...baseQuestions,
    ].slice(0, 6);
  }

  if (currentView === "/relatorios") {
    return [
      "Resuma meu desempenho recente.",
      "Qual canal gera mais lucro?",
      "Quais despesas parecem fora do normal?",
      ...baseQuestions,
    ].slice(0, 6);
  }

  return baseQuestions;
}

function labelForPeriod(period) {
  if (period === "7d") {
    return "7 dias";
  }

  if (period === "90d") {
    return "90 dias";
  }

  return "30 dias";
}

function detectIntent(message) {
  const normalizedMessage = normalizeText(message);

  if (
    normalizedMessage.includes("canal") ||
    normalizedMessage.includes("canais") ||
    normalizedMessage.includes("marketplace") ||
    normalizedMessage.includes("marketplaces") ||
    normalizedMessage.includes("conta") ||
    normalizedMessage.includes("contas")
  ) {
    return "channels";
  }

  if (
    normalizedMessage.includes("pedido") ||
    normalizedMessage.includes("pedidos") ||
    normalizedMessage.includes("entrega") ||
    normalizedMessage.includes("pendente")
  ) {
    return "orders";
  }

  if (
    normalizedMessage.includes("gasto") ||
    normalizedMessage.includes("gastando") ||
    normalizedMessage.includes("despesa") ||
    normalizedMessage.includes("despesas") ||
    normalizedMessage.includes("frete") ||
    normalizedMessage.includes("taxa") ||
    normalizedMessage.includes("custo") ||
    normalizedMessage.includes("custos")
  ) {
    return "costs";
  }

  if (
    normalizedMessage.includes("produto") ||
    normalizedMessage.includes("produtos") ||
    normalizedMessage.includes("sku") ||
    normalizedMessage.includes("skus") ||
    normalizedMessage.includes("vendeu mais")
  ) {
    return "products";
  }

  if (
    normalizedMessage.includes("margem") ||
    normalizedMessage.includes("margens") ||
    normalizedMessage.includes("lucro") ||
    normalizedMessage.includes("lucros") ||
    normalizedMessage.includes("rentabilidade") ||
    normalizedMessage.includes("roi")
  ) {
    return "margins";
  }

  return "summary";
}

function detectRequestedPeriod(message, fallbackPeriod = "30d") {
  const normalizedMessage = normalizeText(message);

  if (
    normalizedMessage.includes("7 dias") ||
    normalizedMessage.includes("7d") ||
    normalizedMessage.includes("semana") ||
    normalizedMessage.includes("semanal") ||
    normalizedMessage.includes("hoje")
  ) {
    return "7d";
  }

  if (
    normalizedMessage.includes("90 dias") ||
    normalizedMessage.includes("90d") ||
    normalizedMessage.includes("trimestre") ||
    normalizedMessage.includes("trimestral")
  ) {
    return "90d";
  }

  return fallbackPeriod;
}

function buildReplyDecorations(message, context) {
  const intent = detectIntent(message);
  const suggestions = context.quickQuestions.filter((question) => {
    return normalizeText(question) !== normalizeText(message);
  });

  if (intent === "products") {
    return {
      tone: "positive",
      highlights: [
        {
          label: "Top faturamento",
          value: context.products.topRevenueProducts[0]
            ? `${context.products.topRevenueProducts[0].name} · ${context.products.topRevenueProducts[0].revenue}`
            : "Sem dados",
        },
        {
          label: "Top lucro",
          value: context.products.topProfitProducts[0]
            ? `${context.products.topProfitProducts[0].name} · ${context.products.topProfitProducts[0].profit}`
            : "Sem dados",
        },
        {
          label: "Pior margem",
          value: context.products.lowestMarginProducts[0]
            ? `${context.products.lowestMarginProducts[0].name} · ${formatPercent(
                context.products.lowestMarginProducts[0].margin
              )}`
            : "Sem dados",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  if (intent === "margins") {
    return {
      tone: context.summary.averageMargin >= 25 ? "positive" : "warning",
      highlights: [
        {
          label: "Margem media",
          value: formatPercent(context.summary.averageMargin),
        },
        {
          label: "Margem liquida",
          value: formatPercent(context.costPressure.netMarginPercent),
        },
        {
          label: "Produto critico",
          value: context.products.lowestMarginProducts[0]
            ? `${context.products.lowestMarginProducts[0].name} · ${formatPercent(
                context.products.lowestMarginProducts[0].margin
              )}`
            : "Sem dados",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  if (intent === "costs") {
    return {
      tone: context.costPressure.shippingSharePercent >= 7 ? "warning" : "neutral",
      highlights: [
        {
          label: "Taxas marketplace",
          value: formatCurrency(context.costPressure.totalMarketplaceFee),
        },
        {
          label: "Frete pago",
          value: formatCurrency(context.costPressure.totalShippingPaid),
        },
        {
          label: "Maior pressao",
          value: context.costPressure.highestShippingProduct
            ? `${context.costPressure.highestShippingProduct.product} · ${formatCurrency(
                context.costPressure.highestShippingProduct.shippingPaid
              )}`
            : "Sem dados",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  if (intent === "orders") {
    return {
      tone: context.orders.pendingRate >= 25 ? "warning" : "neutral",
      highlights: [
        {
          label: "Pendentes",
          value: `${context.orders.pending} pedido(s)`,
        },
        {
          label: "Enviados",
          value: `${context.orders.shipped} pedido(s)`,
        },
        {
          label: "Canal dominante",
          value: context.channels.strongestChannel
            ? context.channels.strongestChannel.name
            : "Sem dados",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  if (intent === "channels") {
    return {
      tone: "neutral",
      highlights: [
        {
          label: "Canal mais rentavel",
          value: context.channels.strongestChannel
            ? `${context.channels.strongestChannel.name} · ${context.channels.strongestChannel.profit}`
            : "Sem dados",
        },
        {
          label: "Contas conectadas",
          value: `${context.accounts.connectedCount}/${context.accounts.totalCount}`,
        },
        {
          label: "Conta pendente",
          value:
            context.accounts.pendingAccounts[0]?.name ??
            "Nenhuma conta pendente",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  return {
    tone: context.alerts.some((alert) => alert.severity === "warning")
      ? "warning"
      : "positive",
    highlights: [
      {
        label: `Receita ${labelForPeriod(context.period)}`,
        value: formatCurrency(context.summary.revenue),
      },
      {
        label: `Lucro ${labelForPeriod(context.period)}`,
        value: formatCurrency(context.summary.profit),
      },
      {
        label: "Margem media",
        value: formatPercent(context.summary.averageMargin),
      },
    ],
    suggestions: suggestions.slice(0, 3),
  };
}

function createWelcomeMessage(context) {
  const alertMessage = context.alerts[0]
    ? ` Ja identifiquei um ponto de atencao: ${context.alerts[0].title.toLowerCase()}.`
    : "";

  return `Sou a assistente do ViiSync. No recorte atual de ${labelForPeriod(
    context.period
  )}, seu negocio soma ${formatCurrency(
    context.summary.revenue
  )} de receita, ${formatCurrency(
    context.summary.profit
  )} de lucro e margem media de ${formatPercent(
    context.summary.averageMargin
  )}.${alertMessage} Posso responder perguntas sobre vendas, margem, despesas, produtos, canais e operacao.`;
}

function inferCatalogThemes(productName) {
  const normalizedName = normalizeText(productName);
  const themes = new Set();

  if (
    normalizedName.includes("gamer") ||
    normalizedName.includes("teclado") ||
    normalizedName.includes("mouse") ||
    normalizedName.includes("fone")
  ) {
    themes.add("gamer");
  }

  if (
    normalizedName.includes("teclado") ||
    normalizedName.includes("mouse") ||
    normalizedName.includes("fone")
  ) {
    themes.add("perifericos");
  }

  if (
    normalizedName.includes("cadeira") ||
    normalizedName.includes("suporte") ||
    normalizedName.includes("monitor")
  ) {
    themes.add("ergonomia");
    themes.add("home-office");
  }

  if (normalizedName.includes("audio") || normalizedName.includes("fone")) {
    themes.add("audio");
  }

  return [...themes];
}

function buildPortfolioIdeas(productRows) {
  const catalogNames = new Set(productRows.map((product) => normalizeText(product.name)));
  const themeCounts = productRows.reduce((accumulator, product) => {
    for (const theme of inferCatalogThemes(product.name)) {
      accumulator[theme] = (accumulator[theme] || 0) + 1;
    }

    return accumulator;
  }, {});

  const additionCandidates = PORTFOLIO_CANDIDATE_POOL.filter((candidate) => {
    return !catalogNames.has(normalizeText(candidate.name));
  })
    .map((candidate) => {
      const themeScore = candidate.themes.reduce((score, theme) => {
        return score + (themeCounts[theme] || 0);
      }, 0);

      return {
        ...candidate,
        score: themeScore,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map(({ score, ...candidate }) => candidate);

  return {
    themes: Object.keys(themeCounts).sort((left, right) => {
      return (themeCounts[right] || 0) - (themeCounts[left] || 0);
    }),
    additionCandidates,
  };
}

async function buildAssistantContext({
  period = "30d",
  currentView = "/",
  request = {},
} = {}) {
  const [snapshot, weeklyDashboard, monthlyDashboard, quarterDashboard, profitReportRows, reports] =
    await Promise.all([
      getAnalyticsSnapshot(period, request),
      getDashboard("7d", request),
      getDashboard("30d", request),
      getDashboard("90d", request),
      getProfitReport(period, request),
      getReports(period, request),
    ]);

  const weeklySummary = weeklyDashboard.summary;
  const monthlySummary = monthlyDashboard.summary;
  const quarterSummary = quarterDashboard.summary;
  const latestMonthlyRows = reports.rows.map((row) => {
    const revenue = parseCurrencyValue(row.revenue);
    const profit = parseCurrencyValue(row.profit);
    const orders = parseCurrencyValue(row.orders);

    return {
      ...row,
      revenueValue: revenue,
      profitValue: profit,
      ordersValue: orders,
      marginValue: safePercent(profit, revenue),
    };
  });

  const currentMonth = latestMonthlyRows[latestMonthlyRows.length - 1] || null;
  const previousMonth = latestMonthlyRows[latestMonthlyRows.length - 2] || null;

  const ordersByStatus = snapshot.orders.reduce(
    (accumulator, order) => {
      const normalizedStatus = normalizeText(order.status);

      if (normalizedStatus.includes("pendente")) {
        accumulator.pending += 1;
      } else if (normalizedStatus.includes("enviado")) {
        accumulator.shipped += 1;
      } else if (normalizedStatus.includes("entregue")) {
        accumulator.delivered += 1;
      }

      return accumulator;
    },
    {
      pending: 0,
      shipped: 0,
      delivered: 0,
    }
  );

  const orderRows = snapshot.orders.map((order) => ({
    ...order,
    valueNumber: parseCurrencyValue(order.value),
    normalizedStatus: normalizeText(order.status),
  }));

  const productRows = snapshot.products.map((product) => ({
    ...product,
    priceValue: parseCurrencyValue(product.price),
    costValue: parseCurrencyValue(product.cost),
    marginValue: parseCurrencyValue(product.margin),
  }));

  const sortedByMargin = [...productRows].sort((left, right) => {
    return left.marginValue - right.marginValue;
  });
  const sortedByMarginDescending = [...productRows].sort((left, right) => {
    return right.marginValue - left.marginValue;
  });

  const sortedTopProfitProducts = snapshot.reports.topProfitableProducts
    .map((product) => ({
      ...product,
      profitValue: parseCurrencyValue(product.profit),
    }))
    .sort((left, right) => right.profitValue - left.profitValue);

  const sortedTopRevenueProducts = snapshot.dashboard.topProducts
    .map((product) => ({
      ...product,
      revenueValue: parseCurrencyValue(product.revenue),
    }))
    .sort((left, right) => right.revenueValue - left.revenueValue);

  const channels = snapshot.reports.channels
    .map((channel) => ({
      ...channel,
      revenueValue: parseCurrencyValue(channel.revenue),
      profitValue: parseCurrencyValue(channel.profit),
    }))
    .sort((left, right) => right.profitValue - left.profitValue);

  const costPressureTotals = profitReportRows.reduce(
    (accumulator, row) => {
      return {
        grossRevenue: accumulator.grossRevenue + row.grossRevenue,
        netProfit: accumulator.netProfit + row.netProfit,
        totalMarketplaceFee: accumulator.totalMarketplaceFee + row.marketplaceFee,
        totalShippingPaid: accumulator.totalShippingPaid + row.shippingPaid,
        totalProductCost: accumulator.totalProductCost + row.productCost,
      };
    },
    {
      grossRevenue: 0,
      netProfit: 0,
      totalMarketplaceFee: 0,
      totalShippingPaid: 0,
      totalProductCost: 0,
    }
  );

  const highestShippingProduct = [...profitReportRows].sort((left, right) => {
    return right.shippingPaid - left.shippingPaid;
  })[0];

  const highestFeeProduct = [...profitReportRows].sort((left, right) => {
    return right.marketplaceFee - left.marketplaceFee;
  })[0];
  const portfolioIdeas = buildPortfolioIdeas(productRows);

  const metrics = {
    period: snapshot.period,
    generatedAt: new Date().toISOString(),
    currentView,
    currentViewLabel: getViewLabel(currentView),
    business: {
      ownerName: snapshot.settings.profile.name,
      companyName: snapshot.settings.profile.company,
      email: snapshot.settings.profile.email,
    },
    summary: {
      revenue: snapshot.dashboard.summary.revenue,
      profit: snapshot.dashboard.summary.profit,
      sales: snapshot.dashboard.summary.sales,
      averageTicket: snapshot.dashboard.summary.averageTicket,
      averageMargin: parseCurrencyValue(snapshot.reports.summary.averageMargin),
    },
    periodSnapshots: {
      "7d": {
        revenue: weeklySummary.revenue,
        profit: weeklySummary.profit,
        sales: weeklySummary.sales,
        averageTicket: weeklySummary.averageTicket,
      },
      "30d": {
        revenue: monthlySummary.revenue,
        profit: monthlySummary.profit,
        sales: monthlySummary.sales,
        averageTicket: monthlySummary.averageTicket,
      },
      "90d": {
        revenue: quarterSummary.revenue,
        profit: quarterSummary.profit,
        sales: quarterSummary.sales,
        averageTicket: quarterSummary.averageTicket,
      },
    },
    weeklySummary: {
      revenue: weeklySummary.revenue,
      profit: weeklySummary.profit,
      sales: weeklySummary.sales,
      averageTicket: weeklySummary.averageTicket,
      revenuePaceVsMonth: calculateDeltaPercent(
        weeklySummary.revenue * 4.285,
        monthlySummary.revenue
      ),
      profitPaceVsMonth: calculateDeltaPercent(
        weeklySummary.profit * 4.285,
        monthlySummary.profit
      ),
    },
    monthlyComparison: {
      currentMonth,
      previousMonth,
      revenueDeltaPercent: calculateDeltaPercent(
        currentMonth?.revenueValue ?? 0,
        previousMonth?.revenueValue ?? 0
      ),
      profitDeltaPercent: calculateDeltaPercent(
        currentMonth?.profitValue ?? 0,
        previousMonth?.profitValue ?? 0
      ),
      ordersDeltaPercent: calculateDeltaPercent(
        currentMonth?.ordersValue ?? 0,
        previousMonth?.ordersValue ?? 0
      ),
    },
    orders: {
      total: snapshot.orders.length,
      pending: ordersByStatus.pending,
      shipped: ordersByStatus.shipped,
      delivered: ordersByStatus.delivered,
      pendingRate: safePercent(ordersByStatus.pending, snapshot.orders.length),
      rows: orderRows.map((order) => ({
        id: order.id,
        product: order.product,
        marketplace: order.marketplace,
        value: order.value,
        status: order.status,
      })),
      pendingOrders: orderRows
        .filter((order) => order.normalizedStatus.includes("pendente"))
        .map((order) => ({
          id: order.id,
          product: order.product,
          marketplace: order.marketplace,
          value: order.value,
          status: order.status,
        })),
      highestValueOrder: [...orderRows]
        .sort((left, right) => right.valueNumber - left.valueNumber)
        .map((order) => ({
          id: order.id,
          product: order.product,
          marketplace: order.marketplace,
          value: order.value,
          status: order.status,
        }))[0] || null,
      byMarketplace: Object.entries(
        snapshot.orders.reduce((accumulator, order) => {
          const marketplace = order.marketplace || "Nao identificado";
          accumulator[marketplace] = (accumulator[marketplace] || 0) + 1;
          return accumulator;
        }, {})
      )
        .map(([marketplace, count]) => ({
          marketplace,
          count,
        }))
        .sort((left, right) => right.count - left.count),
      recentOrders: snapshot.dashboard.recentOrders.slice(0, 3),
    },
    products: {
      total: productRows.length,
      activeCount: productRows.filter((product) => normalizeText(product.status) === "ativo").length,
      pausedCount: productRows.filter((product) => normalizeText(product.status) === "pausado").length,
      rows: productRows.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        status: product.status,
        margin: product.marginValue,
        price: product.price,
        cost: product.cost,
      })),
      topRevenueProducts: sortedTopRevenueProducts.slice(0, 3).map((product) => ({
        id: product.id,
        name: product.name,
        revenue: product.revenue,
      })),
      topProfitProducts: sortedTopProfitProducts.slice(0, 3).map((product) => ({
        id: product.id,
        name: product.name,
        profit: product.profit,
      })),
      highestMarginProduct: sortedByMarginDescending[0]
        ? {
            name: sortedByMarginDescending[0].name,
            margin: sortedByMarginDescending[0].marginValue,
          }
        : null,
      lowestMarginProducts: sortedByMargin.slice(0, 3).map((product) => ({
        id: product.id,
        name: product.name,
        margin: product.marginValue,
        status: product.status,
      })),
      pausedProducts: productRows
        .filter((product) => normalizeText(product.status) === "pausado")
        .map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          margin: product.marginValue,
        })),
      portfolioIdeas,
    },
    channels: {
      strongestChannel: channels[0]
        ? {
            name: channels[0].name,
            revenue: channels[0].revenue,
            profit: channels[0].profit,
          }
        : null,
      weakestChannel: channels[channels.length - 1]
        ? {
            name: channels[channels.length - 1].name,
            revenue: channels[channels.length - 1].revenue,
            profit: channels[channels.length - 1].profit,
          }
        : null,
      rows: channels.map((channel) => ({
        name: channel.name,
        revenue: channel.revenue,
        profit: channel.profit,
        marginPercent: safePercent(channel.profitValue, channel.revenueValue),
      })),
    },
    accounts: {
      totalCount: snapshot.accounts.length,
      connectedCount: snapshot.accounts.filter((account) => normalizeText(account.status) === "conectada").length,
      pendingCount: snapshot.accounts.filter((account) => normalizeText(account.status) === "pendente").length,
      connectedAccounts: snapshot.accounts
        .filter((account) => normalizeText(account.status) === "conectada")
        .map((account) => ({
          id: account.id,
          name: account.name,
          marketplace: account.marketplace,
        })),
      pendingAccounts: snapshot.accounts
        .filter((account) => normalizeText(account.status) === "pendente")
        .map((account) => ({
          id: account.id,
          name: account.name,
          marketplace: account.marketplace,
        })),
    },
    costPressure: {
      grossRevenue: costPressureTotals.grossRevenue,
      netProfit: costPressureTotals.netProfit,
      totalMarketplaceFee: costPressureTotals.totalMarketplaceFee,
      totalShippingPaid: costPressureTotals.totalShippingPaid,
      totalProductCost: costPressureTotals.totalProductCost,
      feeSharePercent: safePercent(
        costPressureTotals.totalMarketplaceFee,
        costPressureTotals.grossRevenue
      ),
      shippingSharePercent: safePercent(
        costPressureTotals.totalShippingPaid,
        costPressureTotals.grossRevenue
      ),
      productCostSharePercent: safePercent(
        costPressureTotals.totalProductCost,
        costPressureTotals.grossRevenue
      ),
      netMarginPercent: safePercent(
        costPressureTotals.netProfit,
        costPressureTotals.grossRevenue
      ),
      highestShippingProduct,
      highestFeeProduct,
    },
  };

  metrics.alerts = buildAlerts(metrics);
  metrics.insights = [
    `${metrics.products.topRevenueProducts[0]?.name ?? "Seu item lider"} lidera o faturamento recente.`,
    `${metrics.channels.strongestChannel?.name ?? "O principal canal"} concentra o maior lucro entre os marketplaces conectados.`,
    `A margem media consolidada esta em ${formatPercent(metrics.summary.averageMargin)} no recorte atual.`,
    `O ritmo semanal de receita esta ${metrics.weeklySummary.revenuePaceVsMonth >= 0 ? "acima" : "abaixo"} da media do mes em ${formatPercent(
      Math.abs(metrics.weeklySummary.revenuePaceVsMonth)
    )}.`,
  ];
  metrics.quickQuestions = buildQuickQuestions(metrics, currentView);

  return metrics;
}

module.exports = {
  buildAssistantContext,
  buildReplyDecorations,
  createWelcomeMessage,
  detectRequestedPeriod,
  detectIntent,
  formatCurrency,
  formatPercent,
  normalizeText,
};
