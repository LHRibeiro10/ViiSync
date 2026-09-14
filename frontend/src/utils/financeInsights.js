import { formatCurrency, formatPercent } from "./presentation";

function toSafeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildActionableInsights(payload, invoicePayload) {
  if (!payload) {
    return [];
  }

  const insights = [];
  const netProfit = toSafeNumber(payload.summary?.netProfit);
  const recurringTotal = payload.recurringExpenses.reduce(
    (sum, expense) => sum + toSafeNumber(expense.amount),
    0
  );
  const receivablesTotal = payload.receivables.reduce(
    (sum, receivable) => sum + toSafeNumber(receivable.amount),
    0
  );
  const pendingInvoices = toSafeNumber(invoicePayload?.meta?.pendingCount);
  const hasInvoiceHistory = toSafeNumber(invoicePayload?.meta?.total) > 0;
  const channelsByFeePercent = [...payload.feesByChannel].sort(
    (left, right) => toSafeNumber(right.feePercent) - toSafeNumber(left.feePercent)
  );
  const channelsByMargin = [...payload.feesByChannel].sort(
    (left, right) =>
      toSafeNumber(left.netMarginPercent) - toSafeNumber(right.netMarginPercent)
  );
  const highestFeeChannel = channelsByFeePercent[0];
  const lowestMarginChannel = channelsByMargin[0];

  if (netProfit <= 0) {
    insights.push({
      id: "net-profit-pressure",
      tone: "critical",
      title: "Rentabilidade comprometida",
      description:
        "Lucro liquido zerado ou negativo no periodo. Priorize corte de custos fixos e revisao de preco nos canais com menor margem.",
    });
  } else if (recurringTotal > 0) {
    const recurringShare = recurringTotal / netProfit;

    if (recurringShare >= 0.4) {
      insights.push({
        id: "recurring-pressure",
        tone: "warning",
        title: "Despesas recorrentes pressionam margem",
        description: `${formatPercent(
          recurringShare
        )} do lucro liquido ja esta comprometido com custos fixos. Renegocie contratos de maior impacto nesta semana.`,
      });
    } else if (recurringShare >= 0.2) {
      insights.push({
        id: "recurring-monitor",
        tone: "info",
        title: "Custos fixos pedem acompanhamento",
        description: `Despesas recorrentes consomem ${formatPercent(
          recurringShare
        )} do lucro liquido. Mantenha revisao mensal para preservar margem.`,
      });
    }
  }

  if (pendingInvoices > 0) {
    insights.push({
      id: "invoice-pending",
      tone: "warning",
      title: "Pendencias fiscais no periodo",
      description: `${pendingInvoices} NFe(s) ainda nao foram puxadas. Atualize agora para liberar XML/PDF antes do fechamento contabil.`,
    });
  } else if (hasInvoiceHistory) {
    insights.push({
      id: "invoice-ok",
      tone: "success",
      title: "Documentacao fiscal em dia",
      description:
        "NFes do periodo estao sincronizadas. Mantenha a rotina de conferencia para evitar pendencias de ultima hora.",
    });
  }

  if (receivablesTotal > 0) {
    insights.push({
      id: "receivables-cash",
      tone: "info",
      title: "Repasses ajudam o caixa de curto prazo",
      description: `${formatCurrency(
        receivablesTotal
      )} estao previstos para receber. Programe pagamentos fixos nas mesmas datas para reduzir pressao de caixa.`,
    });
  } else {
    insights.push({
      id: "receivables-empty",
      tone: "neutral",
      title: "Sem repasses previstos no recorte",
      description:
        "Amplie o periodo ou sincronize vendas para melhorar previsibilidade de caixa e evitar decisoes no escuro.",
    });
  }

  if (lowestMarginChannel && toSafeNumber(lowestMarginChannel.netMarginPercent) <= 0.12) {
    insights.push({
      id: "channel-margin-alert",
      tone: "warning",
      title: "Canal com margem apertada",
      description: `${lowestMarginChannel.channel} opera com margem liquida de ${formatPercent(
        lowestMarginChannel.netMarginPercent
      )}. Revise preco e custo antes de escalar investimento nesse canal.`,
    });
  } else if (
    highestFeeChannel &&
    toSafeNumber(highestFeeChannel.feePercent) >= 0.15
  ) {
    insights.push({
      id: "channel-fee-alert",
      tone: "info",
      title: "Concentracao de taxa por canal",
      description: `${highestFeeChannel.channel} concentra taxa de ${formatPercent(
        highestFeeChannel.feePercent
      )} sobre a receita. Monitore repasse e frete para proteger margem liquida.`,
    });
  }

  if (!insights.length) {
    insights.push({
      id: "insufficient-data",
      tone: "neutral",
      title: "Base financeira em formacao",
      description:
        "Sincronize pedidos e despesas para gerar leituras acionaveis de margem, repasses e custo por canal.",
    });
  }

  return insights.slice(0, 4);
}

export { toSafeNumber, buildActionableInsights };
