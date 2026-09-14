import { formatCurrency } from "./presentation";
import { parseCurrencyValue, formatMonthReference } from "./reportsFormatting";

function calculateProfitReportSummary(rows) {
  const summary = rows.reduce(
    (accumulator, row) => {
      const profitMargin = parseCurrencyValue(row.profitMargin);
      const roi = parseCurrencyValue(row.roi);

      return {
        quantity: accumulator.quantity + parseCurrencyValue(row.quantity),
        salePrice: accumulator.salePrice + parseCurrencyValue(row.salePrice),
        productCost: accumulator.productCost + parseCurrencyValue(row.productCost),
        marketplaceFee:
          accumulator.marketplaceFee + parseCurrencyValue(row.marketplaceFee),
        shippingPaid:
          accumulator.shippingPaid + parseCurrencyValue(row.shippingPaid),
        grossRevenue:
          accumulator.grossRevenue + parseCurrencyValue(row.grossRevenue),
        netProfit: accumulator.netProfit + parseCurrencyValue(row.netProfit),
        profitMarginTotal: accumulator.profitMarginTotal + profitMargin,
        profitMarginCount:
          accumulator.profitMarginCount + (Number.isFinite(profitMargin) ? 1 : 0),
        roiTotal: accumulator.roiTotal + roi,
        roiCount: accumulator.roiCount + (Number.isFinite(roi) ? 1 : 0),
      };
    },
    {
      quantity: 0,
      salePrice: 0,
      productCost: 0,
      marketplaceFee: 0,
      shippingPaid: 0,
      grossRevenue: 0,
      netProfit: 0,
      profitMarginTotal: 0,
      profitMarginCount: 0,
      roiTotal: 0,
      roiCount: 0,
    }
  );

  return {
    ...summary,
    averageProfitMargin: summary.profitMarginCount
      ? summary.profitMarginTotal / summary.profitMarginCount
      : 0,
    averageRoi: summary.roiCount ? summary.roiTotal / summary.roiCount : 0,
  };
}

function groupExpensesByMonth(expenses) {
  const expensesByMonth = expenses.reduce((accumulator, expense) => {
    const monthReference = expense.monthReference || "";

    if (!accumulator.has(monthReference)) {
      accumulator.set(monthReference, []);
    }

    accumulator.get(monthReference).push(expense);

    return accumulator;
  }, new Map());

  return Array.from(expensesByMonth.entries())
    .sort(([firstMonth], [secondMonth]) => firstMonth.localeCompare(secondMonth))
    .map(([monthReference, monthExpenses]) => {
      const items = [...monthExpenses].sort((firstExpense, secondExpense) => {
        const firstTimestamp = new Date(firstExpense.createdAt).getTime();
        const secondTimestamp = new Date(secondExpense.createdAt).getTime();

        return (
          (Number.isFinite(firstTimestamp) ? firstTimestamp : 0) -
          (Number.isFinite(secondTimestamp) ? secondTimestamp : 0)
        );
      });

      return {
        monthReference,
        label: formatMonthReference(monthReference),
        items,
        total: items.reduce((total, expense) => total + expense.value, 0),
      };
    });
}

function buildMonthlyReportRows(rows) {
  return rows.map((row) => {
    const revenueValue = parseCurrencyValue(row.revenue);
    const profitValue = parseCurrencyValue(row.profit);
    const ordersValue = parseCurrencyValue(row.orders);
    const marginValue = revenueValue ? (profitValue / revenueValue) * 100 : 0;

    return {
      ...row,
      revenueValue,
      profitValue,
      ordersValue,
      marginValue,
    };
  });
}
function calculateMonthlyReportSummary(rows) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      revenue: accumulator.revenue + row.revenueValue,
      profit: accumulator.profit + row.profitValue,
      orders: accumulator.orders + row.ordersValue,
    }),
    {
      revenue: 0,
      profit: 0,
      orders: 0,
    }
  );

  return {
    ...totals,
    marginValue: totals.revenue ? (totals.profit / totals.revenue) * 100 : 0,
  };
}

function buildChannelPerformance(rows) {
  const channels = rows.reduce((accumulator, row) => {
    const key = row.marketplace;
    const currentChannel = accumulator.get(key) || {
      id: key.toLowerCase().replace(/\s+/g, "-"),
      name: key,
      revenueValue: 0,
      profitValue: 0,
    };

    currentChannel.revenueValue += parseCurrencyValue(row.grossRevenue);
    currentChannel.profitValue += parseCurrencyValue(row.netProfit);
    accumulator.set(key, currentChannel);

    return accumulator;
  }, new Map());

  return Array.from(channels.values())
    .sort((left, right) => right.revenueValue - left.revenueValue)
    .map((channel) => ({
      ...channel,
      revenue: formatCurrency(channel.revenueValue),
      profit: formatCurrency(channel.profitValue),
    }));
}

function buildTopProfitableProducts(rows, limit = 3) {
  const productsByProfit = rows.reduce((accumulator, row) => {
    const key = row.product;
    const currentProduct = accumulator.get(key) || {
      id: key.toLowerCase().replace(/\s+/g, "-"),
      name: key,
      profitValue: 0,
    };

    currentProduct.profitValue += parseCurrencyValue(row.netProfit);
    accumulator.set(key, currentProduct);

    return accumulator;
  }, new Map());

  return Array.from(productsByProfit.values())
    .sort((left, right) => right.profitValue - left.profitValue)
    .slice(0, limit)
    .map((product) => ({
      ...product,
      profit: formatCurrency(product.profitValue),
    }));
}

export {
  calculateProfitReportSummary,
  groupExpensesByMonth,
  buildMonthlyReportRows,
  calculateMonthlyReportSummary,
  buildChannelPerformance,
  buildTopProfitableProducts,
};
