const {
  buildReplyDecorations,
  detectIntent,
  detectRequestedPeriod,
  formatCurrency,
  formatPercent,
  normalizeText,
} = require("./assistantContext.service");

function createFallbackResponse({ userMessage, context, conversationHistory = [] }) {
  const analysis = analyzeMessage(userMessage, context, conversationHistory);
  const reply = buildReplyByAnalysis(analysis, context);
  const decorations = buildReplyDecorations(userMessage, context);

  return {
    content: reply,
    meta: {
      ...decorations,
      provider: "mocked-context",
      usedFallback: false,
    },
    providerState: {},
  };
}

function analyzeMessage(message, context, conversationHistory = []) {
  const normalizedMessage = normalizeText(message);
  const baseSignals = extractSignals(message, normalizedMessage, context);
  const previousUserMessage = getPreviousUserMessage(conversationHistory, message);
  const previousSignals = previousUserMessage
    ? extractSignals(previousUserMessage, normalizeText(previousUserMessage), context)
    : null;

  const analysis = {
    message,
    normalizedMessage,
    ...baseSignals,
    previousUserMessage,
    isFollowUp:
      previousSignals &&
      (normalizedMessage.startsWith("e ") ||
        normalizedMessage.startsWith("e,") ||
        normalizedMessage.startsWith("e no") ||
        normalizedMessage.startsWith("e na") ||
        normalizedMessage.startsWith("e o") ||
        normalizedMessage.startsWith("e a") ||
        normalizedMessage.startsWith("e quais") ||
        normalizedMessage.startsWith("e qual") ||
        normalizedMessage.startsWith("e como") ||
        normalizedMessage.startsWith("entao ") ||
        normalizedMessage.length <= 26),
  };

  if (analysis.isFollowUp && previousSignals) {
    applyFollowUpContext(analysis, previousSignals);
  }

  if (!hasTopicSignal(analysis) && isOutOfScopeMessage(normalizedMessage)) {
    analysis.isOutOfScope = true;
  }

  return analysis;
}

function extractSignals(message, normalizedMessage, context) {
  return {
    intent: detectIntent(message),
    period: detectRequestedPeriod(message, context.period),
    asksTopSeller: hasAny(normalizedMessage, [
      "vendeu mais",
      "mais vendido",
      "mais faturou",
      "produto lider",
      "top produto",
      "item mais vendeu",
      "item vendeu mais",
      "performando melhor",
      "melhor desempenho",
    ]),
    asksTopProfitProduct:
      hasAny(normalizedMessage, ["produto", "produtos", "sku", "skus", "item"]) &&
      hasAny(normalizedMessage, [
        "mais lucro",
        "mais lucrativo",
        "mais rentavel",
        "da mais lucro",
        "gera mais lucro",
      ]),
    asksBestMargin: hasAny(normalizedMessage, [
      "melhor margem",
      "maior margem",
      "margem mais alta",
      "margem mais forte",
    ]),
    asksWorstMargin: hasAny(normalizedMessage, [
      "pior margem",
      "menor margem",
      "margem mais baixa",
      "margem mais fraca",
    ]),
    asksMarginStatus: hasAny(normalizedMessage, [
      "margem",
      "margens",
      "lucro",
      "lucros",
      "rentabilidade",
      "resultado",
      "resultado financeiro",
    ]),
    asksPausedProducts: hasAny(normalizedMessage, [
      "pausado",
      "pausados",
      "produto parado",
      "produtos parados",
    ]),
    asksReactivation: hasAny(normalizedMessage, [
      "reativar",
      "reativacao",
      "devo reativar",
      "produto devo reativar",
      "voltar produto",
      "trazer de volta",
    ]),
    asksAddProduct: hasAny(normalizedMessage, [
      "adicionar produto",
      "adicionar um produto",
      "deveria adicionar",
      "qual eu deveria adicionar",
      "produto novo",
      "novo produto",
      "produto diferente",
      "que produto diferente",
      "que produto novo",
      "o que adicionar",
      "o que incluir",
      "o que trazer",
      "trazer para o catalogo",
      "produto faz sentido adicionar",
    ]),
    asksRemoveProduct: hasAny(normalizedMessage, [
      "remover produto",
      "remover do catalogo",
      "tirar produto",
      "descontinuar produto",
      "descontinuar",
      "sair do catalogo",
      "deveria remover",
      "cortar produto",
      "qual produto remover",
      "qual produto tirar",
    ]),
    asksPendingOrders: hasAny(normalizedMessage, [
      "pedido pendente",
      "pedidos pendentes",
      "pedidos precisam",
      "pedidos com problema",
      "gargalo operacional",
      "atraso operacional",
      "pedidos atrasados",
      "pedidos precisam de atencao",
    ]),
    asksDelayedOrders:
      hasAny(normalizedMessage, ["pedido", "pedidos"]) &&
      hasAny(normalizedMessage, [
        "atrasado",
        "atrasados",
        "em atraso",
        "atraso operacional",
      ]),
    asksOrderProfit:
      hasAny(normalizedMessage, ["pedido", "pedidos"]) &&
      hasAny(normalizedMessage, ["lucro", "lucrativo", "rentavel", "rentável"]) &&
      hasAny(normalizedMessage, [
        "mais",
        "maior",
        "gerou",
        "deu",
      ]),
    asksPriceCostAdjust: hasAny(normalizedMessage, [
      "ajustar preco",
      "ajustar custo",
      "preco ou custo",
      "merece revisao",
      "sku mais merece revisao",
      "rever preco",
      "rever custo",
      "ajuste de margem",
    ]),
    asksIncreaseProfit: hasAny(normalizedMessage, [
      "aumentar lucro",
      "melhorar lucro",
      "aumentar margem",
      "melhorar margem",
      "o que fazer",
      "sugestoes",
      "sugestoes para aumentar lucro",
    ]),
    asksWeeklySummary: hasAny(normalizedMessage, [
      "resuma",
      "resumo",
      "desempenho",
      "semana",
      "semanal",
      "trimestre",
      "90 dias",
      "30 dias",
    ]),
    asksAnomaly: hasAny(normalizedMessage, [
      "fora do normal",
      "anomalia",
      "anormal",
      "atipico",
      "atipica",
    ]),
    asksExpenses: hasAny(normalizedMessage, [
      "gasto",
      "gastos",
      "gastando",
      "despesa",
      "despesas",
      "frete",
      "taxa",
      "taxas",
      "custo",
      "custos",
    ]),
    asksChannels: hasAny(normalizedMessage, [
      "canal",
      "canais",
      "marketplace",
      "marketplaces",
      "mercado livre",
      "shopee",
    ]),
    asksConnectedAccounts: hasAny(normalizedMessage, [
      "quais contas estao conectadas",
      "quais estao conectadas",
      "contas estao conectadas",
      "contas conectadas",
      "quais contas conectadas",
    ]),
    asksAccountStatus: hasAny(normalizedMessage, [
      "qual conta esta com problema",
      "conta esta com problema",
      "conta com problema",
      "contas com problema",
      "conta pendente",
      "conta esta pendente",
      "pendente de sincronizacao",
      "sincronizacao",
      "sincronizar",
      "conta conectada",
      "contas conectadas",
      "estao conectadas",
      "estao conectados",
    ]),
    asksOrderChannelMix:
      hasAny(normalizedMessage, ["pedido", "pedidos"]) &&
      hasAny(normalizedMessage, ["canal", "marketplace"]),
    asksAlerts: hasAny(normalizedMessage, [
      "alerta",
      "alertas",
      "risco",
      "riscos",
      "principais riscos",
      "principais alertas",
      "pontos de atencao",
    ]),
    asksForecast: hasAny(normalizedMessage, [
      "previsao",
      "proximo mes",
      "projecao",
      "forecast",
    ]),
    asksProfitDrop: hasAny(normalizedMessage, [
      "queda de lucro",
      "lucro caiu",
      "tive queda de lucro",
      "lucro esta caindo",
    ]),
    asksSalesDrop: hasAny(normalizedMessage, [
      "queda de vendas",
      "vendas cairam",
      "tive queda de vendas",
      "queda de receita",
      "receita caiu",
    ]),
    asksInventory: hasAny(normalizedMessage, [
      "estoque",
      "ruptura",
      "ruptura de estoque",
      "estoque baixo",
    ]),
    asksCampaignAdvice: hasAny(normalizedMessage, [
      "campanha",
      "promocao",
      "promoção",
      "black friday",
      "oferta",
      "anuncio",
      "anúncio",
    ]),
    asksSecurity: hasAny(normalizedMessage, [
      "senha",
      "2fa",
      "dois fatores",
      "seguranca",
      "segurança",
      "acesso",
      "login",
    ]),
    asksAttentionToday: hasAny(normalizedMessage, [
      "atencao hoje",
      "precisa da minha atencao",
      "prioridade",
      "prioridades",
      "o que precisa da minha atencao",
      "o que merece atencao",
    ]),
    asksSummary:
      hasAny(normalizedMessage, [
        "como esta",
        "como estao",
        "visao geral",
        "panorama",
        "panorama geral",
      ]) || normalizedMessage.length < 24,
    isOutOfScope: false,
    requestedChannel: getRequestedChannel(normalizedMessage, context),
  };
}

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

function buildTopSellerReply(analysis, context) {
  const topRevenueProduct = context.products.topRevenueProducts[0];
  const topProfitProduct = context.products.topProfitProducts[0];
  const worstMarginProduct = context.products.lowestMarginProducts[0];
  const periodSnapshot = context.periodSnapshots[analysis.period] || context.periodSnapshots["30d"];

  return [
    `No recorte de ${labelForPeriod(analysis.period)}, ${topRevenueProduct?.name ?? "o produto lider"} e o item de maior faturamento, com ${topRevenueProduct?.revenue ?? "receita nao disponivel"}.`,
    topProfitProduct
      ? `Em lucro, o destaque continua sendo ${topProfitProduct.name}, com ${topProfitProduct.profit}.`
      : "Nao encontrei um produto lider de lucro nesse recorte.",
    worstMarginProduct
      ? `O SKU que mais merece monitoramento e ${worstMarginProduct.name}, porque ele tambem aparece como a menor margem do mix em ${formatPercent(
          worstMarginProduct.margin
        )}.`
      : "Nao encontrei pressao relevante de margem no mix.",
    `Minha leitura: o negocio esta girando com ${formatCurrency(
      periodSnapshot.revenue
    )} de receita e ${formatCurrency(periodSnapshot.profit)} de lucro nesse periodo, entao faz sentido proteger o produto lider e corrigir o SKU de menor eficiencia antes de escalar volume.`,
  ].join("\n\n");
}

function buildTopProfitProductReply(context) {
  const topProfitProduct = context.products.topProfitProducts[0];
  const topRevenueProduct = context.products.topRevenueProducts[0];

  if (!topProfitProduct) {
    return buildSummaryReply({ period: "30d" }, context);
  }

  return [
    `${topProfitProduct.name} e hoje o produto que mais gera lucro no mock, com ${topProfitProduct.profit}.`,
    topRevenueProduct && topRevenueProduct.name !== topProfitProduct.name
      ? `${topRevenueProduct.name} lidera faturamento, entao vale separar claramente volume de rentabilidade na sua leitura.`
      : `${topProfitProduct.name} tambem puxa o faturamento, o que reforca que ele merece protecao de estoque, preco e destaque comercial.`,
    "Minha recomendacao: usar esse SKU como referencia de mix e campanha, enquanto voce corrige os itens que vendem bem mas devolvem menos margem.",
  ].join("\n\n");
}

function buildBestMarginReply(context) {
  const bestMarginProduct = context.products.highestMarginProduct;
  const worstMarginProduct = context.products.lowestMarginProducts[0];

  if (!bestMarginProduct) {
    return buildSummaryReply({ period: "30d" }, context);
  }

  return [
    `${bestMarginProduct.name} e hoje o produto com melhor margem no mock, em ${formatPercent(
      bestMarginProduct.margin
    )}.`,
    worstMarginProduct
      ? `${worstMarginProduct.name} fica no lado oposto, com ${formatPercent(
          worstMarginProduct.margin
        )}.`
      : "Nao encontrei um SKU claramente pressionado no outro extremo do mix.",
    "Minha leitura: esse contraste te da um benchmark claro para revisar preco, frete subsidiado e custo dos produtos menos eficientes.",
  ].join("\n\n");
}

function buildMarginReply(analysis, context) {
  const bestMarginProduct = context.products.highestMarginProduct;
  const worstMarginProduct = context.products.lowestMarginProducts[0];
  const periodSnapshot = context.periodSnapshots[analysis.period] || context.periodSnapshots["30d"];

  return [
    `No recorte de ${labelForPeriod(analysis.period)}, sua operacao esta com ${formatCurrency(
      periodSnapshot.profit
    )} de lucro sobre ${formatCurrency(
      periodSnapshot.revenue
    )} de receita. A margem media consolidada segue em ${formatPercent(
      context.summary.averageMargin
    )} e a margem liquida estimada em ${formatPercent(
      context.costPressure.netMarginPercent
    )}.`,
    bestMarginProduct
      ? `${bestMarginProduct.name} e hoje seu melhor exemplo de eficiencia, com ${formatPercent(
          bestMarginProduct.margin
        )} de margem.`
      : "Nao encontrei produto com destaque claro de margem positiva.",
    worstMarginProduct
      ? `${worstMarginProduct.name} e o principal ponto de pressao, rodando em ${formatPercent(
          worstMarginProduct.margin
        )}.`
      : "Nao identifiquei produto com margem critica.",
    "Minha recomendacao pratica: rever custo ou preco do pior SKU, limitar subsidio de frete onde a margem esta curta e usar o item mais rentavel como referencia de eficiencia do catalogo.",
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

function buildPendingOrdersReply(context) {
  const pendingOrders = context.orders.pending;
  const recentOrders = context.orders.recentOrders || [];

  return [
    `Hoje o mock registra ${context.orders.total} pedido(s): ${pendingOrders} pendente(s), ${context.orders.shipped} enviado(s) e ${context.orders.delivered} entregue(s).`,
    `A fila pendente representa ${formatPercent(
      context.orders.pendingRate
    )} dos pedidos recentes, o que ${context.orders.pendingRate >= 25 ? "merece tratamento prioritario" : "ainda esta em zona controlada"}.`,
    recentOrders.length
      ? `Os pedidos mais recentes continuam puxados por ${recentOrders
          .map((order) => `${order.product} em ${order.marketplace}`)
          .join(", ")}.`
      : "Nao ha pedidos recentes suficientes para detalhar o mix.",
    pendingOrders > 0
      ? "Minha recomendacao imediata e atacar a fila pendente primeiro e, em paralelo, revisar se existe concentracao de atraso em algum canal."
      : "Como nao ha atraso relevante, o foco pode migrar para margem, mix e canais.",
  ].join("\n\n");
}

function buildDelayedOrdersReply(context) {
  const delayedOrders = context.orders.pendingOrders || [];

  if (!delayedOrders.length) {
    return [
      "No mock atual, nao existe pedido em atraso ou pendente.",
      "Isso significa que o foco pode sair de SLA e migrar para margem, mix e rentabilidade por canal.",
    ].join("\n\n");
  }

  return [
    `Hoje o mock mostra ${delayedOrders.length} pedido(s) em atraso ou pendente.`,
    `O principal pedido em aberto e ${delayedOrders[0].product} em ${delayedOrders[0].marketplace}, no valor de ${delayedOrders[0].value}.`,
    `Como ${formatPercent(context.orders.pendingRate)} da fila recente ainda esta pendente, eu trataria esse atraso como prioridade operacional imediata.`,
  ].join("\n\n");
}

function buildOrderProfitReply(context) {
  const highestValueOrder = context.orders.highestValueOrder;
  const topProfitProduct = context.products.topProfitProducts[0];

  return [
    "Com os dados mockados atuais, eu nao tenho lucro por pedido individual. O mock so me permite ler lucro por produto e valor bruto por pedido.",
    highestValueOrder
      ? `Se eu usar valor bruto como aproximacao operacional, o pedido de maior valor no mock e ${highestValueOrder.product} em ${highestValueOrder.marketplace}, com ${highestValueOrder.value}.`
      : "Nao encontrei um pedido com valor suficiente para usar como referencia operacional.",
    topProfitProduct
      ? `Em lucro por produto, o lider continua sendo ${topProfitProduct.name}, com ${topProfitProduct.profit}.`
      : "Tambem nao encontrei um produto lider de lucro no recorte atual.",
  ].join("\n\n");
}

function buildOrderChannelMixReply(context) {
  const channelCounts = context.orders.byMarketplace || [];
  const topChannel = channelCounts[0];
  const secondChannel = channelCounts[1];

  if (!topChannel) {
    return buildPendingOrdersReply(context);
  }

  const isTied = secondChannel && secondChannel.count === topChannel.count;

  return [
    isTied
      ? `No mock atual, nao existe um canal dominante em pedidos: ${topChannel.marketplace} e ${secondChannel.marketplace} estao empatados com ${topChannel.count} pedido(s) cada.`
      : `${topChannel.marketplace} concentra o maior volume de pedidos recentes, com ${topChannel.count} pedido(s).`,
    `A fila total segue com ${context.orders.pending} pedido(s) pendente(s), entao o melhor recorte de operacao e cruzar volume por canal com nivel de atraso.`,
    "Minha leitura: mesmo quando o volume esta equilibrado entre canais, o ponto de atencao continua sendo SLA e fila pendente, nao apenas contagem bruta de pedidos.",
  ].join("\n\n");
}

function buildPausedProductsReply(context) {
  if (!context.products.pausedProducts.length) {
    return [
      "No mock atual, nao existe produto pausado no catalogo.",
      "Isso significa que seu gargalo principal nao esta em disponibilidade de SKU, e sim em margem, custo logistico ou priorizacao comercial.",
    ].join("\n\n");
  }

  return [
    `Voce tem ${context.products.pausedProducts.length} produto(s) pausado(s): ${context.products.pausedProducts
      .map((product) => `${product.name} (${product.sku})`)
      .join(", ")}.`,
    "Antes de reativar, eu validaria tres coisas: margem atual, competitividade de preco e capacidade de entrega.",
    "Se o produto estiver pausado por margem curta, reativar sem ajuste tende a aumentar volume sem melhorar resultado.",
  ].join("\n\n");
}

function buildReactivationReply(context) {
  const pausedProduct = context.products.pausedProducts[0];
  const bestMarginProduct = context.products.highestMarginProduct;

  if (!pausedProduct) {
    return [
      "No mock atual, nao existe produto pausado com candidato claro para reativacao.",
      "Nesse cenario, eu priorizaria margem, fila operacional e canais antes de buscar ganho via reativacao de catalogo.",
    ].join("\n\n");
  }

  const pausedIsTopMargin =
    bestMarginProduct &&
    normalizeText(bestMarginProduct.name) === normalizeText(pausedProduct.name);

  return [
    `${pausedProduct.name} e o principal candidato a reativacao no mock atual, porque esta pausado e merece revisao comercial imediata.`,
    pausedIsTopMargin
      ? `Ele tambem aparece como o melhor exemplo de margem do mix, em ${formatPercent(
          bestMarginProduct.margin
        )}, o que reforca a tese de reavaliar essa pausa.`
      : "Antes de reativar, eu validaria margem, motivo da pausa e capacidade de entrega para nao reabrir um SKU com risco operacional.",
    "Minha recomendacao: so reativar depois de confirmar estoque, preco e condicao comercial, para a retomada vir com resultado e nao apenas com volume.",
  ].join("\n\n");
}

function buildProductActionReply(context) {
  const worstMarginProduct = context.products.lowestMarginProducts[0];
  const bestMarginProduct = context.products.highestMarginProduct;
  const pausedProduct = context.products.pausedProducts[0];

  return [
    worstMarginProduct
      ? `O SKU que eu revisaria primeiro e ${worstMarginProduct.name}, porque hoje ele combina relevancia comercial com a menor margem do mix em ${formatPercent(
          worstMarginProduct.margin
        )}.`
      : "Nao encontrei SKU critico para revisao imediata.",
    bestMarginProduct
      ? `${bestMarginProduct.name} serve como referencia de eficiencia, com ${formatPercent(
          bestMarginProduct.margin
        )} de margem.`
      : "Nao encontrei um SKU-referencia claro para margem.",
    pausedProduct
      ? `${pausedProduct.name} esta pausado, entao vale confirmar se a pausa faz sentido por margem ou se existe oportunidade de reativacao com ajuste de preco.`
      : "Nao ha produto pausado relevante nesse recorte.",
    "Minha recomendacao objetiva: revisar preco e custo do pior SKU, comparar com o produto mais eficiente e decidir a proxima acao por margem, nao so por volume.",
  ].join("\n\n");
}

function buildPortfolioMixReply(analysis, context) {
  const weakestActiveProduct = context.products.rows.find((product) => {
    return normalizeText(product.status) === "ativo";
  });
  const removalCandidate = context.products.lowestMarginProducts[0] || weakestActiveProduct;
  const pausedHighMarginProduct = context.products.pausedProducts[0];
  const additions = context.products.portfolioIdeas?.additionCandidates || [];

  if (analysis.asksRemoveProduct && !analysis.asksAddProduct) {
    return [
      removalCandidate
        ? `Se eu tivesse que reduzir ou remover um item hoje, revisaria primeiro ${removalCandidate.name}, porque ele esta entre os produtos de menor margem do mix em ${formatPercent(
            removalCandidate.margin
          )}.`
        : "Nao encontrei um candidato claro para corte imediato no catalogo atual.",
      pausedHighMarginProduct
        ? `${pausedHighMarginProduct.name} nao seria meu primeiro corte, porque mesmo pausado ainda aparece como um SKU eficiente para reavaliacao.`
        : "Eu evitaria cortar produto so por volume baixo sem antes medir margem e funcao no mix.",
      "Minha regra pratica aqui e simples: remover item so faz sentido quando ele ocupa capital, consome operacao e nao entrega margem suficiente para justificar permanencia.",
    ].join("\n\n");
  }

  if (analysis.asksAddProduct && !analysis.asksRemoveProduct) {
    return buildAdditionIdeasReply(context);
  }

  return [
    removalCandidate
      ? `No lado de corte, eu revisaria ${removalCandidate.name} primeiro, porque ele pressiona margem e merece decisao de continuidade.`
      : "No lado de corte, eu nao encontrei um candidato unico e obvio para remover agora.",
    additions.length
      ? `No lado de expansao, eu testaria ${additions
          .slice(0, 3)
          .map((candidate) => candidate.name)
          .join(", ")}, porque esses itens conversam com o catalogo atual sem repetir o que voce ja vende.`
      : "No lado de expansao, eu faria primeiro uma revisao de categoria antes de sugerir novos itens.",
    "Minha leitura: o melhor movimento e podar o SKU que devolve menos margem e usar esse espaco para um item adjacente que aumente ticket e cross-sell.",
  ].join("\n\n");
}

function buildAdditionIdeasReply(context) {
  const additions = context.products.portfolioIdeas?.additionCandidates || [];

  if (!additions.length) {
    return [
      "No mock atual, eu nao encontrei uma sugestao forte de expansao sem repetir seu catalogo.",
      "Antes de adicionar produto novo, eu revisaria margem, canal e capacidade operacional para nao ampliar complexidade sem ganho real.",
    ].join("\n\n");
  }

  return [
    "Se a ideia for adicionar um produto diferente sem fugir do perfil atual, estas seriam minhas melhores apostas:",
    additions
      .slice(0, 3)
      .map((candidate, index) => `${index + 1}. ${candidate.name}: ${candidate.reason}`)
      .join("\n"),
    "Essas sugestoes fazem sentido porque expandem o mix em volta do setup atual e tendem a conversar melhor com bundle, ticket medio e cross-sell do que um salto aleatorio de categoria.",
  ].join("\n\n");
}

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

function buildChannelReply(analysis, context) {
  const requestedChannel = analysis.requestedChannel;
  const targetChannel = requestedChannel
    ? context.channels.rows.find((channel) => normalizeText(channel.name) === requestedChannel)
    : null;
  const wantsWeakest = hasAny(analysis.normalizedMessage, [
    "pior",
    "mais fraco",
    "fraco",
    "menor lucro",
    "menos lucro",
  ]);
  const wantsStrongest = hasAny(analysis.normalizedMessage, [
    "mais lucro",
    "mais rentavel",
    "melhor canal",
    "canal lider",
    "gera mais lucro",
  ]);

  if (targetChannel) {
    return [
      `${targetChannel.name} aparece com ${targetChannel.revenue} de receita e ${targetChannel.profit} de lucro no consolidado atual.`,
      `A margem estimada desse canal esta em ${formatPercent(
        targetChannel.marginPercent
      )}.`,
      "Minha leitura: vale comparar esse retorno com o canal lider antes de aumentar investimento, porque receita isolada nao garante eficiencia.",
    ].join("\n\n");
  }

  if (wantsWeakest && context.channels.weakestChannel) {
    return [
      `${context.channels.weakestChannel.name} e o canal mais fraco em retorno relativo neste mock, com ${context.channels.weakestChannel.profit} de lucro.`,
      context.channels.strongestChannel
        ? `O contraste fica mais claro quando comparado com ${context.channels.strongestChannel.name}, que lidera com ${context.channels.strongestChannel.profit}.`
        : "Nao encontrei comparativo forte com o canal lider.",
      "Minha prioridade aqui seria revisar custo comercial e frete desse canal antes de aumentar volume nele.",
    ].join("\n\n");
  }

  if (wantsStrongest && context.channels.strongestChannel) {
    return [
      `${context.channels.strongestChannel.name} e hoje o canal mais rentavel, com ${context.channels.strongestChannel.profit} de lucro consolidado.`,
      context.channels.weakestChannel
        ? `${context.channels.weakestChannel.name} fica atras em retorno relativo, entao o diferencial provavelmente esta em taxa, frete ou mix.`
        : "Nao identifiquei um canal claramente abaixo dos demais.",
      "Minha leitura: preservar o canal lider faz mais sentido do que redistribuir verba sem revisar a eficiencia dos outros canais.",
    ].join("\n\n");
  }

  return [
    context.channels.strongestChannel
      ? `${context.channels.strongestChannel.name} e hoje o canal mais rentavel, com ${context.channels.strongestChannel.profit} de lucro consolidado.`
      : "Nao encontrei canal dominante no recorte atual.",
    context.channels.weakestChannel
      ? `${context.channels.weakestChannel.name} e o canal mais fraco em retorno relativo neste mock.`
      : "Nao encontrei contraste forte entre canais.",
    `Voce tem ${context.accounts.connectedCount} conta(s) conectada(s) e ${context.accounts.pendingCount} pendente(s) de sincronizacao.`,
    "Minha prioridade seria preservar o canal lider, revisar custos do canal mais fraco e resolver sincronizacoes pendentes para nao operar com leitura incompleta.",
  ].join("\n\n");
}

function buildConnectedAccountsReply(context) {
  const connectedAccounts = context.accounts.connectedAccounts || [];

  if (!connectedAccounts.length) {
    return [
      "No mock atual, nao existe conta conectada disponivel para detalhamento.",
      "Antes de analisar desempenho por canal, eu priorizaria restabelecer as integracoes.",
    ].join("\n\n");
  }

  return [
    `Hoje voce tem ${connectedAccounts.length} conta(s) conectada(s): ${connectedAccounts
      .map((account) => `${account.name} em ${account.marketplace}`)
      .join(", ")}.`,
    context.accounts.pendingCount > 0
      ? `Ainda existe ${context.accounts.pendingCount} conta(s) com pendencia de sincronizacao, entao sua leitura por canal ainda merece cautela.`
      : "No mock atual, nao existe pendencia relevante de sincronizacao.",
    "Minha recomendacao: manter as contas lideres saudaveis e tratar qualquer pendencia antes de confiar plenamente nos comparativos por marketplace.",
  ].join("\n\n");
}

function buildAccountReply(context) {
  const pendingAccounts = context.accounts.pendingAccounts || [];

  if (!pendingAccounts.length) {
    return [
      `Todas as ${context.accounts.connectedCount} conta(s) do mock aparecem sincronizadas sem pendencia relevante.`,
      "Nesse cenario, sua prioridade pode sair de integracao e migrar para operacao, margem e mix.",
    ].join("\n\n");
  }

  return [
    `Hoje existe ${pendingAccounts.length} conta(s) com pendencia de sincronizacao.`,
    `A principal conta em aberto e ${pendingAccounts[0].name}, ligada ao canal ${pendingAccounts[0].marketplace}.`,
    `No consolidado, ${context.accounts.connectedCount} conta(s) ja estao conectada(s) e ${context.accounts.pendingCount} ainda exigem atencao.`,
    "Minha recomendacao: resolver a sincronizacao pendente antes de tomar decisao comercial mais agressiva, porque ela pode distorcer a leitura de pedidos e desempenho por canal.",
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

function buildInventoryReply(context) {
  const pausedProduct = context.products.pausedProducts[0];

  return [
    "No mock atual, eu nao tenho dados reais de estoque ou ruptura por SKU.",
    pausedProduct
      ? `${pausedProduct.name} esta pausado, mas isso nao prova estoque baixo. Pode ser decisao comercial, margem ou operacao.`
      : "Como nao existe telemetria de estoque neste dataset, eu evitaria concluir ruptura sem uma fonte dedicada.",
    "Se voce quiser, eu posso te orientar com base em margem e giro do mix, mas nao seria correto afirmar disponibilidade de estoque com os dados atuais.",
  ].join("\n\n");
}

function buildCampaignReply(context) {
  const topRevenueProduct = context.products.topRevenueProducts[0];
  const topProfitProduct = context.products.topProfitProducts[0];
  const strongestChannel = context.channels.strongestChannel;
  const worstMarginProduct = context.products.lowestMarginProducts[0];

  return [
    "Se a ideia for montar uma campanha comercial com os dados do mock atual, eu faria algo simples e orientado a margem.",
    topRevenueProduct && topProfitProduct
      ? `Usaria ${topRevenueProduct.name} como isca de volume e ${topProfitProduct.name} como referencia de rentabilidade para nao crescer faturamento devolvendo lucro.`
      : "Eu separaria o produto de volume do produto de margem antes de investir em promocao.",
    strongestChannel
      ? `Comecaria pelo canal ${strongestChannel.name}, que hoje concentra o melhor retorno.`
      : "Eu validaria primeiro qual canal esta devolvendo melhor lucro antes de escalar verba.",
    worstMarginProduct
      ? `Evitaria desconto agressivo em ${worstMarginProduct.name}, porque ele ja opera com margem pressionada.`
      : "Evitaria campanhas profundas em itens com margem curta.",
  ].join("\n\n");
}

function buildSecurityReply() {
  return [
    "Consigo te orientar de forma geral, mas o mock atual nao traz eventos reais de seguranca, acesso ou troca de senha.",
    "Como regra pratica, trocar senha, ativar 2FA e revisar acessos faz sentido sempre que houver compartilhamento de conta, senha antiga ou suspeita de acesso indevido.",
    "Se quiser, eu posso te passar um checklist curto de seguranca operacional para sellers dentro do ViiSync.",
  ].join("\n\n");
}

function buildOutOfScopeReply() {
  return [
    "Eu sou especializada no contexto do ViiSync: vendas, margem, pedidos, canais, despesas, produtos e operacao do seller.",
    "Essa pergunta foge do escopo dos dados mockados que estou usando agora.",
    "Se quiser, me pergunte algo como produto lider, margem, custo, risco operacional, contas conectadas ou sugestoes de mix.",
  ].join("\n\n");
}

function getPreviousUserMessage(conversationHistory, currentMessage) {
  const normalizedCurrentMessage = normalizeText(currentMessage);

  for (let index = conversationHistory.length - 2; index >= 0; index -= 1) {
    const message = conversationHistory[index];

    if (message?.role !== "user") {
      continue;
    }

    if (normalizeText(message.content) === normalizedCurrentMessage) {
      continue;
    }

    return message.content;
  }

  return "";
}

function hasTopicSignal(analysis) {
  return Boolean(
    analysis.asksTopSeller ||
      analysis.asksTopProfitProduct ||
      analysis.asksBestMargin ||
      analysis.asksWorstMargin ||
      analysis.asksMarginStatus ||
      analysis.asksPausedProducts ||
      analysis.asksReactivation ||
      analysis.asksAddProduct ||
      analysis.asksRemoveProduct ||
      analysis.asksOrderProfit ||
      analysis.asksDelayedOrders ||
      analysis.asksPendingOrders ||
      analysis.asksPriceCostAdjust ||
      analysis.asksIncreaseProfit ||
      analysis.asksWeeklySummary ||
      analysis.asksAnomaly ||
      analysis.asksExpenses ||
      analysis.asksChannels ||
      analysis.asksConnectedAccounts ||
      analysis.asksAccountStatus ||
      analysis.asksOrderChannelMix ||
      analysis.asksAlerts ||
      analysis.asksForecast ||
      analysis.asksProfitDrop ||
      analysis.asksSalesDrop ||
      analysis.asksInventory ||
      analysis.asksCampaignAdvice ||
      analysis.asksSecurity ||
      analysis.asksAttentionToday ||
      analysis.requestedChannel
  );
}

function applyFollowUpContext(analysis, previousSignals) {
  if (hasSpecificTopicSignal(analysis)) {
    if (analysis.normalizedMessage.includes("conectad")) {
      analysis.asksConnectedAccounts = true;
    }

    return analysis;
  }

  analysis.intent = previousSignals.intent;
  analysis.asksTopSeller = previousSignals.asksTopSeller;
  analysis.asksTopProfitProduct = previousSignals.asksTopProfitProduct;
  analysis.asksBestMargin = previousSignals.asksBestMargin;
  analysis.asksWorstMargin = previousSignals.asksWorstMargin;
  analysis.asksMarginStatus = previousSignals.asksMarginStatus;
  analysis.asksPausedProducts = previousSignals.asksPausedProducts;
  analysis.asksReactivation = previousSignals.asksReactivation;
  analysis.asksAddProduct = previousSignals.asksAddProduct;
  analysis.asksRemoveProduct = previousSignals.asksRemoveProduct;
  analysis.asksOrderProfit = previousSignals.asksOrderProfit;
  analysis.asksDelayedOrders = previousSignals.asksDelayedOrders;
  analysis.asksPendingOrders = previousSignals.asksPendingOrders;
  analysis.asksPriceCostAdjust = previousSignals.asksPriceCostAdjust;
  analysis.asksIncreaseProfit = previousSignals.asksIncreaseProfit;
  analysis.asksWeeklySummary = previousSignals.asksWeeklySummary;
  analysis.asksAnomaly = previousSignals.asksAnomaly;
  analysis.asksExpenses = previousSignals.asksExpenses;
  analysis.asksChannels = previousSignals.asksChannels;
  analysis.asksConnectedAccounts = previousSignals.asksConnectedAccounts;
  analysis.asksAccountStatus = previousSignals.asksAccountStatus;
  analysis.asksOrderChannelMix = previousSignals.asksOrderChannelMix;
  analysis.asksAlerts = previousSignals.asksAlerts;
  analysis.asksForecast = previousSignals.asksForecast;
  analysis.asksProfitDrop = previousSignals.asksProfitDrop;
  analysis.asksSalesDrop = previousSignals.asksSalesDrop;
  analysis.asksInventory = previousSignals.asksInventory;
  analysis.asksCampaignAdvice = previousSignals.asksCampaignAdvice;
  analysis.asksSecurity = previousSignals.asksSecurity;
  analysis.asksAttentionToday = previousSignals.asksAttentionToday;
  analysis.requestedChannel = previousSignals.requestedChannel;

  if (analysis.normalizedMessage.includes("conectad")) {
    analysis.asksConnectedAccounts = true;
    analysis.asksAccountStatus = false;
  }

  if (analysis.normalizedMessage.includes("melhor")) {
    analysis.asksChannels = previousSignals.asksChannels || previousSignals.intent === "channels";
  }

  if (analysis.normalizedMessage.includes("adicionar") || analysis.normalizedMessage.includes("incluir")) {
    analysis.asksAddProduct = true;
    analysis.asksRemoveProduct = false;
  }

  if (analysis.normalizedMessage.includes("remover") || analysis.normalizedMessage.includes("tirar")) {
    analysis.asksRemoveProduct = true;
    analysis.asksAddProduct = false;
  }

  return analysis;
}

function hasSpecificTopicSignal(analysis) {
  return Boolean(
    analysis.asksTopSeller ||
      analysis.asksTopProfitProduct ||
      analysis.asksBestMargin ||
      analysis.asksWorstMargin ||
      analysis.asksMarginStatus ||
      analysis.asksPausedProducts ||
      analysis.asksReactivation ||
      analysis.asksAddProduct ||
      analysis.asksRemoveProduct ||
      analysis.asksOrderProfit ||
      analysis.asksDelayedOrders ||
      analysis.asksPendingOrders ||
      analysis.asksPriceCostAdjust ||
      analysis.asksIncreaseProfit ||
      analysis.asksAnomaly ||
      analysis.asksExpenses ||
      analysis.asksChannels ||
      analysis.asksConnectedAccounts ||
      analysis.asksAccountStatus ||
      analysis.asksOrderChannelMix ||
      analysis.asksAlerts ||
      analysis.asksForecast ||
      analysis.asksProfitDrop ||
      analysis.asksSalesDrop ||
      analysis.asksInventory ||
      analysis.asksCampaignAdvice ||
      analysis.asksSecurity ||
      analysis.asksAttentionToday ||
      analysis.requestedChannel
  );
}

function isOutOfScopeMessage(normalizedMessage) {
  return hasAny(normalizedMessage, [
    "piada",
    "capital da franca",
    "capital da frança",
    "dolar",
    "cotacao",
    "cotação",
    "clima",
    "tempo hoje",
  ]);
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function labelForPeriod(period) {
  if (period === "7d") {
    return "7 dias";
  }

  if (period === "90d") {
    return "90 dias";
  }

  return "30 dias";
}

function getRequestedChannel(normalizedMessage, context) {
  const channels = context.channels.rows.map((channel) => ({
    normalized: normalizeText(channel.name),
  }));

  const matchedChannel = channels.find((channel) => {
    return normalizedMessage.includes(channel.normalized);
  });

  return matchedChannel ? matchedChannel.normalized : "";
}

module.exports = {
  createFallbackResponse,
};
