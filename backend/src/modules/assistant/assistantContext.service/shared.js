const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function parseCurrencyValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return 0;
  }

  if (text.includes(",")) {
    const normalized = text
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safePercent(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function calculateDeltaPercent(currentValue, previousValue) {
  if (!Number.isFinite(previousValue) || previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

function getViewLabel(currentView) {
  switch (currentView) {
    case "/pedidos":
      return "pagina de pedidos";
    case "/produtos":
      return "pagina de produtos";
    case "/contas":
      return "pagina de contas conectadas";
    case "/relatorios":
      return "pagina de relatorios";
    case "/configuracoes":
      return "pagina de configuracoes";
    default:
      return "dashboard";
  }
}

module.exports = {
  formatCurrency,
  formatPercent,
  normalizeText,
  parseCurrencyValue,
  safePercent,
  calculateDeltaPercent,
  getViewLabel,
};
