const { fetchOrderDomainRows, groupRowsByPeriod } = require("./orderDomainPipeline");
const { getFinancialAdjustmentsForUser } = require("./additionalCosts");
const { round2, formatCurrency, formatPercent, resolveViewerUser } = require("./shared");

async function getReports(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const rows = await fetchOrderDomainRows(user.id, period);
  const totalRevenue = rows.reduce((sum, row) => sum + row.grossRevenue, 0);
  const totalProfitBeforeAdjustments = rows.reduce((sum, row) => sum + row.netProfit, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.quantity, 0);
  const adjustments = await getFinancialAdjustmentsForUser(user.id, period);
  const totalProfit = round2(totalProfitBeforeAdjustments - adjustments.totalAdjustments);
  const averageMargin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

  const channelsMap = rows.reduce((map, row) => {
    const current = map.get(row.marketplace) || {
      id: String(map.size + 1),
      name: row.marketplace,
      revenueValue: 0,
      profitValue: 0,
    };

    current.revenueValue += row.grossRevenue;
    current.profitValue += row.netProfit;
    map.set(row.marketplace, current);
    return map;
  }, new Map());

  const channels = Array.from(channelsMap.values())
    .sort((left, right) => right.revenueValue - left.revenueValue)
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      revenue: formatCurrency(channel.revenueValue),
      profit: formatCurrency(channel.profitValue),
    }));

  const productProfitMap = rows.reduce((map, row) => {
    const current = map.get(row.product) || {
      id: String(map.size + 1),
      name: row.product,
      profitValue: 0,
    };

    current.profitValue += row.netProfit;
    map.set(row.product, current);
    return map;
  }, new Map());

  const topProfitableProducts = Array.from(productProfitMap.values())
    .sort((left, right) => right.profitValue - left.profitValue)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      name: item.name,
      profit: formatCurrency(item.profitValue),
    }));

  const groupedRows = groupRowsByPeriod(rows, period).map((group, index) => ({
    id: `${index + 1}`,
    period: group.period,
    revenue: formatCurrency(group.revenueValue),
    profit: formatCurrency(group.profitValue),
    orders: group.ordersValue,
  }));

  return {
    summary: {
      totalRevenue: formatCurrency(totalRevenue),
      totalProfit: formatCurrency(totalProfit),
      totalProfitBeforeAdjustments: formatCurrency(totalProfitBeforeAdjustments),
      totalOrders,
      averageMargin: formatPercent(averageMargin),
      adjustments: {
        recurringExpenses: formatCurrency(adjustments.recurringTotal),
        additionalCosts: formatCurrency(adjustments.additionalTotal),
        total: formatCurrency(adjustments.totalAdjustments),
      },
    },
    channels,
    topProfitableProducts,
    rows: groupedRows,
  };
}

module.exports = {
  getReports,
};
