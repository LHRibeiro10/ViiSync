const prisma = require("../../lib/prisma");
const { startDateForPeriod, endDateForPeriod } = require("./dateHelpers");
const { normalizeStatus } = require("./accounts");
const { createProductPhoto, photoColorsForId } = require("./products");
const {
  round2,
  normalizeThumbnailUrl,
  isMercadoLivreMarketplace,
  buildRealMarketplaceAccountWhere,
  reportDateFormatter,
  tableDateFormatter,
  shortDateFormatter,
  MONTH_LABELS,
  resolvePeriod,
} = require("./shared");
const { shouldAggregatePeriodByMonth } = require("../../lib/period");

function toItemGrossRevenue(item) {
  if (Number.isFinite(item.totalPrice)) {
    return Number(item.totalPrice);
  }

  return round2((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0));
}

function allocateByShare(totalAmount, share) {
  return round2((Number(totalAmount) || 0) * share);
}

function buildProfitRowsFromOrders(orders = []) {
  const rows = [];

  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) {
      continue;
    }

    const itemsGrossBase = items.reduce((sum, item) => sum + toItemGrossRevenue(item), 0);
    const fallbackShare = items.length ? 1 / items.length : 0;

    for (const item of items) {
      const itemGross = toItemGrossRevenue(item);
      const share = itemsGrossBase > 0 ? itemGross / itemsGrossBase : fallbackShare;
      const marketplaceFee = allocateByShare(order.marketplaceFee, share);
      const shippingPaid = allocateByShare(order.shippingFee, share);
      const discountAmount = allocateByShare(order.discountAmount, share);
      const taxAmount = allocateByShare(order.taxAmount, share);
      const grossRevenue = round2(itemGross - discountAmount);
      const quantity = Number(item.quantity || 0);
      const unitCost = Number(item.unitCost || 0);
      const extraCost = Number(item.extraCost || 0);
      const productCost = round2(unitCost * quantity + extraCost);
      const calculatedProfit = round2(
        grossRevenue - marketplaceFee - shippingPaid - productCost - taxAmount
      );
      const netProfit =
        Number.isFinite(item.profit)
          ? round2(item.profit)
          : calculatedProfit;
      const profitMargin = grossRevenue ? round2((netProfit / grossRevenue) * 100) : 0;
      const roi = productCost ? round2((netProfit / productCost) * 100) : 0;
      const productTitle = item.product?.title || item.title || "Produto sem titulo";
      const accountName = order.marketplaceAccount?.accountName || "Conta";
      const marketplace = order.marketplaceAccount?.marketplace || "Marketplace";
      const isCommercialMlOrder =
        isMercadoLivreMarketplace(marketplace) &&
        Number(order.totalAmount || 0) > 0 &&
        !normalizeStatus(order.status).toLowerCase().includes("cancel");
      const normalizedItemTaxPercent = Number(item.taxPercent);
      const taxPercentMissing =
        !Number.isFinite(normalizedItemTaxPercent) || normalizedItemTaxPercent <= 0;
      const feeDataMissing =
        Boolean(order.marketplaceFeeMissing) ||
        (isCommercialMlOrder && Number(order.marketplaceFee || 0) === 0);
      const shippingDataMissing =
        Boolean(order.shippingFeeMissing) ||
        (isCommercialMlOrder && Number(order.shippingFee || 0) === 0);
      const taxDataMissing =
        Boolean(order.taxAmountMissing) ||
        (isCommercialMlOrder &&
          Number(order.taxAmount || 0) === 0 &&
          taxPercentMissing);
      const productCostDataMissing =
        Boolean(item.unitCostMissing) ||
        (!item.product?.cost &&
          Number(item.unitCost || 0) === 0 &&
          Number(item.extraCost || 0) === 0);
      const hasDataGaps =
        feeDataMissing ||
        shippingDataMissing ||
        taxDataMissing ||
        productCostDataMissing;
      const taxPercent =
        Number.isFinite(normalizedItemTaxPercent) && normalizedItemTaxPercent > 0
          ? normalizedItemTaxPercent
          : grossRevenue
            ? round2((taxAmount / grossRevenue) * 100)
            : 0;
      const thumbnailUrl =
        normalizeThumbnailUrl(item.product?.thumbnail) ||
        normalizeThumbnailUrl(item.thumbnail);
      const [startColor, endColor] = photoColorsForId(item.id || productTitle);

      rows.push({
        id: item.id,
        orderId: order.id,
        marketplaceOrderId: order.marketplaceOrderId,
        dateValue: order.saleDate,
        date: reportDateFormatter.format(new Date(order.saleDate)),
        dateShort: tableDateFormatter.format(new Date(order.saleDate)),
        marketplace,
        account: accountName,
        product: productTitle,
        title: productTitle,
        supplier: item.product?.category || "Nao informado",
        sku: item.sku || item.product?.sku || "N/A",
        quantity,
        salePrice: Number(item.unitPrice || 0),
        value: grossRevenue,
        fee: marketplaceFee,
        sellerShipping: shippingPaid,
        productCost,
        taxPercent,
        taxAmount,
        grossRevenue,
        netProfit,
        profit: netProfit,
        feeDataMissing,
        shippingDataMissing,
        taxDataMissing,
        productCostDataMissing,
        hasDataGaps,
        profitMargin,
        roi,
        status: normalizeStatus(order.status),
        photo: thumbnailUrl || createProductPhoto(startColor, endColor),
      });
    }
  }

  return rows.sort((left, right) => {
    return new Date(right.dateValue).getTime() - new Date(left.dateValue).getTime();
  });
}

function groupRowsByPeriod(rows = [], period = "30d") {
  const resolvedPeriod = resolvePeriod(period);
  const shouldAggregateByMonth = shouldAggregatePeriodByMonth(resolvedPeriod);
  const bucketMap = new Map();

  rows.forEach((row) => {
    const rowDate = new Date(row.dateValue);
    const key = shouldAggregateByMonth
      ? `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}`
      : shortDateFormatter.format(rowDate);
    const label = shouldAggregateByMonth
      ? `${MONTH_LABELS[rowDate.getMonth()]}/${rowDate.getFullYear()}`
      : shortDateFormatter.format(rowDate);
    const current = bucketMap.get(key) || {
      id: key,
      period: label,
      revenueValue: 0,
      profitValue: 0,
      ordersValue: 0,
      timestamp: rowDate.getTime(),
    };

    current.revenueValue += row.grossRevenue;
    current.profitValue += row.netProfit;
    current.ordersValue += row.quantity;
    bucketMap.set(key, current);
  });

  return Array.from(bucketMap.values()).sort((left, right) => left.timestamp - right.timestamp);
}

async function fetchOrderDomainRows(userId, period = "30d") {
  const periodStart = startDateForPeriod(period);
  const periodEnd = endDateForPeriod(period);
  const orders = await prisma.order.findMany({
    where: {
      userId,
      marketplaceAccount: {
        is: buildRealMarketplaceAccountWhere(),
      },
      saleDate: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    include: {
      marketplaceAccount: true,
      items: {
        include: {
          product: {
            include: {
              cost: true,
            },
          },
        },
      },
    },
    orderBy: {
      saleDate: "desc",
    },
  });

  return buildProfitRowsFromOrders(orders);
}

module.exports = {
  toItemGrossRevenue,
  allocateByShare,
  buildProfitRowsFromOrders,
  groupRowsByPeriod,
  fetchOrderDomainRows,
};
