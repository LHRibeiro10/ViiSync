import { formatCurrency } from "./presentation";

const ORDER_FILTER_STORAGE_KEY = "viisync.orders.filters";
const DATE_PRESETS = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "last7", label: "Ultimos 7 dias" },
  { id: "last30", label: "Ultimos 30 dias" },
  { id: "thisMonth", label: "Este mes" },
  { id: "lastMonth", label: "Mes passado" },
  { id: "custom", label: "Personalizado" },
];
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function formatPercent(value) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

function getStatusTone(status) {
  const normalized = normalizeValue(status);

  if (normalized.includes("cancel")) {
    return "is-danger";
  }

  if (normalized.includes("pend")) {
    return "is-warning";
  }

  if (normalized.includes("envi")) {
    return "is-info";
  }

  if (normalized.includes("entreg")) {
    return "is-positive";
  }

  return "is-neutral";
}

function startOfDay(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function endOfDay(date) {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  const text = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function buildDefaultCustomRange() {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 6);

  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(today),
  };
}

function resolveRangeByPreset(preset, customRange) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (preset === "today") {
    return { start: todayStart, end: todayEnd };
  }

  if (preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
  }

  if (preset === "last7") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: startOfDay(start), end: todayEnd };
  }

  if (preset === "last30") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { start: startOfDay(start), end: todayEnd };
  }

  if (preset === "thisMonth") {
    return {
      start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: todayEnd,
    };
  }

  if (preset === "lastMonth") {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    return { start, end };
  }

  if (preset === "custom") {
    const parsedStart = parseDateInput(customRange.startDate);
    const parsedEnd = parseDateInput(customRange.endDate);

    if (!parsedStart || !parsedEnd) {
      return null;
    }

    if (parsedStart.getTime() > parsedEnd.getTime()) {
      return null;
    }

    return {
      start: startOfDay(parsedStart),
      end: endOfDay(parsedEnd),
    };
  }

  const fallbackStart = new Date(now);
  fallbackStart.setDate(fallbackStart.getDate() - 29);
  return { start: startOfDay(fallbackStart), end: todayEnd };
}

function loadStoredFilters() {
  if (typeof window === "undefined") {
    return {
      preset: "last30",
      customRange: buildDefaultCustomRange(),
    };
  }

  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(ORDER_FILTER_STORAGE_KEY) || "{}"
    );
    const preset = DATE_PRESETS.some((option) => option.id === parsed.preset)
      ? parsed.preset
      : "last30";
    const fallbackCustom = buildDefaultCustomRange();

    return {
      preset,
      customRange: {
        startDate: parsed?.customRange?.startDate || fallbackCustom.startDate,
        endDate: parsed?.customRange?.endDate || fallbackCustom.endDate,
      },
    };
  } catch {
    return {
      preset: "last30",
      customRange: buildDefaultCustomRange(),
    };
  }
}

function buildOrdersInsights(filteredOrders) {
  const filteredSummary = filteredOrders.reduce(
    (accumulator, order) => {
      const valueAmount = Number(order.valueAmount || 0);
      const netReceived = Number(order.netReceived || 0);

      return {
        totalOrders: accumulator.totalOrders + 1,
        grossRevenue: accumulator.grossRevenue + valueAmount,
        netReceived: accumulator.netReceived + netReceived,
      };
    },
    {
      totalOrders: 0,
      grossRevenue: 0,
      netReceived: 0,
    }
  );

  const grossRevenue = filteredSummary.grossRevenue;
  const netReceived = filteredSummary.netReceived;
  const averageTicket = filteredSummary.totalOrders
    ? grossRevenue / filteredSummary.totalOrders
    : 0;
  const hasFilteredOrders = filteredOrders.length > 0;

  const highestValueOrder = hasFilteredOrders
    ? [...filteredOrders].sort(
        (left, right) => Number(right.valueAmount || 0) - Number(left.valueAmount || 0)
      )[0]
    : null;

  const marketplaceCounts = filteredOrders.reduce((accumulator, order) => {
    const marketplace = String(order.marketplace || "Marketplace");
    const currentCount = accumulator.get(marketplace) || 0;
    accumulator.set(marketplace, currentCount + 1);
    return accumulator;
  }, new Map());
  const topMarketplaceEntry = Array.from(marketplaceCounts.entries()).sort(
    (left, right) => right[1] - left[1]
  )[0];
  const topMarketplace = topMarketplaceEntry
    ? { name: topMarketplaceEntry[0], count: topMarketplaceEntry[1] }
    : null;

  const marginCandidates = filteredOrders
    .map((order) => {
      const valueAmount = Number(order.valueAmount || 0);
      const netAmount = Number(order.netReceived || 0);
      const receivedMarginPercent =
        valueAmount > 0 ? (netAmount / valueAmount) * 100 : null;

      return {
        ...order,
        receivedMarginPercent,
      };
    })
    .filter((order) => Number.isFinite(order.receivedMarginPercent));
  const lowestMarginOrder = marginCandidates.length
    ? [...marginCandidates].sort(
        (left, right) => left.receivedMarginPercent - right.receivedMarginPercent
      )[0]
    : null;

  const pendingOrdersCount = filteredOrders.filter((order) =>
    normalizeValue(order.status).includes("pend")
  ).length;
  const cancelledOrdersCount = filteredOrders.filter((order) =>
    normalizeValue(order.status).includes("cancel")
  ).length;

  let operationalAttention = {
    tone: "is-positive",
    value: "Fluxo sob controle",
    detail: "Nao ha sinal critico no recorte atual.",
  };

  if (!hasFilteredOrders) {
    operationalAttention = {
      tone: "is-neutral",
      value: "Sem leitura operacional",
      detail: "Aplique filtros mais amplos para identificar prioridades de pedidos.",
    };
  } else if (pendingOrdersCount > 0) {
    operationalAttention = {
      tone: "is-warning",
      value: `${pendingOrdersCount} pendente(s)`,
      detail: "Pedidos pendentes pedem acompanhamento de envio e prazo.",
    };
  } else if (cancelledOrdersCount > 0) {
    operationalAttention = {
      tone: "is-danger",
      value: `${cancelledOrdersCount} cancelado(s)`,
      detail: "Verifique motivo de cancelamento para reduzir perda operacional.",
    };
  } else if (
    lowestMarginOrder &&
    Number(lowestMarginOrder.receivedMarginPercent) < 70
  ) {
    operationalAttention = {
      tone: "is-warning",
      value: `Margem recebida em ${formatPercent(lowestMarginOrder.receivedMarginPercent)}`,
      detail: `${lowestMarginOrder.id} apresenta retorno liquido abaixo do esperado.`,
    };
  }

  const operationalInsights = [
    highestValueOrder
      ? {
          id: "highest-value",
          label: "Pedido de maior valor",
          value: highestValueOrder.id,
          detail: `${formatCurrency(Number(highestValueOrder.valueAmount || 0))} em ${highestValueOrder.marketplace}.`,
          tone: "is-positive",
        }
      : {
          id: "highest-value-empty",
          label: "Pedido de maior valor",
          value: "Sem pedido no recorte",
          detail: "Amplie o periodo ou sincronize para comparar ticket por pedido.",
          tone: "is-placeholder",
        },
    topMarketplace
      ? {
          id: "top-marketplace",
          label: "Canal com mais pedidos",
          value: topMarketplace.name,
          detail: `${topMarketplace.count} pedido(s) no periodo filtrado.`,
          tone: "is-neutral",
        }
      : {
          id: "top-marketplace-empty",
          label: "Canal com mais pedidos",
          value: "Sem distribuicao por canal",
          detail: "Nao ha base suficiente para leitura de volume por marketplace.",
          tone: "is-placeholder",
        },
    lowestMarginOrder
      ? {
          id: "lowest-margin",
          label: "Pedido com menor margem",
          value: lowestMarginOrder.id,
          detail: `Margem liquida recebida de ${formatPercent(
            Number(lowestMarginOrder.receivedMarginPercent)
          )}.`,
          tone:
            Number(lowestMarginOrder.receivedMarginPercent) < 70
              ? "is-warning"
              : "is-neutral",
        }
      : {
          id: "lowest-margin-empty",
          label: "Pedido com menor margem",
          value: "Margem indisponivel",
          detail: "Os dados de valor/liquido nao foram suficientes para comparar margem.",
          tone: "is-placeholder",
        },
    {
      id: "operational-attention",
      label: "Ponto de atencao operacional",
      value: operationalAttention.value,
      detail: operationalAttention.detail,
      tone: operationalAttention.tone,
    },
  ];

  return {
    filteredSummary,
    grossRevenue,
    netReceived,
    averageTicket,
    operationalInsights,
  };
}

export {
  ORDER_FILTER_STORAGE_KEY,
  DATE_PRESETS,
  normalizeValue,
  formatPercent,
  getStatusTone,
  buildDefaultCustomRange,
  resolveRangeByPreset,
  loadStoredFilters,
  buildOrdersInsights,
};
