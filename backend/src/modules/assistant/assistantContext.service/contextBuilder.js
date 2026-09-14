const {
  getAnalyticsSnapshot,
  getDashboard,
  getProfitReport,
  getReports,
} = require("../../../services/analyticsDb.service");
const {
  normalizeText,
  parseCurrencyValue,
  safePercent,
  calculateDeltaPercent,
  getViewLabel,
  formatPercent,
} = require("./shared");
const { buildAlerts } = require("./alerts");
const { buildQuickQuestions } = require("./quickQuestions");
const { buildPortfolioIdeas } = require("./portfolioIdeas");

async function buildAssistantContext({
  period = "30d",
  currentView = "/",
  request = {},
} = {}) {
  const [
    snapshot,
    weeklyDashboard,
    monthlyDashboard,
    quarterDashboard,
    yearlyDashboard,
    profitReportRows,
    reports,
  ] =
    await Promise.all([
      getAnalyticsSnapshot(period, request),
      getDashboard("7d", request),
      getDashboard("30d", request),
      getDashboard("90d", request),
      getDashboard("1y", request),
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
      "1y": {
        revenue: yearlyDashboard.summary.revenue,
        profit: yearlyDashboard.summary.profit,
        sales: yearlyDashboard.summary.sales,
        averageTicket: yearlyDashboard.summary.averageTicket,
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
};
