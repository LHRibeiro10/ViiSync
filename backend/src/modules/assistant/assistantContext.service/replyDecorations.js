const { getPeriodLabel } = require("../../../lib/period");
const { formatCurrency, formatPercent, normalizeText } = require("./shared");
const { detectIntent } = require("./intentDetection");

function buildReplyDecorations(message, context) {
  const intent = detectIntent(message);
  const suggestions = context.quickQuestions.filter((question) => {
    return normalizeText(question) !== normalizeText(message);
  });

  if (intent === "products") {
    return {
      tone: "positive",
      highlights: [
        {
          label: "Top faturamento",
          value: context.products.topRevenueProducts[0]
            ? `${context.products.topRevenueProducts[0].name} · ${context.products.topRevenueProducts[0].revenue}`
            : "Sem dados",
        },
        {
          label: "Top lucro",
          value: context.products.topProfitProducts[0]
            ? `${context.products.topProfitProducts[0].name} · ${context.products.topProfitProducts[0].profit}`
            : "Sem dados",
        },
        {
          label: "Pior margem",
          value: context.products.lowestMarginProducts[0]
            ? `${context.products.lowestMarginProducts[0].name} · ${formatPercent(
                context.products.lowestMarginProducts[0].margin
              )}`
            : "Sem dados",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  if (intent === "margins") {
    return {
      tone: context.summary.averageMargin >= 25 ? "positive" : "warning",
      highlights: [
        {
          label: "Margem media",
          value: formatPercent(context.summary.averageMargin),
        },
        {
          label: "Margem liquida",
          value: formatPercent(context.costPressure.netMarginPercent),
        },
        {
          label: "Produto critico",
          value: context.products.lowestMarginProducts[0]
            ? `${context.products.lowestMarginProducts[0].name} · ${formatPercent(
                context.products.lowestMarginProducts[0].margin
              )}`
            : "Sem dados",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  if (intent === "costs") {
    return {
      tone: context.costPressure.shippingSharePercent >= 7 ? "warning" : "neutral",
      highlights: [
        {
          label: "Taxas marketplace",
          value: formatCurrency(context.costPressure.totalMarketplaceFee),
        },
        {
          label: "Frete pago",
          value: formatCurrency(context.costPressure.totalShippingPaid),
        },
        {
          label: "Maior pressao",
          value: context.costPressure.highestShippingProduct
            ? `${context.costPressure.highestShippingProduct.product} · ${formatCurrency(
                context.costPressure.highestShippingProduct.shippingPaid
              )}`
            : "Sem dados",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  if (intent === "orders") {
    return {
      tone: context.orders.pendingRate >= 25 ? "warning" : "neutral",
      highlights: [
        {
          label: "Pendentes",
          value: `${context.orders.pending} pedido(s)`,
        },
        {
          label: "Enviados",
          value: `${context.orders.shipped} pedido(s)`,
        },
        {
          label: "Canal dominante",
          value: context.channels.strongestChannel
            ? context.channels.strongestChannel.name
            : "Sem dados",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  if (intent === "channels") {
    return {
      tone: "neutral",
      highlights: [
        {
          label: "Canal mais rentavel",
          value: context.channels.strongestChannel
            ? `${context.channels.strongestChannel.name} · ${context.channels.strongestChannel.profit}`
            : "Sem dados",
        },
        {
          label: "Contas conectadas",
          value: `${context.accounts.connectedCount}/${context.accounts.totalCount}`,
        },
        {
          label: "Conta pendente",
          value:
            context.accounts.pendingAccounts[0]?.name ??
            "Nenhuma conta pendente",
        },
      ],
      suggestions: suggestions.slice(0, 3),
    };
  }

  return {
    tone: context.alerts.some((alert) => alert.severity === "warning")
      ? "warning"
      : "positive",
    highlights: [
      {
        label: `Receita ${getPeriodLabel(context.period)}`,
        value: formatCurrency(context.summary.revenue),
      },
      {
        label: `Lucro ${getPeriodLabel(context.period)}`,
        value: formatCurrency(context.summary.profit),
      },
      {
        label: "Margem media",
        value: formatPercent(context.summary.averageMargin),
      },
    ],
    suggestions: suggestions.slice(0, 3),
  };
}

module.exports = {
  buildReplyDecorations,
};
