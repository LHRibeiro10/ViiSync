const { buildAssistantContext, formatCurrency, formatPercent } = require("../assistant/assistantContext.service");
const { resolvePeriod } = require("../../services/analyticsDb.service");

const ACTION_MAP = {
  "profit-drop": {
    label: "Abrir relatorios",
    path: "/relatorios",
    category: "financeiro",
  },
  "pending-orders": {
    label: "Revisar pedidos",
    path: "/pedidos",
    category: "operacao",
  },
  "margin-pressure": {
    label: "Analisar produtos",
    path: "/produtos",
    category: "catalogo",
  },
  "shipping-pressure": {
    label: "Detalhar custos",
    path: "/relatorios",
    category: "financeiro",
  },
  "paused-products": {
    label: "Reativar catalogo",
    path: "/produtos",
    category: "catalogo",
  },
  "account-sync": {
    label: "Revisar contas",
    path: "/contas",
    category: "integracoes",
  },
};

function labelForPeriod(period) {
  if (period === "7d") {
    return "7 dias";
  }

  if (period === "90d") {
    return "90 dias";
  }

  return "30 dias";
}

function getSeverityLabel(severity) {
  return severity === "warning" ? "Atenção" : "Monitoramento";
}

function getSeverityTone(severity) {
  return severity === "warning" ? "warning" : "info";
}

function buildMetric(alertId, context) {
  switch (alertId) {
    case "profit-drop":
      return {
        label: "Variacao do lucro",
        value: `${formatPercent(
          Math.abs(context.monthlyComparison.profitDeltaPercent)
        )} de queda`,
      };
    case "pending-orders":
      return {
        label: "Fila pendente",
        value: `${context.orders.pending} pedido(s)`,
      };
    case "margin-pressure":
      return {
        label: "Produto critico",
        value: context.products.lowestMarginProducts[0]
          ? `${context.products.lowestMarginProducts[0].name} · ${formatPercent(
              context.products.lowestMarginProducts[0].margin
            )}`
          : "Sem dado",
      };
    case "shipping-pressure":
      return {
        label: "Peso do frete",
        value: `${formatPercent(context.costPressure.shippingSharePercent)} da receita`,
      };
    case "paused-products":
      return {
        label: "Itens pausados",
        value: `${context.products.pausedCount} produto(s)`,
      };
    case "account-sync":
      return {
        label: "Contas pendentes",
        value: `${context.accounts.pendingCount} conta(s)`,
      };
    default:
      return {
        label: "Receita",
        value: formatCurrency(context.summary.revenue),
      };
  }
}

function buildRecommendation(alertId, context) {
  switch (alertId) {
    case "profit-drop":
      return "Revise margem dos itens lideres, compare taxas do canal e cheque se houve aumento recente de custo ou desconto.";
    case "pending-orders":
      return "Ataque a fila pendente primeiro e valide se ha concentracao de atraso em um canal ou SKU especifico.";
    case "margin-pressure":
      return "Reavalie preco, custo e taxa do produto com pior margem antes de ampliar investimento nesse item.";
    case "shipping-pressure":
      return "Cheque faixa de frete, possibilidade de bundle e produtos com envio pesado acima da media.";
    case "paused-products":
      return "Revise se os itens pausados fazem sentido para reativacao ou se devem sair do mix de vez.";
    case "account-sync":
      return "Confirme se as contas conectadas estao saudaveis para evitar quebra de visibilidade operacional.";
    default:
      return "Monitore esse ponto antes que o impacto chegue ao faturamento ou a experiencia do seller.";
  }
}

function buildAlertItem(alert, context) {
  const action = ACTION_MAP[alert.id] || {
    label: "Abrir painel",
    path: "/",
    category: "geral",
  };
  const metric = buildMetric(alert.id, context);

  return {
    id: alert.id,
    title: alert.title,
    description: alert.description,
    severity: alert.severity,
    severityLabel: getSeverityLabel(alert.severity),
    severityTone: getSeverityTone(alert.severity),
    category: action.category,
    metric,
    recommendation: buildRecommendation(alert.id, context),
    action,
  };
}

async function getAlerts(period = "30d", request = {}) {
  const resolvedPeriod = resolvePeriod(period);
  const context = await buildAssistantContext({
    period: resolvedPeriod,
    currentView: "/",
    request,
  });
  const items = context.alerts.map((alert) => buildAlertItem(alert, context));

  return {
    period: resolvedPeriod,
    generatedAt: context.generatedAt,
    summary: {
      total: items.length,
      warningCount: items.filter((item) => item.severity === "warning").length,
      infoCount: items.filter((item) => item.severity !== "warning").length,
      revenue: formatCurrency(context.summary.revenue),
      profit: formatCurrency(context.summary.profit),
      margin: formatPercent(context.summary.averageMargin),
    },
    digest: [
      {
        id: "digest-revenue",
        label: `Receita ${labelForPeriod(resolvedPeriod)}`,
        value: formatCurrency(context.summary.revenue),
        tone: "neutral",
      },
      {
        id: "digest-profit",
        label: `Lucro ${labelForPeriod(resolvedPeriod)}`,
        value: formatCurrency(context.summary.profit),
        tone: context.summary.profit > 0 ? "success" : "warning",
      },
      {
        id: "digest-margin",
        label: "Margem media",
        value: formatPercent(context.summary.averageMargin),
        tone: context.summary.averageMargin >= 25 ? "success" : "warning",
      },
      {
        id: "digest-sales",
        label: "Vendas no periodo",
        value: `${context.summary.sales}`,
        tone: "neutral",
      },
    ],
    insights: context.insights.slice(0, 3),
    quickActions: items.slice(0, 3).map((item) => ({
      id: `${item.id}-action`,
      title: item.title,
      description: item.recommendation,
      action: item.action,
    })),
    items,
  };
}

module.exports = {
  getAlerts,
};
