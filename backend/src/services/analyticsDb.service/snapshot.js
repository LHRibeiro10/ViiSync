const { resolvePeriod } = require("./shared");
const { getDashboard, getChartData } = require("./dashboard");
const { getProfitTable, getProfitReport } = require("./profitReport");
const { getOrders } = require("./orders");
const { getProducts } = require("./products");
const { getAccounts } = require("./accounts");
const { getReports } = require("./reports");
const { getSettings } = require("./settings");

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
  getAnalyticsSnapshot,
};
