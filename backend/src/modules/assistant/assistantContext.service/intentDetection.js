const { normalizeText } = require("./shared");

function detectIntent(message) {
  const normalizedMessage = normalizeText(message);

  if (
    normalizedMessage.includes("canal") ||
    normalizedMessage.includes("canais") ||
    normalizedMessage.includes("marketplace") ||
    normalizedMessage.includes("marketplaces") ||
    normalizedMessage.includes("conta") ||
    normalizedMessage.includes("contas")
  ) {
    return "channels";
  }

  if (
    normalizedMessage.includes("pedido") ||
    normalizedMessage.includes("pedidos") ||
    normalizedMessage.includes("entrega") ||
    normalizedMessage.includes("pendente")
  ) {
    return "orders";
  }

  if (
    normalizedMessage.includes("gasto") ||
    normalizedMessage.includes("gastando") ||
    normalizedMessage.includes("despesa") ||
    normalizedMessage.includes("despesas") ||
    normalizedMessage.includes("frete") ||
    normalizedMessage.includes("taxa") ||
    normalizedMessage.includes("custo") ||
    normalizedMessage.includes("custos")
  ) {
    return "costs";
  }

  if (
    normalizedMessage.includes("produto") ||
    normalizedMessage.includes("produtos") ||
    normalizedMessage.includes("sku") ||
    normalizedMessage.includes("skus") ||
    normalizedMessage.includes("vendeu mais")
  ) {
    return "products";
  }

  if (
    normalizedMessage.includes("margem") ||
    normalizedMessage.includes("margens") ||
    normalizedMessage.includes("lucro") ||
    normalizedMessage.includes("lucros") ||
    normalizedMessage.includes("rentabilidade") ||
    normalizedMessage.includes("roi")
  ) {
    return "margins";
  }

  return "summary";
}

function detectRequestedPeriod(message, fallbackPeriod = "30d") {
  const normalizedMessage = normalizeText(message);

  if (
    normalizedMessage.includes("7 dias") ||
    normalizedMessage.includes("7d") ||
    normalizedMessage.includes("semana") ||
    normalizedMessage.includes("semanal") ||
    normalizedMessage.includes("hoje")
  ) {
    return "7d";
  }

  if (
    normalizedMessage.includes("90 dias") ||
    normalizedMessage.includes("90d") ||
    normalizedMessage.includes("trimestre") ||
    normalizedMessage.includes("trimestral")
  ) {
    return "90d";
  }

  if (
    normalizedMessage.includes("1 ano") ||
    normalizedMessage.includes("12 meses") ||
    normalizedMessage.includes("anual")
  ) {
    return "1y";
  }

  return fallbackPeriod;
}

module.exports = {
  detectIntent,
  detectRequestedPeriod,
};
