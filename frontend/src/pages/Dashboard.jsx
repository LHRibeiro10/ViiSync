import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getChartData,
  getDashboard,
  getMercadoLivreAuthorizationUrl,
  getMercadoLivreIntegrationStatus,
  getProfitTable,
  syncMercadoLivreAll,
} from "../services/api";
import PageHeader from "../components/PageHeader";
import SummaryCard from "../components/SummaryCard";
import Panel from "../components/Panel";
import ChartPanel from "../components/ChartPanel";
import ProfitTable from "../components/ProfitTable";
import TaxCalculatorModal from "../components/TaxCalculatorModal";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import {
  buildCustomPeriodToken,
  getPeriodLabel,
  getPeriodRange,
  isCustomPeriod,
  MAX_CUSTOM_PERIOD_DAYS,
  parseCustomPeriodToken,
} from "../utils/period";
import "./Dashboard.css";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERIOD_SWITCH_DELAY_MS = 120;
const PERIOD_SWITCH_ENTER_MS = 180;

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

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

function Dashboard() {
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [profitRows, setProfitRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPeriodRefreshing, setIsPeriodRefreshing] = useState(false);
  const [periodTransitionStage, setPeriodTransitionStage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [connectingMercadoLivre, setConnectingMercadoLivre] = useState(false);
  const [mercadoLivreStatus, setMercadoLivreStatus] = useState(null);
  const [integrationFeedback, setIntegrationFeedback] = useState(null);
  const [isCustomRangePanelOpen, setIsCustomRangePanelOpen] = useState(false);
  const [customRangeForm, setCustomRangeForm] = useState({
    startDate: "",
    endDate: "",
  });
  const [customRangeError, setCustomRangeError] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [calculatorForm, setCalculatorForm] = useState({
    productCost: "",
    taxPercent: "",
  });
  const [calculatorError, setCalculatorError] = useState("");
  const hasLoadedOnceRef = useRef(false);
  const latestPeriodRequestRef = useRef(0);
  const navigate = useNavigate();
  const { selectedPeriod, setSelectedPeriod } = useAnalyticsPeriod();
  const hasMercadoLivreConnected = Boolean(mercadoLivreStatus?.usingLive);
  const isMarketplaceSyncing = mercadoLivreStatus?.sync?.status === "syncing";

  function showIntegrationFeedback(message, tone = "success") {
    setIntegrationFeedback({
      tone,
      message,
    });
    window.setTimeout(() => setIntegrationFeedback(null), 3000);
  }

  useEffect(() => {
    const requestId = latestPeriodRequestRef.current + 1;
    latestPeriodRequestRef.current = requestId;
    const isInitialLoad = !hasLoadedOnceRef.current;
    let isCancelled = false;
    let enterTimeoutId;

    async function loadDashboard() {
      try {
        if (isInitialLoad) {
          setLoading(true);
        } else {
          setIsPeriodRefreshing(true);
          setPeriodTransitionStage("is-period-exiting");
          await new Promise((resolve) => window.setTimeout(resolve, PERIOD_SWITCH_DELAY_MS));

          if (isCancelled || latestPeriodRequestRef.current !== requestId) {
            return;
          }
        }

        setError("");

        const [dashboardResult, chartResult, profitResult, statusResult] = await Promise.all([
          getDashboard(selectedPeriod),
          getChartData(selectedPeriod),
          getProfitTable(selectedPeriod),
          getMercadoLivreIntegrationStatus().catch(() => null),
        ]);

        if (isCancelled || latestPeriodRequestRef.current !== requestId) {
          return;
        }

        setData(dashboardResult);
        setChartData(chartResult);
        setProfitRows(profitResult);
        setMercadoLivreStatus(statusResult);
        hasLoadedOnceRef.current = true;

        if (!isInitialLoad) {
          setPeriodTransitionStage("is-period-entering");
          enterTimeoutId = window.setTimeout(() => {
            if (!isCancelled && latestPeriodRequestRef.current === requestId) {
              setPeriodTransitionStage("");
            }
          }, PERIOD_SWITCH_ENTER_MS);
        }
      } catch {
        if (isCancelled || latestPeriodRequestRef.current !== requestId) {
          return;
        }

        setError("Nao foi possivel carregar o dashboard.");

        if (!isInitialLoad) {
          setPeriodTransitionStage("");
        }
      } finally {
        if (!isCancelled && latestPeriodRequestRef.current === requestId) {
          if (isInitialLoad) {
            setLoading(false);
          } else {
            setIsPeriodRefreshing(false);
          }
        }
      }
    }

    loadDashboard();

    return () => {
      isCancelled = true;
      window.clearTimeout(enterTimeoutId);
    };
  }, [selectedPeriod]);

  function handlePeriodChange(nextPeriod) {
    if (nextPeriod === selectedPeriod) {
      return;
    }

    setIsCustomRangePanelOpen(false);
    setCustomRangeError("");
    setSelectedPeriod(nextPeriod);
  }

  function handleOpenCustomRangePanel() {
    const selectedCustomRange = parseCustomPeriodToken(selectedPeriod);
    const fallbackRange = getPeriodRange("30d");

    setCustomRangeForm({
      startDate: selectedCustomRange?.startDateIso || fallbackRange.startDateIso,
      endDate: selectedCustomRange?.endDateIso || fallbackRange.endDateIso,
    });
    setCustomRangeError("");
    setIsCustomRangePanelOpen(true);
  }

  function handleCloseCustomRangePanel() {
    setIsCustomRangePanelOpen(false);
    setCustomRangeError("");
  }

  function handleCustomRangeFieldChange(event) {
    const { name, value } = event.target;

    setCustomRangeForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (customRangeError) {
      setCustomRangeError("");
    }
  }

  function handleApplyCustomRange(event) {
    event.preventDefault();

    const nextPeriod = buildCustomPeriodToken(
      customRangeForm.startDate,
      customRangeForm.endDate
    );

    if (!nextPeriod) {
      setCustomRangeError(
        `Defina um intervalo valido entre as datas com no maximo ${MAX_CUSTOM_PERIOD_DAYS} dias.`
      );
      return;
    }

    setSelectedPeriod(nextPeriod);
    setIsCustomRangePanelOpen(false);
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setError("");
      const syncRange = getPeriodRange(selectedPeriod);

      await syncMercadoLivreAll({
        period: selectedPeriod,
        startDate: syncRange.startDateIso,
        endDate: syncRange.endDateIso,
      });

      const [dashboardResult, chartResult, profitResult, statusResult] = await Promise.all([
        getDashboard(selectedPeriod),
        getChartData(selectedPeriod),
        getProfitTable(selectedPeriod),
        getMercadoLivreIntegrationStatus().catch(() => null),
      ]);

      setData(dashboardResult);
      setChartData(chartResult);
      setProfitRows(profitResult);
      setMercadoLivreStatus(statusResult);
    } catch (error) {
      setError(error.message || "Nao foi possivel sincronizar os dados do Mercado Livre.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleConnectMercadoLivre() {
    try {
      setConnectingMercadoLivre(true);
      const authorizationPayload = await getMercadoLivreAuthorizationUrl({
        accountName: "Conta Mercado Livre",
      });

      if (!authorizationPayload?.authorizationUrl) {
        throw new Error("Nao foi possivel obter a URL de autorizacao do Mercado Livre.");
      }

      window.open(authorizationPayload.authorizationUrl, "_blank", "noopener,noreferrer");
      showIntegrationFeedback(
        "Fluxo OAuth do Mercado Livre aberto. Conclua a autorizacao para liberar sincronizacao.",
        "success"
      );
    } catch (error) {
      showIntegrationFeedback(
        error?.message || "Nao foi possivel iniciar a conexao com o Mercado Livre.",
        "error"
      );
    } finally {
      setConnectingMercadoLivre(false);
    }
  }

  function handleOpenCalculator(row) {
    setSelectedRow(row);
    setCalculatorForm({
      productCost: String(row.productCost),
      taxPercent: String(row.taxPercent),
    });
    setCalculatorError("");
  }

  function handleCloseCalculator() {
    setSelectedRow(null);
    setCalculatorForm({
      productCost: "",
      taxPercent: "",
    });
    setCalculatorError("");
  }

  function handleCalculatorFieldChange(event) {
    const { name, value } = event.target;

    setCalculatorForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (calculatorError) {
      setCalculatorError("");
    }
  }

  function handleSaveCalculator(event) {
    event.preventDefault();

    if (!selectedRow) {
      return;
    }

    const nextProductCost = Number(calculatorForm.productCost);
    const nextTaxPercent = Number(calculatorForm.taxPercent);

    if (!Number.isFinite(nextProductCost) || nextProductCost < 0) {
      setCalculatorError("Informe um custo valido maior ou igual a zero.");
      return;
    }

    if (!Number.isFinite(nextTaxPercent) || nextTaxPercent < 0) {
      setCalculatorError("Informe um imposto valido maior ou igual a zero.");
      return;
    }

    setProfitRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== selectedRow.id) {
          return row;
        }

        return {
          ...row,
          productCost: nextProductCost,
          taxPercent: nextTaxPercent,
          profit: calculateProfit(row, nextProductCost, nextTaxPercent),
        };
      })
    );

    handleCloseCalculator();
  }

  if (loading) return <div className="screen-message">Carregando...</div>;
  if (error && !data) return <div className="screen-message">{error}</div>;
  if (!data || !data.summary) return <div className="screen-message">Dados invalidos.</div>;

  const topProducts = Array.isArray(data.topProducts) ? data.topProducts : [];
  const recentOrders = Array.isArray(data.recentOrders) ? data.recentOrders : [];
  const hasChartData = Array.isArray(chartData) && chartData.length > 0;
  const hasProfitRows = Array.isArray(profitRows) && profitRows.length > 0;
  const summaryRevenue = Number(data.summary.revenue);
  const summaryProfit = Number(data.summary.profit);
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
  const firstChartPoint = hasChartData ? chartData[0] : null;
  const lastChartPoint = hasChartData ? chartData[chartData.length - 1] : null;
  const firstChartRevenue = Number(firstChartPoint?.revenue);
  const lastChartRevenue = Number(lastChartPoint?.revenue);
  const hasChartTrendBase = Number.isFinite(firstChartRevenue) && firstChartRevenue > 0;
  const chartTrendPercent = hasChartTrendBase
    ? ((lastChartRevenue - firstChartRevenue) / firstChartRevenue) * 100
    : 0;
  const trendDirection =
    chartTrendPercent > 2 ? "up" : chartTrendPercent < -2 ? "down" : "flat";
  const trendValueLabel = hasChartData
    ? trendDirection === "flat"
      ? "Estavel"
      : `${chartTrendPercent > 0 ? "+" : ""}${formatPercent(chartTrendPercent)}`
    : "Sem dados";
  const lastSyncedAtText = mercadoLivreStatus?.sync?.lastSyncedAt || null;
  const lastSyncedAtDate = lastSyncedAtText ? new Date(lastSyncedAtText) : null;
  const hasValidLastSyncedAt =
    lastSyncedAtDate instanceof Date && !Number.isNaN(lastSyncedAtDate.getTime());
  const syncAgeHours = hasValidLastSyncedAt
    ? (Date.now() - lastSyncedAtDate.getTime()) / (1000 * 60 * 60)
    : null;
  const isSyncDelayed =
    hasMercadoLivreConnected &&
    !isMarketplaceSyncing &&
    (syncAgeHours === null || syncAgeHours >= 12);
  const syncFreshnessLabel = !hasMercadoLivreConnected
    ? "Conexao pendente."
    : isMarketplaceSyncing
      ? "Sincronizacao em andamento."
      : syncAgeHours === null
        ? "Sem registro de sincronizacao concluida."
        : syncAgeHours < 1
          ? "Sincronizado ha menos de 1 hora."
          : `Ultima sincronizacao ha ${Math.floor(syncAgeHours)}h.`;
  const shouldScrollTopProducts = topProducts.length > 6;
  const shouldScrollRecentOrders = recentOrders.length > 6;
  const hasSyncActionInProgress = hasMercadoLivreConnected
    ? syncing || isMarketplaceSyncing
    : connectingMercadoLivre;

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
      action: () => handleOpenCalculator(rowsWithoutCost[0]),
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
      action: () => handleOpenCalculator(lowMarginRows[0]),
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
      action: () => handleOpenCalculator(zeroOrNegativeProfitRows[0]),
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

  let summaryActionLabel = "Revisar periodo";
  let summaryActionHandler = handleOpenCustomRangePanel;
  let summaryActionDisabled = false;

  if (!hasMercadoLivreConnected) {
    summaryActionLabel = connectingMercadoLivre ? "Abrindo OAuth..." : "Conectar Mercado Livre";
    summaryActionHandler = handleConnectMercadoLivre;
    summaryActionDisabled = connectingMercadoLivre;
  } else if (hasSyncActionInProgress) {
    summaryActionLabel = "Sincronizando...";
    summaryActionHandler = handleSync;
    summaryActionDisabled = true;
  } else if (isSyncDelayed || !hasChartData || !hasProfitRows) {
    summaryActionLabel = "Sincronizar agora";
    summaryActionHandler = handleSync;
    summaryActionDisabled = syncing;
  }

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

  return (
    <>
      <PageHeader
        tag="Visao geral"
        title="Dashboard ViiSync"
        description="Acompanhe vendas, lucro e desempenho das contas conectadas."
      >
        <div className="dashboard-period-control">
          <div className={`period-switcher ${isPeriodRefreshing ? "is-busy" : ""}`}>
            <button
              className={selectedPeriod === "7d" ? "period-button active" : "period-button"}
              onClick={() => handlePeriodChange("7d")}
            >
              7 dias
            </button>

            <button
              className={selectedPeriod === "30d" ? "period-button active" : "period-button"}
              onClick={() => handlePeriodChange("30d")}
            >
              30 dias
            </button>

            <button
              className={selectedPeriod === "90d" ? "period-button active" : "period-button"}
              onClick={() => handlePeriodChange("90d")}
            >
              90 dias
            </button>

            <button
              className={selectedPeriod === "1y" ? "period-button active" : "period-button"}
              onClick={() => handlePeriodChange("1y")}
            >
              1 ano
            </button>

            <button
              type="button"
              className={isCustomPeriod(selectedPeriod) ? "period-button active" : "period-button"}
              onClick={handleOpenCustomRangePanel}
            >
              Personalizar
            </button>
          </div>

          {isCustomPeriod(selectedPeriod) ? (
            <span className="dashboard-period-caption">
              Recorte ativo: {getPeriodLabel(selectedPeriod)}
            </span>
          ) : null}

          {isCustomRangePanelOpen ? (
            <form className="dashboard-custom-range-panel" onSubmit={handleApplyCustomRange}>
              <label>
                <span>Data inicial</span>
                <input
                  type="date"
                  name="startDate"
                  value={customRangeForm.startDate}
                  onChange={handleCustomRangeFieldChange}
                  required
                />
              </label>

              <label>
                <span>Data final</span>
                <input
                  type="date"
                  name="endDate"
                  value={customRangeForm.endDate}
                  onChange={handleCustomRangeFieldChange}
                  required
                />
              </label>

              <div className="dashboard-custom-range-actions">
                <button type="button" onClick={handleCloseCustomRangePanel}>
                  Cancelar
                </button>
                <button type="submit">Aplicar</button>
              </div>

              {customRangeError ? (
                <p className="dashboard-custom-range-error">{customRangeError}</p>
              ) : null}
            </form>
          ) : null}
        </div>

        <button
          onClick={hasMercadoLivreConnected ? handleSync : handleConnectMercadoLivre}
          disabled={
            hasMercadoLivreConnected
              ? syncing || isMarketplaceSyncing
              : connectingMercadoLivre
          }
        >
          {hasMercadoLivreConnected
            ? syncing || isMarketplaceSyncing
              ? "Sincronizando..."
              : "Sincronizar"
            : connectingMercadoLivre
              ? "Abrindo OAuth..."
              : "Conectar Mercado Livre"}
        </button>
      </PageHeader>

      <div
        className={`dashboard-period-shell ${periodTransitionStage}`.trim()}
        aria-busy={isPeriodRefreshing}
      >
        {error ? <div className="dashboard-inline-error">{error}</div> : null}
        {integrationFeedback ? (
          <div
            className={
              integrationFeedback.tone === "error"
                ? "dashboard-inline-error"
                : "dashboard-inline-success"
            }
          >
            {integrationFeedback.message}
          </div>
        ) : null}
        {mercadoLivreStatus?.sync ? (
          <div className="dashboard-sync-status">
            <strong>Status da sincronizacao:</strong>{" "}
            {mercadoLivreStatus.sync.statusLabel || "Aguardando"}
            {mercadoLivreStatus.sync.lastSyncedAt
              ? ` | Ultima sincronizacao em ${new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(mercadoLivreStatus.sync.lastSyncedAt))}`
              : ""}
          </div>
        ) : null}
        <section className="dashboard-smart-summary">
          <div className="dashboard-smart-summary-header">
            <div>
              <span className="dashboard-smart-summary-tag">Leitura operacional</span>
              <h2>Resumo inteligente do dia</h2>
              <p>
                Ate 3 sinais priorizados para apoiar decisoes rapidas no dashboard.
              </p>
            </div>

            <div className="dashboard-smart-summary-actions">
              <small>{syncFreshnessLabel}</small>
              <button
                type="button"
                className="panel-link"
                onClick={summaryActionHandler}
                disabled={summaryActionDisabled}
              >
                {summaryActionLabel}
              </button>
            </div>
          </div>

          <div className="dashboard-smart-summary-list">
            {smartSummaryInsights.map((insight) => (
              <article
                key={insight.id}
                className={`dashboard-smart-summary-item ${insight.tone}`}
              >
                <strong>{insight.title}</strong>
                <p>{insight.description}</p>
              </article>
            ))}
          </div>
        </section>
        {hasMercadoLivreConnected ? null : (
          <section className="dashboard-ml-connect-box">
            <div className="dashboard-ml-connect-copy">
              <span className="dashboard-ml-connect-tag">Integracao pendente</span>
              <h2>Conecte sua conta do Mercado Livre</h2>
              <p>
                Para sincronizar pedidos, produtos e perguntas, conecte agora sua conta com o
                mesmo fluxo OAuth usado no botao de reconectar.
              </p>
            </div>

            <button
              type="button"
              className="dashboard-ml-connect-button"
              onClick={handleConnectMercadoLivre}
              disabled={connectingMercadoLivre}
            >
              {connectingMercadoLivre ? "Abrindo OAuth..." : "Conectar conta Mercado Livre"}
            </button>
          </section>
        )}

        <div className="cards">
          <SummaryCard
            title="Faturamento"
            value={formatCurrency(data.summary.revenue)}
            description="Receita total do periodo"
            variant="card-revenue"
          />

          <SummaryCard
            title="Lucro"
            value={formatCurrency(data.summary.profit)}
            description="Resultado liquido estimado"
            variant="card-profit"
          />

          <SummaryCard
            title="Vendas"
            value={data.summary.sales}
            description="Pedidos concluidos"
            variant="card-sales"
          />

          <SummaryCard
            title="Ticket medio"
            value={formatCurrency(data.summary.averageTicket)}
            description="Media por venda"
            variant="card-ticket"
          />
        </div>

        <div className="dashboard-mini-insights-grid">
          {miniInsightCards.map((card) => (
            <article key={card.id} className={`dashboard-mini-insight-card ${card.tone}`}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        {hasChartData ? (
          <ChartPanel
            title="Faturamento por periodo"
            description="Evolucao recente das vendas sincronizadas"
            data={chartData}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="chart-panel">
            <div className="panel-header">
              <div>
                <h2>Faturamento por periodo</h2>
                <p>Evolucao recente das vendas sincronizadas</p>
              </div>
            </div>

            <div className="dashboard-module-empty">
              <strong>A curva de faturamento ainda nao pode ser exibida.</strong>
              <p>
                Nao encontramos pontos suficientes neste recorte para leitura de tendencia.
                Sincronize ou revise o periodo para recuperar visibilidade.
              </p>
              <div className="dashboard-empty-actions">
                <button
                  type="button"
                  className="panel-link"
                  onClick={hasMercadoLivreConnected ? handleSync : handleConnectMercadoLivre}
                  disabled={hasSyncActionInProgress}
                >
                  {hasMercadoLivreConnected
                    ? syncing || isMarketplaceSyncing
                      ? "Sincronizando..."
                      : "Sincronizar dados"
                    : connectingMercadoLivre
                      ? "Abrindo OAuth..."
                      : "Conectar Mercado Livre"}
                </button>
                <button
                  type="button"
                  className="dashboard-empty-ghost-button"
                  onClick={handleOpenCustomRangePanel}
                >
                  Revisar periodo
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="dashboard-attention-block">
          <div className="dashboard-attention-header">
            <div>
              <span className="dashboard-smart-summary-tag">Prioridade de ajuste</span>
              <h2>Produtos que precisam de atencao</h2>
              <p>
                Foque primeiro nos itens com risco de margem, lucro ou qualidade de dados.
              </p>
            </div>
          </div>

          {visibleAttentionItems.length ? (
            <div className="dashboard-attention-list">
              {visibleAttentionItems.map((item) => (
                <article key={item.id} className={`dashboard-attention-item ${item.tone}`}>
                  <div className="dashboard-attention-copy">
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>

                  <button
                    type="button"
                    className="panel-link"
                    onClick={item.action}
                  >
                    {item.actionLabel}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-module-empty">
              <strong>Nenhum produto critico identificado neste recorte.</strong>
              <p>
                Os itens sincronizados nao apresentam alerta de custo ausente, margem apertada ou
                lucro zerado/negativo no momento.
              </p>
            </div>
          )}
        </section>

        {hasProfitRows ? (
          <ProfitTable
            rows={profitRows}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
            onEditRow={handleOpenCalculator}
          />
        ) : (
          <div className="panel profit-table-panel">
            <div className="panel-header">
              <div>
                <h2>Operacao por produto</h2>
                <p>Controle custo, imposto e lucro por item vendido.</p>
              </div>
            </div>

            <div className="dashboard-module-empty">
              <strong>Nenhum item encontrado para este periodo.</strong>
              <p>
                Quando os pedidos forem sincronizados, voce podera revisar margem e lucro por
                produto aqui.
              </p>
              <div className="dashboard-empty-actions">
                <button
                  type="button"
                  className="panel-link"
                  onClick={hasMercadoLivreConnected ? handleSync : handleConnectMercadoLivre}
                  disabled={hasSyncActionInProgress}
                >
                  {hasMercadoLivreConnected
                    ? syncing || isMarketplaceSyncing
                      ? "Sincronizando..."
                      : "Sincronizar produtos"
                    : connectingMercadoLivre
                      ? "Abrindo OAuth..."
                      : "Conectar Mercado Livre"}
                </button>
                <button
                  type="button"
                  className="dashboard-empty-ghost-button"
                  onClick={handleOpenCustomRangePanel}
                >
                  Revisar periodo
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="panels">
          <Panel
            title="Top produtos"
            description="Itens com maior faturamento no periodo"
            actionLabel={topProducts.length ? "Ver todos" : null}
            onActionClick={() => navigate("/produtos")}
          >
            <div
              className={`panel-scroll-body ui-scroll-region ${
                shouldScrollTopProducts ? "is-scrollable scroll-region-medium" : ""
              }`}
            >
              {topProducts.length ? (
                topProducts.map((product, index) => (
                  <div key={product.id} className="row">
                    <div className="rank">{index + 1}</div>

                    <div className="row-main">
                      <strong>{product.name}</strong>
                      <p>Produto em destaque</p>
                    </div>

                    <span className="row-value">{product.revenue}</span>
                  </div>
                ))
              ) : (
                <div className="dashboard-list-empty">
                  <strong>Nenhum produto ranqueado no recorte atual.</strong>
                  <p>
                    Sem faturamento validado, nao e possivel sugerir prioridade comercial.
                    Sincronize ou ajuste o periodo para reconstruir o ranking.
                  </p>
                  <div className="dashboard-empty-actions">
                    <button
                      type="button"
                      className="panel-link"
                      onClick={hasMercadoLivreConnected ? handleSync : handleConnectMercadoLivre}
                      disabled={hasSyncActionInProgress}
                    >
                      {hasMercadoLivreConnected ? "Atualizar ranking" : "Conectar Mercado Livre"}
                    </button>
                    <button
                      type="button"
                      className="dashboard-empty-ghost-button"
                      onClick={handleOpenCustomRangePanel}
                    >
                      Revisar periodo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel
            title="Pedidos recentes"
            description="Ultimas vendas sincronizadas"
            actionLabel={recentOrders.length ? "Ver pedidos" : null}
            onActionClick={() => navigate("/pedidos")}
          >
            <div
              className={`panel-scroll-body ui-scroll-region ${
                shouldScrollRecentOrders ? "is-scrollable scroll-region-medium" : ""
              }`}
            >
              {recentOrders.length ? (
                recentOrders.map((order) => (
                  <div key={order.id} className="row">
                    <div className="order-dot" />

                    <div className="row-main">
                      <strong>{order.product}</strong>
                      <p>{order.marketplace}</p>
                    </div>

                    <span className="row-value">{order.value}</span>
                  </div>
                ))
              ) : (
                <div className="dashboard-list-empty">
                  <strong>Nenhum pedido recente encontrado neste recorte.</strong>
                  <p>
                    Isso pode indicar periodo muito restrito ou base ainda nao sincronizada.
                    Revise o recorte e acompanhe a central de pedidos.
                  </p>
                  <div className="dashboard-empty-actions">
                    <button
                      type="button"
                      className="panel-link"
                      onClick={() => navigate("/pedidos")}
                    >
                      Abrir central de pedidos
                    </button>
                    <button
                      type="button"
                      className="dashboard-empty-ghost-button"
                      onClick={handleOpenCustomRangePanel}
                    >
                      Revisar periodo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <TaxCalculatorModal
        item={selectedRow}
        form={calculatorForm}
        formError={calculatorError}
        formatCurrency={formatCurrency}
        onFieldChange={handleCalculatorFieldChange}
        onClose={handleCloseCalculator}
        onSave={handleSaveCalculator}
      />
    </>
  );
}

export default Dashboard;
