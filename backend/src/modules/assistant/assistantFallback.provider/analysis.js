const {
  detectIntent,
  detectRequestedPeriod,
  normalizeText,
} = require("../assistantContext.service");
const { hasAny } = require("./shared");

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
  analyzeMessage,
};
