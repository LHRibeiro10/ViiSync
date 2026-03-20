const {
  accounts,
  orders,
  products,
  profitReportByPeriod,
  profitTableByPeriod,
  settings,
} = require("../data/mockAnalyticsData");

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

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolvePeriod(period) {
  if (period === "7d" || period === "30d" || period === "90d") {
    return period;
  }

  return "30d";
}

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
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

function formatMonthPeriod(date) {
  return `${MONTH_LABELS[date.getMonth()]}/${date.getFullYear()}`;
}

function getProfitReportRows(period = "30d") {
  return cloneData(profitReportByPeriod[resolvePeriod(period)] || []);
}

function buildSummaryFromRows(rows) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      revenue: accumulator.revenue + row.grossRevenue,
      profit: accumulator.profit + row.netProfit,
      sales: accumulator.sales + row.quantity,
      profitMarginTotal: accumulator.profitMarginTotal + row.profitMargin,
      profitMarginCount: accumulator.profitMarginCount + 1,
    }),
    {
      revenue: 0,
      profit: 0,
      sales: 0,
      profitMarginTotal: 0,
      profitMarginCount: 0,
    }
  );

  return {
    revenue: Number(totals.revenue.toFixed(2)),
    profit: Number(totals.profit.toFixed(2)),
    sales: totals.sales,
    averageTicket: totals.sales
      ? Number((totals.revenue / totals.sales).toFixed(2))
      : 0,
    averageMargin: totals.profitMarginCount
      ? Number((totals.profitMarginTotal / totals.profitMarginCount).toFixed(2))
      : 0,
  };
}

function buildTopProductsFromRows(rows, limit = 3) {
  const productsByRevenue = rows.reduce((accumulator, row) => {
    const currentProduct = accumulator.get(row.product) || {
      id: row.id,
      name: row.product,
      revenueValue: 0,
    };

    currentProduct.revenueValue += row.grossRevenue;
    accumulator.set(row.product, currentProduct);

    return accumulator;
  }, new Map());

  return Array.from(productsByRevenue.values())
    .sort((left, right) => right.revenueValue - left.revenueValue)
    .slice(0, limit)
    .map((product, index) => ({
      id: `${index + 1}`,
      name: product.name,
      revenue: formatCurrency(product.revenueValue),
    }));
}

function buildRecentOrdersFromRows(rows, limit = 3) {
  return [...rows]
    .sort((left, right) => parseReportDate(right.date) - parseReportDate(left.date))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      product: row.product,
      marketplace: row.marketplace,
      value: formatCurrency(row.grossRevenue),
    }));
}

function buildChannelsFromRows(rows) {
  const channels = rows.reduce((accumulator, row) => {
    const currentChannel = accumulator.get(row.marketplace) || {
      id: String(accumulator.size + 1),
      name: row.marketplace,
      revenueValue: 0,
      profitValue: 0,
    };

    currentChannel.revenueValue += row.grossRevenue;
    currentChannel.profitValue += row.netProfit;
    accumulator.set(row.marketplace, currentChannel);

    return accumulator;
  }, new Map());

  return Array.from(channels.values())
    .sort((left, right) => right.revenueValue - left.revenueValue)
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      revenue: formatCurrency(channel.revenueValue),
      profit: formatCurrency(channel.profitValue),
    }));
}

function buildTopProfitableProductsFromRows(rows, limit = 3) {
  const productsByProfit = rows.reduce((accumulator, row) => {
    const currentProduct = accumulator.get(row.product) || {
      id: String(accumulator.size + 1),
      name: row.product,
      profitValue: 0,
    };

    currentProduct.profitValue += row.netProfit;
    accumulator.set(row.product, currentProduct);

    return accumulator;
  }, new Map());

  return Array.from(productsByProfit.values())
    .sort((left, right) => right.profitValue - left.profitValue)
    .slice(0, limit)
    .map((product) => ({
      id: product.id,
      name: product.name,
      profit: formatCurrency(product.profitValue),
    }));
}

function buildPeriodGroups(rows, period = "30d") {
  const resolvedPeriod = resolvePeriod(period);
  const groups = rows.reduce((accumulator, row) => {
    const date = parseReportDate(row.date);
    const isQuarterView = resolvedPeriod === "90d";
    const key = isQuarterView
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : row.date;
    const label = isQuarterView ? formatMonthPeriod(date) : shortDateFormatter.format(date);
    const currentGroup = accumulator.get(key) || {
      id: key,
      period: label,
      revenueValue: 0,
      profitValue: 0,
      ordersValue: 0,
      timestamp: date.getTime(),
    };

    currentGroup.revenueValue += row.grossRevenue;
    currentGroup.profitValue += row.netProfit;
    currentGroup.ordersValue += row.quantity;
    accumulator.set(key, currentGroup);

    return accumulator;
  }, new Map());

  return Array.from(groups.values()).sort((left, right) => left.timestamp - right.timestamp);
}

function buildReportRows(rows, period = "30d") {
  return buildPeriodGroups(rows, period).map((group) => ({
    id: group.id,
    period: group.period,
    revenue: formatCurrency(group.revenueValue),
    profit: formatCurrency(group.profitValue),
    orders: group.ordersValue,
  }));
}

function buildChartDataFromRows(rows, period = "30d") {
  return buildPeriodGroups(rows, period).map((group) => ({
    label: group.period,
    revenue: Number(group.revenueValue.toFixed(2)),
  }));
}

function getDashboard(period = "30d") {
  const rows = getProfitReportRows(period);
  const summary = buildSummaryFromRows(rows);

  return {
    summary: {
      revenue: summary.revenue,
      profit: summary.profit,
      sales: summary.sales,
      averageTicket: summary.averageTicket,
    },
    topProducts: buildTopProductsFromRows(rows),
    recentOrders: buildRecentOrdersFromRows(rows),
  };
}

function getProfitTable(period = "30d") {
  return cloneData(profitTableByPeriod[resolvePeriod(period)]);
}

function getProfitReport(period = "30d") {
  return getProfitReportRows(period);
}

function getOrders() {
  return cloneData(orders);
}

function getProducts() {
  return cloneData(products);
}

function getAccounts() {
  return cloneData(accounts);
}

function getReports(period = "30d") {
  const rows = getProfitReportRows(period);
  const summary = buildSummaryFromRows(rows);

  return {
    summary: {
      totalRevenue: formatCurrency(summary.revenue),
      totalProfit: formatCurrency(summary.profit),
      totalOrders: summary.sales,
      averageMargin: formatPercent(summary.averageMargin),
    },
    channels: buildChannelsFromRows(rows),
    topProfitableProducts: buildTopProfitableProductsFromRows(rows),
    rows: buildReportRows(rows, period),
  };
}

function getSettings() {
  return cloneData(settings);
}

function getChartData(period = "30d") {
  return buildChartDataFromRows(getProfitReportRows(period), period);
}

function getAnalyticsSnapshot(period = "30d") {
  const resolvedPeriod = resolvePeriod(period);

  return {
    period: resolvedPeriod,
    dashboard: getDashboard(resolvedPeriod),
    chartData: getChartData(resolvedPeriod),
    profitTable: getProfitTable(resolvedPeriod),
    profitReport: getProfitReport(resolvedPeriod),
    orders: getOrders(),
    products: getProducts(),
    accounts: getAccounts(),
    reports: getReports(resolvedPeriod),
    settings: getSettings(),
  };
}

module.exports = {
  getAccounts,
  getAnalyticsSnapshot,
  getChartData,
  getDashboard,
  getOrders,
  getProducts,
  getProfitReport,
  getProfitTable,
  getReports,
  getSettings,
  resolvePeriod,
};
