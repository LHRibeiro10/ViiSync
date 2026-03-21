import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getChartData,
  getDashboard,
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

        const [dashboardResult, chartResult, profitResult] = await Promise.all([
          getDashboard(selectedPeriod),
          getChartData(selectedPeriod),
          getProfitTable(selectedPeriod),
        ]);

        if (isCancelled || latestPeriodRequestRef.current !== requestId) {
          return;
        }

        setData(dashboardResult);
        setChartData(chartResult);
        setProfitRows(profitResult);
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

    setSelectedPeriod(nextPeriod);
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setError("");

      await syncMercadoLivreAll({
        period: selectedPeriod,
      });

      const [dashboardResult, chartResult, profitResult] = await Promise.all([
        getDashboard(selectedPeriod),
        getChartData(selectedPeriod),
        getProfitTable(selectedPeriod),
      ]);

      setData(dashboardResult);
      setChartData(chartResult);
      setProfitRows(profitResult);
    } catch (error) {
      setError(error.message || "Nao foi possivel sincronizar os dados do Mercado Livre.");
    } finally {
      setSyncing(false);
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
        </div>

        <button onClick={handleSync}>
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </PageHeader>

      <div
        className={`dashboard-period-shell ${periodTransitionStage}`.trim()}
        aria-busy={isPeriodRefreshing}
      >
        {error ? <div className="dashboard-inline-error">{error}</div> : null}

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
