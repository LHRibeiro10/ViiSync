const { formatPercent } = require("../../assistantContext.service");

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

module.exports = {
  buildPendingOrdersReply,
  buildDelayedOrdersReply,
  buildOrderProfitReply,
  buildOrderChannelMixReply,
};
