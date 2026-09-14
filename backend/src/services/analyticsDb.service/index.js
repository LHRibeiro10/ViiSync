const { resolvePeriod } = require("./shared");
const { getDashboard, getChartData } = require("./dashboard");
const { getProfitTable, getProfitReport } = require("./profitReport");
const { getReports } = require("./reports");
const {
  getOrdersPayload,
  getOrders,
} = require("./orders");
const { getProducts } = require("./products");
const { getAccounts } = require("./accounts");
const { getSettings } = require("./settings");
const {
  getFinancialAdjustmentsForUser,
  listAdditionalCosts,
  createAdditionalCost,
  updateAdditionalCost,
  removeAdditionalCost,
} = require("./additionalCosts");
const { getAnalyticsSnapshot } = require("./snapshot");

module.exports = {
  createAdditionalCost,
  getAccounts,
  getFinancialAdjustmentsForUser,
  getAnalyticsSnapshot,
  getChartData,
  getDashboard,
  listAdditionalCosts,
  getOrders,
  getOrdersPayload,
  getProducts,
  getProfitReport,
  getProfitTable,
  getReports,
  getSettings,
  removeAdditionalCost,
  resolvePeriod,
  updateAdditionalCost,
};
