const { formatCurrency, formatPercent } = require("../../assistantContext.service");
const { labelForPeriod } = require("../shared");

function buildAlertsReply(context) {
  const alertList = context.alerts || [];

  if (!alertList.length) {
    return [
      "No mock atual, nao apareceu nenhum alerta relevante acima do ruido normal da operacao.",
      "Mesmo assim, eu continuaria monitorando margem, frete e sincronizacao de contas para evitar degradacao silenciosa.",
    ].join("\n\n");
  }

  const priorityOrder = [
    "pending-orders",
    "margin-pressure",
    "account-sync",
    "shipping-pressure",
    "profit-drop",
    "paused-products",
  ];

  const prioritizedAlerts = [...alertList].sort((left, right) => {
    return priorityOrder.indexOf(left.id) - priorityOrder.indexOf(right.id);
  });

  return [
    "Os principais alertas e riscos que eu vejo agora sao:",
    prioritizedAlerts
      .slice(0, 3)
      .map((alert, index) => `${index + 1}. ${alert.title}: ${alert.description}`)
      .join("\n"),
    "Minha leitura: a ordem de resposta deve seguir impacto operacional primeiro, depois erosao de margem e por ultimo confiabilidade dos dados.",
  ].join("\n\n");
}

function buildForecastReply(context) {
  const projectedRevenue = context.weeklySummary.revenue * 4.285;
  const projectedProfit = context.weeklySummary.profit * 4.285;

  return [
    "Ainda nao existe previsao estatistica real neste mock. O que eu consigo te dar agora e um run rate simples com base na ultima semana.",
    `Se o ritmo atual se repetir, o proximo mes tenderia a fechar perto de ${formatCurrency(
      projectedRevenue
    )} de receita e ${formatCurrency(projectedProfit)} de lucro.`,
    "Eu trataria isso como sinal de tendencia, nao como forecast fechado, porque o mock nao considera sazonalidade, campanhas, ruptura de estoque ou mudanca de canal.",
  ].join("\n\n");
}

function buildTrendReply(analysis, context) {
  const comparison = context.monthlyComparison;
  const previousMonthLabel = comparison.previousMonth?.month || "o mes anterior";

  if (analysis.asksProfitDrop) {
    const delta = comparison.profitDeltaPercent;

    return [
      delta < 0
        ? `Sim. No comparativo com ${previousMonthLabel}, o lucro caiu ${formatPercent(
            Math.abs(delta)
          )}.`
        : `Nao. No comparativo com ${previousMonthLabel}, o lucro subiu ${formatPercent(delta)}.`,
      `Hoje o consolidado mensal esta em ${context.summary.profit} de lucro sobre ${context.summary.revenue} de receita.`,
      delta < 0
        ? "Minha prioridade seria revisar imediatamente margem do pior SKU e custo comercial por canal para interromper a desaceleracao."
        : "O sinal atual e positivo, mas ainda vale proteger margem e fila operacional para nao devolver esse ganho.",
    ].join("\n\n");
  }

  const revenueDelta = comparison.revenueDeltaPercent;
  const ordersDelta = comparison.ordersDeltaPercent;

  return [
    revenueDelta < 0
      ? `Sim. No comparativo com ${previousMonthLabel}, a receita caiu ${formatPercent(
          Math.abs(revenueDelta)
        )}.`
      : `Nao. No comparativo com ${previousMonthLabel}, a receita subiu ${formatPercent(
          revenueDelta
        )}.`,
    `O volume de pedidos no mesmo intervalo ${ordersDelta < 0 ? "caiu" : "subiu"} ${formatPercent(
      Math.abs(ordersDelta)
    )}.`,
    revenueDelta < 0
      ? "Minha leitura: antes de acelerar investimento, vale entender se a queda veio de mix, ruptura, canal ou fila operacional."
      : "O ritmo atual nao sugere retracao de vendas, mas ainda vale acompanhar ticket, margem e participacao por canal.",
  ].join("\n\n");
}

function buildCostReply(context) {
  const highestShippingProduct = context.costPressure.highestShippingProduct;
  const highestFeeProduct = context.costPressure.highestFeeProduct;
  const strongestAlert = context.alerts.find((alert) => alert.id === "shipping-pressure");

  return [
    `Hoje o maior peso de custos esta dividido entre ${formatCurrency(
      context.costPressure.totalMarketplaceFee
    )} em taxas de marketplace e ${formatCurrency(
      context.costPressure.totalShippingPaid
    )} em frete.`,
    `As taxas consomem ${formatPercent(
      context.costPressure.feeSharePercent
    )} da receita bruta, enquanto o frete absorve ${formatPercent(
      context.costPressure.shippingSharePercent
    )}.`,
    highestShippingProduct
      ? `${highestShippingProduct.product} e o item com maior pressao de frete, somando ${formatCurrency(
          highestShippingProduct.shippingPaid
        )}.`
      : "Nao encontrei um item dominante em frete.",
    highestFeeProduct
      ? `${highestFeeProduct.product} concentra a maior taxa unitariamente, com ${formatCurrency(
          highestFeeProduct.marketplaceFee
        )}.`
      : "Nao encontrei concentracao relevante de taxa.",
    strongestAlert
      ? `Ponto fora do normal: ${strongestAlert.description}`
      : "Minha leitura pratica: frete e taxa estao mais sensiveis do que custo fixo neste mock, entao a maior alavanca de ganho esta em politica comercial e comissao por canal.",
  ].join("\n\n");
}

function buildIncreaseProfitReply(context) {
  const worstMarginProduct = context.products.lowestMarginProducts[0];
  const topRevenueProduct = context.products.topRevenueProducts[0];
  const highestShippingProduct = context.costPressure.highestShippingProduct;

  const actions = [
    worstMarginProduct
      ? `Rever preco ou custo de ${worstMarginProduct.name}, porque ele esta pressionando margem em ${formatPercent(
          worstMarginProduct.margin
        )}.`
      : "Revisar o SKU de pior margem para evitar ganho baixo em volume.",
    highestShippingProduct
      ? `Atacar frete de ${highestShippingProduct.product}, que hoje e o maior dreno logistico do recorte.`
      : "Revisar subsidio de frete nos itens de maior peso logistico.",
    context.orders.pending > 0
      ? `Reduzir a fila de ${context.orders.pending} pedido(s) pendente(s) para acelerar caixa e evitar friccao operacional.`
      : "Aproveitar a operacao estabilizada para concentrar energia em margem e mix.",
    topRevenueProduct
      ? `Preservar disponibilidade e destaque comercial de ${topRevenueProduct.name}, que ja lidera faturamento.`
      : "Proteger seu produto lider para nao perder receita facil.",
  ];

  return [
    "Se o objetivo for aumentar lucro com rapidez, eu priorizaria estas alavancas em vez de tentar mexer em tudo ao mesmo tempo:",
    `1. ${actions[0]}\n2. ${actions[1]}\n3. ${actions[2]}\n4. ${actions[3]}`,
    "Essa ordem faz sentido porque primeiro voce corrige erosao de margem, depois corta custo evitavel, depois destrava receita ja vendida e por ultimo reforca o SKU que mais puxa resultado.",
  ].join("\n\n");
}

function buildAttentionReply(context) {
  const priorities = [];
  const worstMarginProduct = context.products.lowestMarginProducts[0];
  const pendingAccount = context.accounts.pendingAccounts[0];

  if (context.orders.pending > 0) {
    priorities.push(
      `Atacar a fila de ${context.orders.pending} pedido(s) pendente(s), porque isso impacta operacao e caixa no curto prazo.`
    );
  }

  if (worstMarginProduct) {
    priorities.push(
      `Revisar ${worstMarginProduct.name}, que hoje opera como o SKU de margem mais pressionada em ${formatPercent(
        worstMarginProduct.margin
      )}.`
    );
  }

  if (pendingAccount) {
    priorities.push(
      `Resolver a sincronizacao de ${pendingAccount.name} para evitar leitura incompleta do canal ${pendingAccount.marketplace}.`
    );
  }

  if (context.costPressure.shippingSharePercent >= 5) {
    priorities.push(
      `Monitorar frete e taxa, porque juntos ja consomem uma fatia relevante da receita do periodo.`
    );
  }

  return [
    "Se eu fosse priorizar sua agenda agora, atacaria estes pontos primeiro:",
    priorities.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "A logica dessa ordem e simples: primeiro o que trava operacao, depois o que erode margem e por fim o que reduz confiabilidade dos dados.",
  ].join("\n\n");
}

function buildSummaryReply(analysis, context) {
  const periodSnapshot = context.periodSnapshots[analysis.period] || context.periodSnapshots["30d"];
  const alert = context.alerts[0];

  return [
    `No recorte de ${labelForPeriod(analysis.period)}, o ViiSync mostra ${formatCurrency(
      periodSnapshot.revenue
    )} de receita, ${formatCurrency(
      periodSnapshot.profit
    )} de lucro, ${periodSnapshot.sales} venda(s) e ticket medio de ${formatCurrency(
      periodSnapshot.averageTicket
    )}.`,
    `No consolidado atual, a margem media esta em ${formatPercent(
      context.summary.averageMargin
    )} e o ritmo semanal de receita esta ${
      context.weeklySummary.revenuePaceVsMonth >= 0 ? "acima" : "abaixo"
    } da media mensal em ${formatPercent(
      Math.abs(context.weeklySummary.revenuePaceVsMonth)
    )}.`,
    alert
      ? `Ponto de atencao: ${alert.description}`
      : "Nao apareceu nenhum alerta grave no recorte atual.",
    "Se quiser, eu posso detalhar esse panorama por produto, pedidos, despesas, canais ou contas conectadas.",
  ].join("\n\n");
}

module.exports = {
  buildAlertsReply,
  buildForecastReply,
  buildTrendReply,
  buildCostReply,
  buildIncreaseProfitReply,
  buildAttentionReply,
  buildSummaryReply,
};
