function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseCurrency(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "N/D";
  }

  return `${value.toFixed(1).replace(".", ",")}%`;
}

function getStatusTone(status) {
  const normalized = normalizeValue(status);

  if (normalized.includes("paus")) {
    return "is-warning";
  }

  if (normalized.includes("ativ")) {
    return "is-positive";
  }

  return "is-neutral";
}

function getMarginTone(marginValue) {
  if (!Number.isFinite(marginValue)) {
    return "is-neutral";
  }

  if (marginValue <= 0) {
    return "is-danger";
  }

  if (marginValue < 12) {
    return "is-warning";
  }

  return "is-positive";
}

function enrichProducts(products) {
  return products.map((product) => {
    const parsedCost = parseCurrency(product.cost);
    const parsedMargin = parsePercent(product.margin);
    const normalizedSku = normalizeValue(product.sku);
    const normalizedStatus = normalizeValue(product.status);
    const hasMissingCost = parsedCost === null || parsedCost <= 0;
    const hasMissingMargin = parsedMargin === null || parsedMargin <= 0;
    const hasZeroProfitSignal = Number.isFinite(parsedMargin) && parsedMargin <= 0;
    const hasIncompleteRegistration =
      normalizedSku.length === 0 || normalizedSku === "n/a";
    const hasLowPerformance =
      normalizedStatus.includes("paus") ||
      (Number.isFinite(parsedMargin) && parsedMargin > 0 && parsedMargin < 8);
    const needsAttention =
      hasMissingCost ||
      hasMissingMargin ||
      hasZeroProfitSignal ||
      hasIncompleteRegistration ||
      hasLowPerformance;

    return {
      ...product,
      parsedCost,
      parsedMargin,
      hasMissingCost,
      hasMissingMargin,
      hasZeroProfitSignal,
      hasIncompleteRegistration,
      hasLowPerformance,
      needsAttention,
    };
  });
}

function buildProductsContextCards(filteredProducts) {
  const productsWithoutCost = filteredProducts.filter((product) => product.hasMissingCost);
  const productsWithoutMargin = filteredProducts.filter((product) => product.hasMissingMargin);
  const productsWithAttention = filteredProducts.filter((product) => product.needsAttention);
  const bestMarginProduct = filteredProducts
    .filter((product) => Number.isFinite(product.parsedMargin) && product.parsedMargin > 0)
    .sort((left, right) => right.parsedMargin - left.parsedMargin)[0];

  return [
    {
      id: "registered",
      label: "Produtos cadastrados",
      value: String(filteredProducts.length),
      detail: "Itens no recorte atual da listagem.",
      tone: "is-neutral",
    },
    {
      id: "missing-cost",
      label: "Sem custo informado",
      value: String(productsWithoutCost.length),
      detail: "Nao entram com precisao em leitura de margem.",
      tone: productsWithoutCost.length ? "is-warning" : "is-positive",
    },
    {
      id: "missing-margin",
      label: "Sem margem calculada",
      value: String(productsWithoutMargin.length),
      detail: "Itens com margem indisponivel ou zerada.",
      tone: productsWithoutMargin.length ? "is-warning" : "is-positive",
    },
    bestMarginProduct
      ? {
          id: "best-margin",
          label: "Com melhor margem",
          value: bestMarginProduct.name,
          detail: `${formatPercent(bestMarginProduct.parsedMargin)} (${bestMarginProduct.sku}).`,
          tone: "is-positive",
        }
      : {
          id: "best-margin-empty",
          label: "Com melhor margem",
          value: "Sem base de margem",
          detail: "A margem aparecera quando houver dados consistentes.",
          tone: "is-placeholder",
        },
    {
      id: "attention",
      label: "Com atencao",
      value: String(productsWithAttention.length),
      detail: "Produtos com sinal operacional para revisao.",
      tone: productsWithAttention.length ? "is-warning" : "is-positive",
    },
  ];
}

function buildProductsAttentionGroups(filteredProducts) {
  const attentionGroups = [];

  const productsWithoutCost = filteredProducts.filter((product) => product.hasMissingCost);
  if (productsWithoutCost.length) {
    attentionGroups.push({
      id: "attention-missing-cost",
      title: `${productsWithoutCost.length} item(ns) sem custo cadastrado`,
      description:
        "Sem custo, a decisao de preco e margem pode ficar distorcida.",
      preview: productsWithoutCost.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-warning",
      productId: productsWithoutCost[0].id,
    });
  }

  const tightMarginProducts = filteredProducts.filter(
    (product) =>
      Number.isFinite(product.parsedMargin) &&
      product.parsedMargin > 0 &&
      product.parsedMargin < 12
  );
  if (tightMarginProducts.length) {
    attentionGroups.push({
      id: "attention-tight-margin",
      title: `${tightMarginProducts.length} item(ns) com margem apertada`,
      description:
        "Margem abaixo de 12% sugere revisar custo, tarifa e estrategia de preco.",
      preview: tightMarginProducts.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-warning",
      productId: tightMarginProducts[0].id,
    });
  }

  const zeroProfitProducts = filteredProducts.filter((product) => product.hasZeroProfitSignal);
  if (zeroProfitProducts.length) {
    attentionGroups.push({
      id: "attention-zero-profit",
      title: `${zeroProfitProducts.length} item(ns) com lucro zerado`,
      description:
        "Itens sem margem positiva merecem ajuste imediato para evitar erosao de caixa.",
      preview: zeroProfitProducts.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-danger",
      productId: zeroProfitProducts[0].id,
    });
  }

  const incompleteProducts = filteredProducts.filter(
    (product) => product.hasIncompleteRegistration
  );
  if (incompleteProducts.length) {
    attentionGroups.push({
      id: "attention-incomplete",
      title: `${incompleteProducts.length} item(ns) com cadastro incompleto`,
      description:
        "SKU ausente dificulta rastreio operacional e conciliacao de custos.",
      preview: incompleteProducts.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-neutral",
      productId: incompleteProducts[0].id,
    });
  }

  const lowPerformanceProducts = filteredProducts.filter((product) => product.hasLowPerformance);
  if (lowPerformanceProducts.length) {
    attentionGroups.push({
      id: "attention-low-performance",
      title: `${lowPerformanceProducts.length} item(ns) com baixa performance`,
      description:
        "Produtos pausados ou com margem fraca pedem revisao de estrategia comercial.",
      preview: lowPerformanceProducts.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-warning",
      productId: lowPerformanceProducts[0].id,
    });
  }

  return attentionGroups;
}

export {
  normalizeValue,
  getStatusTone,
  getMarginTone,
  enrichProducts,
  buildProductsContextCards,
  buildProductsAttentionGroups,
};
