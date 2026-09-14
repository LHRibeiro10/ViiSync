const {
  buildTopSellerReply,
  buildTopProfitProductReply,
  buildBestMarginReply,
  buildMarginReply,
  buildPausedProductsReply,
  buildReactivationReply,
  buildProductActionReply,
  buildPortfolioMixReply,
} = require("./replies/productReplies");
const {
  buildPendingOrdersReply,
  buildDelayedOrdersReply,
  buildOrderProfitReply,
  buildOrderChannelMixReply,
} = require("./replies/orderReplies");
const {
  buildChannelReply,
  buildConnectedAccountsReply,
  buildAccountReply,
} = require("./replies/channelAccountReplies");
const {
  buildAlertsReply,
  buildForecastReply,
  buildTrendReply,
  buildCostReply,
  buildIncreaseProfitReply,
  buildAttentionReply,
  buildSummaryReply,
} = require("./replies/insightReplies");
const {
  buildInventoryReply,
  buildCampaignReply,
  buildSecurityReply,
  buildOutOfScopeReply,
} = require("./replies/miscReplies");

function buildReplyByAnalysis(analysis, context) {
  if (analysis.isOutOfScope) {
    return buildOutOfScopeReply();
  }

  if (analysis.asksSecurity) {
    return buildSecurityReply();
  }

  if (analysis.asksInventory) {
    return buildInventoryReply(context);
  }

  if (analysis.asksCampaignAdvice) {
    return buildCampaignReply(context);
  }

  if (analysis.asksAddProduct || analysis.asksRemoveProduct) {
    return buildPortfolioMixReply(analysis, context);
  }

  if (analysis.asksConnectedAccounts) {
    return buildConnectedAccountsReply(context);
  }

  if (analysis.asksAccountStatus) {
    return buildAccountReply(context);
  }

  if (analysis.asksAlerts) {
    return buildAlertsReply(context);
  }

  if (analysis.asksForecast) {
    return buildForecastReply(context);
  }

  if (analysis.asksProfitDrop || analysis.asksSalesDrop) {
    return buildTrendReply(analysis, context);
  }

  if (analysis.asksOrderChannelMix) {
    return buildOrderChannelMixReply(context);
  }

  if (analysis.asksOrderProfit) {
    return buildOrderProfitReply(context);
  }

  if (analysis.asksDelayedOrders) {
    return buildDelayedOrdersReply(context);
  }

  if (analysis.asksPausedProducts) {
    return buildPausedProductsReply(context);
  }

  if (analysis.asksReactivation) {
    return buildReactivationReply(context);
  }

  if (analysis.asksPriceCostAdjust) {
    return buildProductActionReply(context);
  }

  if (analysis.asksPendingOrders || analysis.intent === "orders") {
    return buildPendingOrdersReply(context);
  }

  if (analysis.asksTopProfitProduct) {
    return buildTopProfitProductReply(context);
  }

  if (analysis.asksTopSeller) {
    return buildTopSellerReply(analysis, context);
  }

  if (analysis.asksIncreaseProfit) {
    return buildIncreaseProfitReply(context);
  }

  if (analysis.asksAnomaly || analysis.asksExpenses || analysis.intent === "costs") {
    return buildCostReply(context);
  }

  if (analysis.asksChannels || analysis.requestedChannel || analysis.intent === "channels") {
    return buildChannelReply(analysis, context);
  }

  if (analysis.asksBestMargin) {
    return buildBestMarginReply(context);
  }

  if (analysis.asksWorstMargin || analysis.asksMarginStatus || analysis.intent === "margins") {
    return buildMarginReply(analysis, context);
  }

  if (analysis.asksAttentionToday) {
    return buildAttentionReply(context);
  }

  if (analysis.asksWeeklySummary || analysis.asksSummary || analysis.intent === "summary") {
    return buildSummaryReply(analysis, context);
  }

  if (analysis.intent === "products") {
    return buildProductActionReply(context);
  }

  return buildSummaryReply(analysis, context);
}

module.exports = {
  buildReplyByAnalysis,
};
