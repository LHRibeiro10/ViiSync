const { fetchOrderDomainRows, groupRowsByPeriod } = require("./orderDomainPipeline");
const { getFinancialAdjustmentsForUser } = require("./additionalCosts");
const { round2, formatCurrency, resolveViewerUser } = require("./shared");

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
      thumbnail: row.photo || null,
    };

    current.revenueValue += row.grossRevenue;
    if (!current.thumbnail && row.photo) {
      current.thumbnail = row.photo;
    }
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
      thumbnail: product.thumbnail || null,
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

async function getChartData(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const rows = await fetchOrderDomainRows(user.id, period);
  const groupedRows = groupRowsByPeriod(rows, period);

  return groupedRows.map((group) => ({
    label: group.period,
    revenue: round2(group.revenueValue),
  }));
}

module.exports = {
  getDashboard,
  getChartData,
};
