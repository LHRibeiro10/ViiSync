const {
  createRecurringExpense,
  getFinanceCenter,
  removeRecurringExpense,
} = require("./financeCenter");
const { getProductDetail } = require("./productDetail");
const {
  getAutomations,
  getOperationalCalendar,
  toggleAutomationRule,
} = require("./calendarAutomations");
const { getIntegrationHub } = require("./integrationHub");

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
