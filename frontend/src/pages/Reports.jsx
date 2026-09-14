import { useEffect, useState } from "react";
import {
  createAdditionalReportCost,
  getAdditionalReportCosts,
  getProfitReport,
  getReports,
  removeAdditionalReportCost,
} from "../services/api";
import PageHeader from "../components/PageHeader";
import SummaryCard from "../components/SummaryCard";
import Panel from "../components/Panel";
import AdditionalExpensesPanel from "../components/reports/AdditionalExpensesPanel";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import { formatCurrency } from "../utils/presentation";
import {
  formatInteger,
  formatPercentage,
  getDefaultMonthReference,
  parseCurrencyValue,
  formatPeriodLabel,
  getValueTone,
} from "../utils/reportsFormatting";
import {
  calculateProfitReportSummary,
  groupExpensesByMonth,
  buildMonthlyReportRows,
  calculateMonthlyReportSummary,
  buildChannelPerformance,
  buildTopProfitableProducts,
} from "../utils/reportsCalculations";
import {
  buildProfitReportWorkbook,
  buildAdditionalExpensesWorkbook,
  downloadWorkbookFile,
} from "../utils/reportsExport";
import "./Reports.css";

function Reports() {
  const { selectedPeriod, setSelectedPeriod } = useAnalyticsPeriod();
  const [data, setData] = useState(null);
  const [profitReportRows, setProfitReportRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportingExpenses, setExportingExpenses] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    value: "",
    monthReference: getDefaultMonthReference(),
  });
  const [formError, setFormError] = useState("");
  const [additionalExpenses, setAdditionalExpenses] = useState([]);
  const [savingExpense, setSavingExpense] = useState(false);
  const [removingExpenseId, setRemovingExpenseId] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadReports() {
      try {
        setError("");
        setLoading(true);

        const [reportsResult, profitReportResult, additionalCostsResult] = await Promise.all([
          getReports(selectedPeriod),
          getProfitReport(selectedPeriod),
          getAdditionalReportCosts(selectedPeriod),
        ]);

        if (!isCancelled) {
          setData(reportsResult);
          setProfitReportRows(profitReportResult);
          setAdditionalExpenses(additionalCostsResult?.items || []);
        }
      } catch {
        if (!isCancelled) {
          setError("Nao foi possivel carregar os relatorios.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      isCancelled = true;
    };
  }, [selectedPeriod]);

  function handleExpenseFieldChange(event) {
    const { name, value } = event.target;

    setExpenseForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (formError) {
      setFormError("");
    }
  }

  async function handleAddExpense(event) {
    event.preventDefault();

    const description = expenseForm.description.trim();
    const parsedValue = parseCurrencyValue(expenseForm.value);
    const monthReference = expenseForm.monthReference || getDefaultMonthReference();

    if (!description) {
      setFormError("Informe a descricao do gasto.");
      return;
    }

    if (parsedValue <= 0) {
      setFormError("Informe um valor valido maior que zero.");
      return;
    }

    try {
      setSavingExpense(true);
      setFormError("");

      const response = await createAdditionalReportCost(
        {
          description,
          value: parsedValue,
          monthReference,
        },
        selectedPeriod
      );

      setAdditionalExpenses(response.items || []);
      setExpenseForm({
        description: "",
        value: "",
        monthReference,
      });
    } catch (error) {
      setFormError(error.message || "Nao foi possivel salvar esse gasto adicional.");
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleRemoveExpense(expenseId) {
    try {
      setRemovingExpenseId(expenseId);
      setFormError("");
      const response = await removeAdditionalReportCost(expenseId, selectedPeriod);
      setAdditionalExpenses(response.items || []);
    } catch (error) {
      setFormError(error.message || "Nao foi possivel remover esse gasto adicional.");
    } finally {
      setRemovingExpenseId("");
    }
  }

  if (loading) return <div className="screen-message">Carregando relatorios...</div>;
  if (error) return <div className="screen-message">{error}</div>;
  if (!data) return <div className="screen-message">Dados invalidos.</div>;

  const profitReportSummary = calculateProfitReportSummary(profitReportRows);
  const originalProfit = profitReportSummary.netProfit;
  const totalAdditionalExpenses = additionalExpenses.reduce(
    (total, expense) => total + expense.value,
    0
  );
  const adjustedProfit = originalProfit - totalAdditionalExpenses;
  const channelPerformance = buildChannelPerformance(profitReportRows);
  const topProductsByProfit = buildTopProfitableProducts(profitReportRows);
  const expenseGroups = groupExpensesByMonth(additionalExpenses);
  const monthlyReportRows = buildMonthlyReportRows(Array.isArray(data.rows) ? data.rows : []);
  const monthlyReportSummary = calculateMonthlyReportSummary(monthlyReportRows);
  const selectedPeriodLabel = formatPeriodLabel(selectedPeriod);
  const monthlyRowsByProfit = [...monthlyReportRows].sort(
    (left, right) => right.profitValue - left.profitValue
  );
  const bestPeriodRow = monthlyRowsByProfit[0] || null;
  const worstPeriodRow =
    monthlyRowsByProfit.length > 1
      ? monthlyRowsByProfit[monthlyRowsByProfit.length - 1]
      : null;
  const averageProfitPerPeriod = monthlyReportRows.length
    ? monthlyReportSummary.profit / monthlyReportRows.length
    : 0;

  async function handleExport() {
    if (!profitReportRows.length) {
      return;
    }

    try {
      setExporting(true);

      await downloadWorkbookFile(
        "relatorio_rentabilidade_viisync.xlsx",
        await buildProfitReportWorkbook(profitReportRows, profitReportSummary, adjustedProfit)
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleExportAdditionalExpenses() {
    if (!additionalExpenses.length) {
      return;
    }

    try {
      setExportingExpenses(true);

      await downloadWorkbookFile(
        "custos_adicionais_mensais_viisync.xlsx",
        await buildAdditionalExpensesWorkbook(
          expenseGroups,
          totalAdditionalExpenses,
          adjustedProfit
        )
      );
    } finally {
      setExportingExpenses(false);
    }
  }

  return (
    <div className="reports-page">
      <PageHeader
        tag="Analises"
        title="Relatorios"
        description={`Leitura executiva de vendas, lucro e margem por canal. A exportacao considera o recorte de ${selectedPeriodLabel}.`}
      >
        <div className="reports-header-actions">
          <div className="reports-period-switcher">
            <button
              type="button"
              className={selectedPeriod === "7d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("7d")}
            >
              7 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "30d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("30d")}
            >
              30 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "90d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("90d")}
            >
              90 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "1y" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("1y")}
            >
              1 ano
            </button>
          </div>

          <button
            type="button"
            className="reports-export-button"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exportando planilha..." : "Exportar planilha"}
          </button>
        </div>
      </PageHeader>

      <div className="cards">
        <SummaryCard
          title="Faturamento total"
          value={formatCurrency(profitReportSummary.grossRevenue)}
          description={`Receita consolidada em ${selectedPeriodLabel}`}
          variant="card-revenue"
        />
        <SummaryCard
          title="Lucro total"
          value={formatCurrency(adjustedProfit)}
          description={`Lucro ajustado no recorte de ${selectedPeriodLabel}`}
          variant="card-profit"
        />
        <SummaryCard
          title="Registros"
          value={formatInteger(profitReportRows.length)}
          description="Linhas consideradas na exportacao"
          variant="card-sales"
        />
        <SummaryCard
          title="Margem media"
          value={formatPercentage(profitReportSummary.averageProfitMargin)}
          description={`Media do relatorio em ${selectedPeriodLabel}`}
          variant="card-ticket"
        />
      </div>

      <AdditionalExpensesPanel
        expenses={additionalExpenses}
        expenseForm={expenseForm}
        formError={formError}
        originalProfit={originalProfit}
        totalAdditionalExpenses={totalAdditionalExpenses}
        adjustedProfit={adjustedProfit}
        onFieldChange={handleExpenseFieldChange}
        onSubmit={handleAddExpense}
        onRemove={handleRemoveExpense}
        onExportExpenses={handleExportAdditionalExpenses}
        exportingExpenses={exportingExpenses}
        savingExpense={savingExpense}
        removingExpenseId={removingExpenseId}
      />

      <div className="panels">
        <div className="reports-focus-panel is-channel">
          <Panel
            title="Desempenho por canal"
            description={`Comparativo de receita e lucro por marketplace em ${selectedPeriodLabel.toLowerCase()}, com foco em decisao de alocacao.`}
          >
            {channelPerformance.length ? (
              channelPerformance.map((channel, index) => (
                <div key={channel.id} className="row reports-analytic-row">
                  <div className="row-main">
                    <strong>{channel.name}</strong>
                    <p>
                      {index === 0
                        ? "Canal lider de faturamento no recorte atual."
                        : "Canal ativo com contribuicao no resultado consolidado."}
                    </p>
                  </div>

                  <div className="report-values">
                    <span>Receita {channel.revenue}</span>
                    <strong>{channel.profit}</strong>
                  </div>
                </div>
              ))
            ) : (
              <div className="reports-panel-empty">
                Sem dados por canal para este recorte. Amplie o periodo ou sincronize os
                pedidos para liberar a leitura comparativa.
              </div>
            )}
          </Panel>
        </div>

        <div className="reports-focus-panel is-products">
          <Panel
            title="Produtos mais lucrativos"
            description={`Itens com maior contribuicao de lucro em ${selectedPeriodLabel.toLowerCase()}, priorizando a visao de rentabilidade.`}
          >
            {topProductsByProfit.length ? (
              topProductsByProfit.map((product, index) => (
                <div key={product.id} className="row reports-analytic-row">
                  <div className="rank">{index + 1}</div>

                  <div className="row-main">
                    <strong>{product.name}</strong>
                    <p>{index === 0 ? "Maior lucro do recorte analisado." : "Produto com resultado positivo relevante."}</p>
                  </div>

                  <span className="row-value">{product.profit}</span>
                </div>
              ))
            ) : (
              <div className="reports-panel-empty">
                Sem produtos lucrativos consolidados no periodo atual. Revise filtros ou
                aguarde nova sincronizacao para comparar itens.
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="panel reports-table-panel">
        <div className="panel-header reports-table-panel-header">
          <div>
            <h2>Resumo por periodo</h2>
            <p>Leitura gerencial por periodo para identificar picos, quedas e tendencia de margem.</p>
          </div>

          <div className="reports-table-highlights">
            <span className="reports-highlight-chip">
              {formatInteger(monthlyReportRows.length)} periodo(s)
            </span>
            <span
              className={`reports-highlight-chip reports-highlight-chip-${getValueTone(
                monthlyReportSummary.marginValue
              )}`}
            >
              Margem consolidada {formatPercentage(monthlyReportSummary.marginValue)}
            </span>
          </div>
        </div>

        <div className="reports-managerial-grid">
          <article className="reports-managerial-card is-positive">
            <span>Melhor periodo</span>
            <strong>{bestPeriodRow ? bestPeriodRow.period : "--"}</strong>
            <p>
              {bestPeriodRow
                ? `Lucro ${bestPeriodRow.profit} com margem de ${formatPercentage(
                    bestPeriodRow.marginValue
                  )}.`
                : "Sem base de periodos para identificar melhor desempenho."}
            </p>
          </article>

          <article className="reports-managerial-card is-negative">
            <span>Pior periodo</span>
            <strong>{worstPeriodRow ? worstPeriodRow.period : "--"}</strong>
            <p>
              {worstPeriodRow
                ? `Lucro ${worstPeriodRow.profit} com margem de ${formatPercentage(
                    worstPeriodRow.marginValue
                  )}.`
                : monthlyReportRows.length === 1
                  ? "Aguardando mais de um periodo para comparar melhor e pior resultado."
                  : "Sem base de periodos para leitura de risco."}
            </p>
          </article>

          <article className="reports-managerial-card is-neutral">
            <span>Lucro medio</span>
            <strong>
              {monthlyReportRows.length ? formatCurrency(averageProfitPerPeriod) : "--"}
            </strong>
            <p>
              {monthlyReportRows.length
                ? `${formatInteger(monthlyReportRows.length)} periodo(s) analisado(s) no recorte.`
                : "Sem periodos consolidados para calcular media de lucro."}
            </p>
          </article>

          <article
            className={`reports-managerial-card is-${getValueTone(
              monthlyReportSummary.marginValue
            )}`}
          >
            <span>Margem consolidada</span>
            <strong>
              {monthlyReportRows.length
                ? formatPercentage(monthlyReportSummary.marginValue)
                : "--"}
            </strong>
            <p>
              {monthlyReportRows.length
                ? "Indicador geral de eficiencia do periodo consolidado."
                : "Sincronize dados para liberar leitura consolidada de margem."}
            </p>
          </article>
        </div>

        <div className="reports-table-shell">
          <div className="reports-table-overview">
            <div className="reports-overview-card">
              <span>Faturamento acumulado</span>
              <strong>{formatCurrency(monthlyReportSummary.revenue)}</strong>
            </div>

            <div className="reports-overview-card">
              <span>Lucro acumulado</span>
              <strong>{formatCurrency(monthlyReportSummary.profit)}</strong>
            </div>

            <div className="reports-overview-card">
              <span>Pedidos no resumo</span>
              <strong>{formatInteger(monthlyReportSummary.orders)}</strong>
            </div>
          </div>

          <div className="reports-table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th className="reports-table-cell-number">Pedidos</th>
                  <th className="reports-table-cell-number">Faturamento</th>
                  <th className="reports-table-cell-number">Lucro</th>
                  <th className="reports-table-cell-number">Margem</th>
                </tr>
              </thead>
              <tbody>
                {monthlyReportRows.length ? (
                  <>
                    {monthlyReportRows.map((row) => {
                      const revenueShare = monthlyReportSummary.revenue
                        ? (row.revenueValue / monthlyReportSummary.revenue) * 100
                        : 0;
                      const profitTone = getValueTone(row.profitValue);
                      const marginTone = getValueTone(row.marginValue);
                      const averageTicket = row.ordersValue
                        ? row.revenueValue / row.ordersValue
                        : 0;

                      return (
                        <tr key={row.id}>
                          <td data-label="Periodo">
                            <div className="reports-period-cell">
                              <strong>{row.period}</strong>
                              <span>
                                {formatPercentage(revenueShare)} do faturamento consolidado
                              </span>
                            </div>
                          </td>
                          <td className="reports-table-cell-number" data-label="Pedidos">
                            <div className="reports-table-metric">
                              <strong>{formatInteger(row.ordersValue)}</strong>
                              <span>
                                {row.ordersValue === 1 ? "pedido" : "pedidos"}
                              </span>
                            </div>
                          </td>
                          <td className="reports-table-cell-number" data-label="Faturamento">
                            <div className="reports-table-metric">
                              <strong>{row.revenue}</strong>
                              <span>{formatCurrency(averageTicket)} ticket medio</span>
                            </div>
                          </td>
                          <td className="reports-table-cell-number" data-label="Lucro">
                            <div className="reports-table-metric">
                              <span className={`reports-table-pill ${profitTone}`}>
                                {row.profit}
                              </span>
                              <span>{formatPercentage(row.marginValue)} de margem</span>
                            </div>
                          </td>
                          <td className="reports-table-cell-number" data-label="Margem">
                            <span className={`reports-table-pill ${marginTone}`}>
                              {formatPercentage(row.marginValue)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    <tr className="reports-table-total-row">
                      <td data-label="Periodo">
                        <div className="reports-period-cell">
                          <strong>Total consolidado</strong>
                          <span>
                            {formatInteger(monthlyReportRows.length)} periodo(s) analisado(s)
                          </span>
                        </div>
                      </td>
                      <td className="reports-table-cell-number" data-label="Pedidos">
                        <div className="reports-table-metric">
                          <strong>{formatInteger(monthlyReportSummary.orders)}</strong>
                          <span>pedidos no periodo</span>
                        </div>
                      </td>
                      <td className="reports-table-cell-number" data-label="Faturamento">
                        <div className="reports-table-metric">
                          <strong>{formatCurrency(monthlyReportSummary.revenue)}</strong>
                          <span>
                            {formatCurrency(
                              monthlyReportSummary.orders
                                ? monthlyReportSummary.revenue /
                                    monthlyReportSummary.orders
                                : 0
                            )}{" "}
                            ticket medio
                          </span>
                        </div>
                      </td>
                      <td className="reports-table-cell-number" data-label="Lucro">
                        <div className="reports-table-metric">
                          <span
                            className={`reports-table-pill ${getValueTone(
                              monthlyReportSummary.profit
                            )}`}
                          >
                            {formatCurrency(monthlyReportSummary.profit)}
                          </span>
                          <span>
                            {formatPercentage(monthlyReportSummary.marginValue)} de margem
                            consolidada
                          </span>
                        </div>
                      </td>
                      <td className="reports-table-cell-number" data-label="Margem">
                        <span
                          className={`reports-table-pill ${getValueTone(
                            monthlyReportSummary.marginValue
                          )}`}
                        >
                          {formatPercentage(monthlyReportSummary.marginValue)}
                        </span>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr className="reports-table-empty-row">
                    <td colSpan={5}>
                      Nenhum periodo consolidado disponivel. Ajuste o recorte ou atualize os
                      dados para habilitar a leitura gerencial.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
