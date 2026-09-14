const { resolvePeriod } = require("../../../services/analyticsDb.service");
const { resolvePeriodRange, shouldAggregatePeriodByMonth } = require("../../../lib/period");
const prisma = require("../../../lib/prisma");
const { productDetails } = require("../../../data/mockSellerWorkspaceData");
const {
  ENABLE_WORKSPACE_DEMO_DATA,
  MONTH_LABELS,
  cloneData,
  createHttpError,
  roundAmount,
  resolveViewerUser,
} = require("./shared");

function startDateForPeriod(period) {
  return resolvePeriodRange(period).startDate;
}

function endDateForPeriod(period) {
  return resolvePeriodRange(period).endDate;
}

function formatEvolutionLabel(date, period) {
  const resolvedPeriod = resolvePeriod(period);
  const currentDate = date instanceof Date ? date : new Date(date);

  if (shouldAggregatePeriodByMonth(resolvedPeriod)) {
    return `${MONTH_LABELS[currentDate.getMonth()]}/${currentDate.getFullYear()}`;
  }

  return `${String(currentDate.getDate()).padStart(2, "0")}/${String(
    currentDate.getMonth() + 1
  ).padStart(2, "0")}`;
}

function classifyProductHealth(marginPercent) {
  if (marginPercent >= 18) {
    return "Saude forte";
  }

  if (marginPercent >= 8) {
    return "Saude em atencao";
  }

  return "Margem critica";
}

async function getProductDetail(productId, period = "30d", request = {}) {
  const resolvedPeriod = resolvePeriod(period);
  const user = await resolveViewerUser(request);

  const product = await prisma.product.findFirst({
    where: {
      id: String(productId || "").trim(),
      userId: user.id,
    },
    include: {
      cost: true,
      marketplaceAccount: true,
      orderItems: {
        include: {
          order: {
            include: {
              marketplaceAccount: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 400,
      },
    },
  });

  if (!product) {
    if (ENABLE_WORKSPACE_DEMO_DATA) {
      const demoProduct = productDetails.find((item) => item.id === productId);
      if (demoProduct) {
        return {
          period: resolvedPeriod,
          item: {
            ...cloneData(demoProduct),
            summary: cloneData(demoProduct.summaryByPeriod[resolvedPeriod]),
            evolution: cloneData(demoProduct.evolutionByPeriod[resolvedPeriod]),
          },
        };
      }
    }

    throw createHttpError(404, "Produto nao encontrado.");
  }

  const periodStart = startDateForPeriod(resolvedPeriod);
  const periodEnd = endDateForPeriod(resolvedPeriod);
  const rows = (product.orderItems || []).filter((orderItem) => {
    const saleDate = orderItem.order?.saleDate ? new Date(orderItem.order.saleDate) : null;
    return (
      saleDate &&
      saleDate.getTime() >= periodStart.getTime() &&
      saleDate.getTime() <= periodEnd.getTime()
    );
  });

  const summary = rows.reduce(
    (accumulator, row) => {
      const revenue = Number(row.totalPrice || row.unitPrice * row.quantity || 0);
      const profit = Number(row.profit || 0);
      const extraCost = Number(row.extraCost || 0);

      return {
        revenue: accumulator.revenue + revenue,
        profit: accumulator.profit + profit,
        feeAmount: accumulator.feeAmount + extraCost,
        sales: accumulator.sales + Number(row.quantity || 0),
      };
    },
    {
      revenue: 0,
      profit: 0,
      feeAmount: 0,
      sales: 0,
    }
  );

  summary.marginPercent = summary.revenue
    ? roundAmount((summary.profit / summary.revenue) * 100)
    : 0;

  const groupedEvolution = rows.reduce((accumulator, row) => {
    const saleDate = row.order?.saleDate ? new Date(row.order.saleDate) : new Date();
    const key =
      shouldAggregatePeriodByMonth(resolvedPeriod)
        ? `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, "0")}`
        : formatEvolutionLabel(saleDate, resolvedPeriod);
    const current = accumulator.get(key) || {
      id: key,
      label: formatEvolutionLabel(saleDate, resolvedPeriod),
      revenue: 0,
      profit: 0,
      orders: 0,
      timestamp: saleDate.getTime(),
    };

    current.revenue += Number(row.totalPrice || row.unitPrice * row.quantity || 0);
    current.profit += Number(row.profit || 0);
    current.orders += Number(row.quantity || 0);
    accumulator.set(key, current);
    return accumulator;
  }, new Map());

  const evolution = Array.from(groupedEvolution.values())
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((item) => ({
      label: item.label,
      revenue: roundAmount(item.revenue),
      profit: roundAmount(item.profit),
      orders: item.orders,
    }));

  const channelMixMap = rows.reduce((accumulator, row) => {
    const marketplace = row.order?.marketplaceAccount?.marketplace || "Marketplace";
    const current = accumulator.get(marketplace) || {
      id: `channel-${accumulator.size + 1}`,
      marketplace,
      revenue: 0,
      profit: 0,
    };

    current.revenue += Number(row.totalPrice || row.unitPrice * row.quantity || 0);
    current.profit += Number(row.profit || 0);
    accumulator.set(marketplace, current);
    return accumulator;
  }, new Map());

  const channelMix = Array.from(channelMixMap.values()).map((channel) => ({
    ...channel,
    revenue: roundAmount(channel.revenue),
    profit: roundAmount(channel.profit),
    marginPercent: channel.revenue
      ? roundAmount((channel.profit / channel.revenue) * 100)
      : 0,
  }));

  const productCostTotal = rows.reduce(
    (sum, row) => sum + Number(row.unitCost || 0) * Number(row.quantity || 0),
    0
  );
  const extraCostTotal = rows.reduce((sum, row) => sum + Number(row.extraCost || 0), 0);
  const estimatedTaxTotal = rows.reduce((sum, row) => {
    const revenue = Number(row.totalPrice || row.unitPrice * row.quantity || 0);
    return sum + revenue * (Number(row.taxPercent || 0) / 100);
  }, 0);

  const feeBreakdown = [
    {
      id: "fee-product-cost",
      label: "Custo dos itens",
      amount: roundAmount(productCostTotal),
    },
    {
      id: "fee-extra-cost",
      label: "Custos extras",
      amount: roundAmount(extraCostTotal),
    },
    {
      id: "fee-tax",
      label: "Tributos estimados",
      amount: roundAmount(estimatedTaxTotal),
    },
  ];

  const recentSales = rows
    .slice()
    .sort((left, right) => {
      const leftTime = left.order?.saleDate ? new Date(left.order.saleDate).getTime() : 0;
      const rightTime = right.order?.saleDate ? new Date(right.order.saleDate).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      orderId: row.order?.marketplaceOrderId || row.order?.id || "Pedido",
      marketplace: row.order?.marketplaceAccount?.marketplace || "Marketplace",
      soldAt: row.order?.saleDate || row.createdAt,
      revenue: roundAmount(Number(row.totalPrice || row.unitPrice * row.quantity || 0)),
      profit: roundAmount(Number(row.profit || 0)),
    }));

  const recommendations = [];

  if (summary.marginPercent < 8) {
    recommendations.push(
      "Revise preco, taxa e custo unitario para recuperar margem minima do SKU."
    );
  }

  if (rows.length < 3) {
    recommendations.push("Volume baixo no recorte atual. Vale revisar distribuicao por canal.");
  }

  if (!recommendations.length) {
    recommendations.push(
      "SKU com desempenho estavel no periodo. Mantenha monitoramento de taxa e conversao."
    );
  }

  const status = rows.length ? "Ativo" : "Pausado";

  return {
    period: resolvedPeriod,
    item: {
      id: product.id,
      name: product.title,
      category: product.category || "Sem categoria",
      sku: product.sku || "N/A",
      status,
      healthLabel: classifyProductHealth(summary.marginPercent),
      summary: {
        revenue: roundAmount(summary.revenue),
        profit: roundAmount(summary.profit),
        marginPercent: roundAmount(summary.marginPercent),
        feeAmount: roundAmount(summary.feeAmount),
        sales: summary.sales,
      },
      evolution,
      channelMix,
      feeBreakdown,
      recentSales,
      recommendations,
    },
  };
}

module.exports = {
  getProductDetail,
};
