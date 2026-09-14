import { formatCurrency } from "./presentation";

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPercent(value) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

function getMarginPercent(value, revenue) {
  if (!Number.isFinite(revenue) || revenue <= 0 || !Number.isFinite(value)) {
    return 0;
  }

  return (value / revenue) * 100;
}

function calculateProfit(row, productCost, taxPercent) {
  const taxAmount = row.value * (taxPercent / 100);
  const profit =
    row.value - row.fee - row.sellerShipping - productCost - taxAmount;

  return Number(profit.toFixed(2));
}

function buildDashboardInsights({
  profitRows,
  hasMercadoLivreConnected,
  isSyncDelayed,
  summaryRevenue,
  summaryProfit,
  hasProfitRows,
  hasChartData,
  trendDirection,
  trendValueLabel,
  onOpenCalculator,
}) {
  const rowsWithDataGaps = profitRows.filter((row) => Boolean(row?.hasDataGaps));
  const rowsWithoutDataGaps = profitRows.filter((row) => !row?.hasDataGaps);
  const rowsWithoutCost = profitRows.filter(
    (row) => Boolean(row?.productCostMissing) || Number(row?.productCost) <= 0
  );
  const zeroOrNegativeProfitRows = rowsWithoutDataGaps.filter(
    (row) => Number(row?.profit) <= 0
  );
  const lowMarginRows = rowsWithoutDataGaps.filter((row) => {
    const marginPercent = getMarginPercent(Number(row?.profit), Number(row?.value));
    return marginPercent > 0 && marginPercent < 12;
  });

  const getRowMarginPercent = (row) =>
    getMarginPercent(Number(row?.profit), Number(row?.value));

  const mostProfitableRow = rowsWithoutDataGaps.length
    ? [...rowsWithoutDataGaps].sort((left, right) => Number(right.profit) - Number(left.profit))[0]
    : null;
  const worstMarginRow = rowsWithoutDataGaps.length
    ? [...rowsWithoutDataGaps].sort(
        (left, right) => getRowMarginPercent(left) - getRowMarginPercent(right)
      )[0]
    : null;
  const feeRateRows = profitRows.filter(
    (row) => Number.isFinite(Number(row?.fee)) && Number(row?.value) > 0
  );
  const totalFeeValue = feeRateRows.reduce((accumulator, row) => accumulator + Number(row.fee), 0);
  const totalRevenueValue = feeRateRows.reduce(
    (accumulator, row) => accumulator + Number(row.value),
    0
  );
  const averageFeePercent = totalRevenueValue > 0 ? (totalFeeValue / totalRevenueValue) * 100 : null;

  const attentionItems = [];

  if (rowsWithoutCost.length) {
    attentionItems.push({
      id: "missing-cost",
      tone: "is-warning",
      label: "Custo pendente",
      title: `${rowsWithoutCost.length} item(ns) sem custo cadastrado`,
      description:
        "Sem custo completo, o lucro do item fica estimado e pode distorcer decisao de preco.",
      actionLabel: "Revisar item",
      action: () => onOpenCalculator(rowsWithoutCost[0]),
    });
  }

  if (lowMarginRows.length) {
    attentionItems.push({
      id: "low-margin",
      tone: "is-warning",
      label: "Margem apertada",
      title: `${lowMarginRows.length} item(ns) com margem abaixo de 12%`,
      description:
        "Revise tarifa, frete e custo para evitar erosao de margem nas proximas vendas.",
      actionLabel: "Ajustar margem",
      action: () => onOpenCalculator(lowMarginRows[0]),
    });
  }

  if (zeroOrNegativeProfitRows.length) {
    attentionItems.push({
      id: "zero-profit",
      tone: "is-danger",
      label: "Lucro critico",
      title: `${zeroOrNegativeProfitRows.length} item(ns) com lucro zerado ou negativo`,
      description:
        "Priorize os itens com resultado mais fraco para evitar repeticao de prejuizo no periodo.",
      actionLabel: "Abrir item critico",
      action: () => onOpenCalculator(zeroOrNegativeProfitRows[0]),
    });
  }

  const visibleAttentionItems = attentionItems.slice(0, 3);

  const smartSummaryCandidates = [];

  if (!hasMercadoLivreConnected) {
    smartSummaryCandidates.push({
      id: "summary-integration",
      tone: "is-warning",
      title: "Integracao Mercado Livre pendente",
      description:
        "Conecte a conta para atualizar pedidos e liberar leitura operacional confiavel no dia.",
    });
  }

  if (isSyncDelayed) {
    smartSummaryCandidates.push({
      id: "summary-sync-delay",
      tone: "is-warning",
      title: "Base operacional desatualizada",
      description:
        "A sincronizacao esta antiga. Execute uma nova carga para validar os indicadores de hoje.",
    });
  }

  if (summaryRevenue > 0 && summaryProfit <= 0) {
    smartSummaryCandidates.push({
      id: "summary-profit-zero",
      tone: "is-danger",
      title: "Lucro zerado ou negativo no recorte atual",
      description:
        "Mesmo com faturamento no periodo, o resultado liquido indica necessidade de ajuste imediato.",
    });
  }

  if (rowsWithDataGaps.length) {
    smartSummaryCandidates.push({
      id: "summary-margin-missing",
      tone: "is-warning",
      title: `${rowsWithDataGaps.length} item(ns) sem margem calculada`,
      description:
        "Preencha custo e imposto para transformar lucro estimado em leitura real de rentabilidade.",
    });
  }

  if (!hasProfitRows) {
    smartSummaryCandidates.push({
      id: "summary-no-profit-table",
      tone: "is-neutral",
      title: "Sem base de operacao por produto neste periodo",
      description:
        "A tabela ainda nao tem itens sincronizados. Ajuste o recorte ou atualize os dados.",
    });
  }

  if (!hasChartData) {
    smartSummaryCandidates.push({
      id: "summary-no-chart",
      tone: "is-neutral",
      title: "Tendencia de faturamento indisponivel",
      description:
        "Nao ha pontos suficientes para curva de receita. Sincronize ou revise o periodo selecionado.",
    });
  }

  if (trendDirection === "down" && hasChartData) {
    smartSummaryCandidates.push({
      id: "summary-down-trend",
      tone: "is-warning",
      title: `Receita em queda (${trendValueLabel})`,
      description:
        "A curva de faturamento aponta desaceleracao. Vale revisar itens com baixa margem e conversao.",
    });
  }

  if (!smartSummaryCandidates.length) {
    smartSummaryCandidates.push({
      id: "summary-stable",
      tone: "is-positive",
      title: "Operacao sem alerta critico no momento",
      description:
        "Base de dados consistente e margem geral controlada para o periodo selecionado.",
    });
  }

  const smartSummaryInsights = smartSummaryCandidates.slice(0, 3);

  const primaryAlertSource =
    visibleAttentionItems[0] ||
    smartSummaryInsights.find((insight) => insight.tone !== "is-positive") ||
    smartSummaryInsights[0] ||
    null;

  const miniInsightCards = [
    mostProfitableRow
      ? {
          id: "mini-best-profit",
          label: "Produto mais lucrativo",
          value: mostProfitableRow.title,
          detail: `${formatCurrency(Number(mostProfitableRow.profit))} de lucro no recorte.`,
          tone: "is-positive",
        }
      : {
          id: "mini-best-profit-placeholder",
          label: "Produto mais lucrativo",
          value: "Aguardando base",
          detail: "Sem vendas com lucro validado para destacar um item lider.",
          tone: "is-placeholder",
        },
    worstMarginRow
      ? {
          id: "mini-worst-margin",
          label: "Pior margem",
          value: formatPercent(getRowMarginPercent(worstMarginRow)),
          detail: `${worstMarginRow.title} exige revisao de custo/tarifa.`,
          tone: getRowMarginPercent(worstMarginRow) <= 0 ? "is-danger" : "is-warning",
        }
      : {
          id: "mini-worst-margin-placeholder",
          label: "Pior margem",
          value: "N/D",
          detail: "Margens ainda indisponiveis por falta de dados completos.",
          tone: "is-placeholder",
        },
    Number.isFinite(averageFeePercent)
      ? {
          id: "mini-average-fee",
          label: "Tarifa media",
          value: formatPercent(averageFeePercent),
          detail: `Media ponderada em ${feeRateRows.length} venda(s) do periodo.`,
          tone: averageFeePercent > 18 ? "is-warning" : "is-neutral",
        }
      : {
          id: "mini-average-fee-placeholder",
          label: "Tarifa media",
          value: "N/D",
          detail: "Sem base suficiente para calcular peso de tarifas.",
          tone: "is-placeholder",
        },
    primaryAlertSource
      ? {
          id: "mini-primary-alert",
          label: "Alerta principal",
          value: primaryAlertSource.title,
          detail: primaryAlertSource.description,
          tone: primaryAlertSource.tone,
        }
      : {
          id: "mini-primary-alert-placeholder",
          label: "Alerta principal",
          value: "Sem alerta critico",
          detail: "Nenhuma inconsistencia relevante detectada neste recorte.",
          tone: "is-neutral",
        },
  ];

  return {
    visibleAttentionItems,
    smartSummaryInsights,
    miniInsightCards,
  };
}

export { formatPercent, calculateProfit, buildDashboardInsights };
