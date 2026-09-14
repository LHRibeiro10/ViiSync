const {
  formatCurrency,
  formatPercent,
  normalizeText,
} = require("../../assistantContext.service");
const { labelForPeriod } = require("../shared");
const { buildSummaryReply } = require("./insightReplies");

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

module.exports = {
  buildTopSellerReply,
  buildTopProfitProductReply,
  buildBestMarginReply,
  buildMarginReply,
  buildPausedProductsReply,
  buildReactivationReply,
  buildProductActionReply,
  buildPortfolioMixReply,
  buildAdditionIdeasReply,
};
