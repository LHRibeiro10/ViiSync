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

  const shouldScrollTopProducts = data.topProducts.length > 6;
  const shouldScrollRecentOrders = data.recentOrders.length > 6;

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

        <ChartPanel
          title="Faturamento por periodo"
          description="Evolucao recente das vendas sincronizadas"
          data={chartData}
          formatCurrency={formatCurrency}
        />

        <ProfitTable
          rows={profitRows}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          onEditRow={handleOpenCalculator}
        />

        <div className="panels">
          <Panel
            title="Top produtos"
            description="Itens com maior faturamento no periodo"
            actionLabel="Ver todos"
            onActionClick={() => navigate("/produtos")}
          >
            <div
              className={`panel-scroll-body ui-scroll-region ${
                shouldScrollTopProducts ? "is-scrollable scroll-region-medium" : ""
              }`}
            >
              {data.topProducts.map((product, index) => (
                <div key={product.id} className="row">
                  <div className="rank">{index + 1}</div>

                  <div className="row-main">
                    <strong>{product.name}</strong>
                    <p>Produto em destaque</p>
                  </div>

                  <span className="row-value">{product.revenue}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Pedidos recentes"
            description="Ultimas vendas sincronizadas"
            actionLabel="Ver pedidos"
            onActionClick={() => navigate("/pedidos")}
          >
            <div
              className={`panel-scroll-body ui-scroll-region ${
                shouldScrollRecentOrders ? "is-scrollable scroll-region-medium" : ""
              }`}
            >
              {data.recentOrders.map((order) => (
                <div key={order.id} className="row">
                  <div className="order-dot" />

                  <div className="row-main">
                    <strong>{order.product}</strong>
                    <p>{order.marketplace}</p>
                  </div>

                  <span className="row-value">{order.value}</span>
                </div>
              ))}
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
