const { fetchOrderDomainRows } = require("./orderDomainPipeline");
const { round2, resolveViewerUser } = require("./shared");

async function getProfitTable(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const rows = await fetchOrderDomainRows(user.id, period);

  return rows.map((row) => ({
    id: row.id,
    photo: row.photo,
    title: row.title,
    account: row.account,
    sku: row.sku,
    date: row.dateShort,
    quantity: row.quantity,
    value: round2(row.value),
    fee: round2(row.fee),
    feeMissing: Boolean(row.feeDataMissing),
    sellerShipping: round2(row.sellerShipping),
    sellerShippingMissing: Boolean(row.shippingDataMissing),
    productCost: round2(row.productCost),
    productCostMissing: Boolean(row.productCostDataMissing),
    taxPercent: round2(row.taxPercent),
    taxMissing: Boolean(row.taxDataMissing),
    profit: round2(row.profit),
    profitEstimated: Boolean(row.hasDataGaps),
    hasDataGaps: Boolean(row.hasDataGaps),
  }));
}

async function getProfitReport(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);

  const rows = await fetchOrderDomainRows(user.id, period);

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    marketplace: row.marketplace,
    product: row.product,
    supplier: row.supplier,
    quantity: row.quantity,
    salePrice: round2(row.salePrice),
    productCost: round2(row.productCost),
    marketplaceFee: round2(row.fee),
    shippingPaid: round2(row.sellerShipping),
    grossRevenue: round2(row.grossRevenue),
    netProfit: round2(row.netProfit),
    profitMargin: round2(row.profitMargin),
    roi: round2(row.roi),
  }));
}

module.exports = {
  getProfitTable,
  getProfitReport,
};
