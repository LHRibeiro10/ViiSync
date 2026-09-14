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
import TaxCalculatorModal from "../components/TaxCalculatorModal";
import DashboardHeaderControls from "../components/dashboard/DashboardHeaderControls";
import DashboardStatusBanners from "../components/dashboard/DashboardStatusBanners";
import SmartSummarySection from "../components/dashboard/SmartSummarySection";
import MercadoLivreConnectBanner from "../components/dashboard/MercadoLivreConnectBanner";
import DashboardChartSection from "../components/dashboard/DashboardChartSection";
import DashboardAttentionSection from "../components/dashboard/DashboardAttentionSection";
import DashboardProfitSection from "../components/dashboard/DashboardProfitSection";
import DashboardListPanels from "../components/dashboard/DashboardListPanels";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import {
  buildCustomPeriodToken,
  getPeriodRange,
  MAX_CUSTOM_PERIOD_DAYS,
  parseCustomPeriodToken,
} from "../utils/period";
import { formatCurrency } from "../utils/presentation";
import { formatPercent, calculateProfit, buildDashboardInsights } from "../utils/dashboardInsights";
import "./Dashboard.css";

const PERIOD_SWITCH_DELAY_MS = 120;
const PERIOD_SWITCH_ENTER_MS = 180;

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

  async function fetchDashboardBundle(period) {
    const [dashboardResult, chartResult, profitResult, statusResult] = await Promise.all([
      getDashboard(period),
      getChartData(period),
      getProfitTable(period),
      getMercadoLivreIntegrationStatus().catch(() => null),
    ]);

    return { dashboardResult, chartResult, profitResult, statusResult };
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

        const { dashboardResult, chartResult, profitResult, statusResult } =
          await fetchDashboardBundle(selectedPeriod);

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

      const { dashboardResult, chartResult, profitResult, statusResult } =
        await fetchDashboardBundle(selectedPeriod);

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

  const { visibleAttentionItems, smartSummaryInsights, miniInsightCards } = buildDashboardInsights({
    profitRows,
    hasMercadoLivreConnected,
    isSyncDelayed,
    summaryRevenue,
    summaryProfit,
    hasProfitRows,
    hasChartData,
    trendDirection,
    trendValueLabel,
    onOpenCalculator: handleOpenCalculator,
  });

  return (
    <>
      <PageHeader
        tag="Visao geral"
        title="Dashboard ViiSync"
        description="Acompanhe vendas, lucro e desempenho das contas conectadas."
      >
        <DashboardHeaderControls
          selectedPeriod={selectedPeriod}
          isPeriodRefreshing={isPeriodRefreshing}
          isCustomRangePanelOpen={isCustomRangePanelOpen}
          customRangeForm={customRangeForm}
          customRangeError={customRangeError}
          onPeriodChange={handlePeriodChange}
          onOpenCustomRangePanel={handleOpenCustomRangePanel}
          onCloseCustomRangePanel={handleCloseCustomRangePanel}
          onCustomRangeFieldChange={handleCustomRangeFieldChange}
          onApplyCustomRange={handleApplyCustomRange}
          hasMercadoLivreConnected={hasMercadoLivreConnected}
          syncing={syncing}
          isMarketplaceSyncing={isMarketplaceSyncing}
          connectingMercadoLivre={connectingMercadoLivre}
          onSync={handleSync}
          onConnectMercadoLivre={handleConnectMercadoLivre}
        />
      </PageHeader>

      <div
        className={`dashboard-period-shell ${periodTransitionStage}`.trim()}
        aria-busy={isPeriodRefreshing}
      >
        <DashboardStatusBanners
          error={error}
          integrationFeedback={integrationFeedback}
          mercadoLivreStatus={mercadoLivreStatus}
        />

        <SmartSummarySection
          syncFreshnessLabel={syncFreshnessLabel}
          summaryActionHandler={summaryActionHandler}
          summaryActionLabel={summaryActionLabel}
          summaryActionDisabled={summaryActionDisabled}
          smartSummaryInsights={smartSummaryInsights}
        />

        <MercadoLivreConnectBanner
          hasMercadoLivreConnected={hasMercadoLivreConnected}
          connectingMercadoLivre={connectingMercadoLivre}
          onConnectMercadoLivre={handleConnectMercadoLivre}
        />

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

        <DashboardChartSection
          hasChartData={hasChartData}
          chartData={chartData}
          formatCurrency={formatCurrency}
          hasMercadoLivreConnected={hasMercadoLivreConnected}
          syncing={syncing}
          isMarketplaceSyncing={isMarketplaceSyncing}
          connectingMercadoLivre={connectingMercadoLivre}
          onSync={handleSync}
          onConnectMercadoLivre={handleConnectMercadoLivre}
          onOpenCustomRangePanel={handleOpenCustomRangePanel}
        />

        <DashboardAttentionSection visibleAttentionItems={visibleAttentionItems} />

        <DashboardProfitSection
          hasProfitRows={hasProfitRows}
          profitRows={profitRows}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          onEditRow={handleOpenCalculator}
          hasMercadoLivreConnected={hasMercadoLivreConnected}
          syncing={syncing}
          isMarketplaceSyncing={isMarketplaceSyncing}
          connectingMercadoLivre={connectingMercadoLivre}
          onSync={handleSync}
          onConnectMercadoLivre={handleConnectMercadoLivre}
          onOpenCustomRangePanel={handleOpenCustomRangePanel}
        />

        <DashboardListPanels
          topProducts={topProducts}
          recentOrders={recentOrders}
          shouldScrollTopProducts={shouldScrollTopProducts}
          shouldScrollRecentOrders={shouldScrollRecentOrders}
          hasMercadoLivreConnected={hasMercadoLivreConnected}
          hasSyncActionInProgress={hasSyncActionInProgress}
          onSync={handleSync}
          onConnectMercadoLivre={handleConnectMercadoLivre}
          onOpenCustomRangePanel={handleOpenCustomRangePanel}
          onNavigateToProducts={() => navigate("/produtos")}
          onNavigateToOrders={() => navigate("/pedidos")}
        />
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
