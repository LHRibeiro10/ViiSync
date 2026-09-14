import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import ReceivablesSection from "../components/financeCenter/ReceivablesSection";
import InvoicesSection from "../components/financeCenter/InvoicesSection";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import {
  createRecurringFinanceExpense,
  dismissMercadoLivreInvoice,
  downloadMercadoLivreInvoiceDocument,
  getFinanceCenter,
  getMercadoLivreInvoices,
  pullMercadoLivreInvoice,
  pullPendingMercadoLivreInvoices,
  removeRecurringFinanceExpense,
} from "../services/api";
import {
  formatCurrency,
  formatDate,
  formatPercent,
} from "../utils/presentation";
import { triggerFileDownload } from "../utils/fileDownload";
import { toSafeNumber, buildActionableInsights } from "../utils/financeInsights";
import "./FinanceCenter.css";

function parseRecurringAmount(value) {
  const text = String(value || "").trim();
  if (!text) {
    return 0;
  }

  if (text.includes(",")) {
    const normalized = text.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const normalized = text.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function FinanceCenter() {
  const { selectedPeriod, setSelectedPeriod } = useAnalyticsPeriod();
  const [payload, setPayload] = useState(null);
  const [invoicePayload, setInvoicePayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceFeedback, setInvoiceFeedback] = useState("");
  const [pullingAllInvoices, setPullingAllInvoices] = useState(false);
  const [busyInvoiceId, setBusyInvoiceId] = useState("");
  const [downloadingDocumentKey, setDownloadingDocumentKey] = useState("");
  const [dismissingInvoiceId, setDismissingInvoiceId] = useState("");
  const [recurringExpenseForm, setRecurringExpenseForm] = useState({
    description: "",
    value: "",
    category: "Operacao",
    dueDay: "5",
  });
  const [recurringExpenseError, setRecurringExpenseError] = useState("");
  const [recurringExpenseFeedback, setRecurringExpenseFeedback] = useState("");
  const [savingRecurringExpense, setSavingRecurringExpense] = useState(false);
  const [removingRecurringExpenseId, setRemovingRecurringExpenseId] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadFinanceCenter() {
      setError("");
      setInvoiceError("");
      setInvoiceFeedback("");
      setRecurringExpenseError("");
      setRecurringExpenseFeedback("");
      setLoading(true);

      const [financeResult, invoicesResult] = await Promise.allSettled([
        getFinanceCenter(selectedPeriod),
        getMercadoLivreInvoices(selectedPeriod),
      ]);

      if (isCancelled) {
        return;
      }

      if (financeResult.status === "fulfilled") {
        setPayload(financeResult.value);
      } else {
        setError("Nao foi possivel carregar o centro financeiro.");
      }

      if (invoicesResult.status === "fulfilled") {
        setInvoicePayload(invoicesResult.value);
      } else {
        setInvoiceError("Nao foi possivel carregar as NFes do Mercado Livre.");
      }

      setLoading(false);
    }

    loadFinanceCenter();

    return () => {
      isCancelled = true;
    };
  }, [selectedPeriod]);

  async function handlePullPendingInvoices() {
    try {
      setPullingAllInvoices(true);
      setInvoiceError("");
      const response = await pullPendingMercadoLivreInvoices(selectedPeriod);
      setInvoicePayload(response);
      setInvoiceFeedback(response.message || "NFes pendentes atualizadas.");
    } catch {
      setInvoiceError("Nao foi possivel puxar as NFes pendentes do Mercado Livre.");
    } finally {
      setPullingAllInvoices(false);
    }
  }

  async function handlePullSingleInvoice(invoiceId) {
    try {
      setBusyInvoiceId(invoiceId);
      setInvoiceError("");
      const response = await pullMercadoLivreInvoice(invoiceId);

      setInvoicePayload((currentPayload) => {
        if (!currentPayload) {
          return currentPayload;
        }

        const nextItems = currentPayload.items.map((item) =>
          item.id === response.invoice.id ? response.invoice : item
        );
        const downloadedCount = nextItems.filter((item) => item.isDownloaded).length;
        const xmlDownloadedCount = nextItems.filter((item) => item.xmlDownloaded).length;
        const pdfDownloadedCount = nextItems.filter((item) => item.pdfDownloaded).length;

        return {
          ...currentPayload,
          meta: {
            ...currentPayload.meta,
            downloadedCount,
            pendingCount: nextItems.length - downloadedCount,
            xmlDownloadedCount,
            pdfDownloadedCount,
            lastPullAt: response.invoice.downloadedAt || currentPayload.meta.lastPullAt,
          },
          items: nextItems,
        };
      });
      setInvoiceFeedback(response.message || "NFe puxada com sucesso.");
    } catch {
      setInvoiceError("Nao foi possivel puxar essa NFe do Mercado Livre.");
    } finally {
      setBusyInvoiceId("");
    }
  }

  async function handleDownloadInvoiceDocument(invoiceId, format) {
    const busyKey = `${invoiceId}:${format}`;

    try {
      setDownloadingDocumentKey(busyKey);
      setInvoiceError("");
      const response = await downloadMercadoLivreInvoiceDocument(invoiceId, format);
      triggerFileDownload(response.fileName, response.blob);
      setInvoiceFeedback(
        format === "xml"
          ? "XML baixado no dispositivo."
          : "PDF / DANFE baixado no dispositivo."
      );
    } catch {
      setInvoiceError(
        format === "xml"
          ? "Nao foi possivel baixar o XML dessa NFe."
          : "Nao foi possivel baixar o PDF dessa NFe."
      );
    } finally {
      setDownloadingDocumentKey("");
    }
  }

  async function handleDismissInvoice(invoiceId) {
    try {
      setDismissingInvoiceId(invoiceId);
      setInvoiceError("");
      const response = await dismissMercadoLivreInvoice(invoiceId, selectedPeriod);
      setInvoicePayload(response);
      setInvoiceFeedback(response.message || "NFe removida da lista.");
    } catch {
      setInvoiceError("Nao foi possivel excluir essa NFe da lista.");
    } finally {
      setDismissingInvoiceId("");
    }
  }

  function handleRecurringExpenseFieldChange(event) {
    const { name, value } = event.target;

    setRecurringExpenseForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (recurringExpenseError) {
      setRecurringExpenseError("");
    }
  }

  async function handleCreateRecurringExpense(event) {
    event.preventDefault();

    const description = recurringExpenseForm.description.trim();
    const amount = parseRecurringAmount(recurringExpenseForm.value);
    const category = recurringExpenseForm.category.trim() || "Operacao";
    const dueDay = Number(recurringExpenseForm.dueDay);

    if (!description) {
      setRecurringExpenseError("Informe a descricao do gasto recorrente.");
      return;
    }

    if (amount <= 0) {
      setRecurringExpenseError("Informe um valor valido maior que zero.");
      return;
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      setRecurringExpenseError("Informe um dia de vencimento entre 1 e 31.");
      return;
    }

    try {
      setSavingRecurringExpense(true);
      setRecurringExpenseError("");
      setRecurringExpenseFeedback("");

      const response = await createRecurringFinanceExpense(
        {
          description,
          amount,
          category,
          dueDay,
        },
        selectedPeriod
      );

      setPayload(response);
      setRecurringExpenseForm((currentForm) => ({
        ...currentForm,
        description: "",
        value: "",
      }));
      setRecurringExpenseFeedback(
        response.message || "Despesa recorrente cadastrada com sucesso."
      );
    } catch (err) {
      setRecurringExpenseError(
        err.message || "Nao foi possivel cadastrar essa despesa recorrente."
      );
    } finally {
      setSavingRecurringExpense(false);
    }
  }

  async function handleRemoveRecurringExpense(expenseId) {
    try {
      setRemovingRecurringExpenseId(expenseId);
      setRecurringExpenseError("");
      setRecurringExpenseFeedback("");

      const response = await removeRecurringFinanceExpense(expenseId, selectedPeriod);
      setPayload(response);
      setRecurringExpenseFeedback(
        response.message || "Despesa recorrente removida com sucesso."
      );
    } catch (err) {
      setRecurringExpenseError(
        err.message || "Nao foi possivel remover essa despesa recorrente."
      );
    } finally {
      setRemovingRecurringExpenseId("");
    }
  }

  if (loading && !payload) {
    return <div className="screen-message">Carregando centro financeiro...</div>;
  }

  if (error && !payload) {
    return <div className="screen-message">{error}</div>;
  }

  const summaryCards = [
    { id: "inflow", label: "Entradas", value: formatCurrency(payload.summary.inflow) },
    { id: "outflow", label: "Saidas", value: formatCurrency(payload.summary.outflow) },
    { id: "net-profit", label: "Lucro liquido", value: formatCurrency(payload.summary.netProfit) },
    {
      id: "receivables",
      label: "Repasses a receber",
      value: formatCurrency(payload.summary.receivables),
    },
  ];
  const shouldScrollReceivables = payload.receivables.length > 6;
  const shouldScrollInvoices = (invoicePayload?.items?.length || 0) > 6;
  const shouldScrollRecurringExpenses = payload.recurringExpenses.length > 6;
  const actionableInsights = buildActionableInsights(payload, invoicePayload);
  const channelsByFeePercent = [...payload.feesByChannel].sort(
    (left, right) => toSafeNumber(right.feePercent) - toSafeNumber(left.feePercent)
  );
  const channelsByMargin = [...payload.feesByChannel].sort(
    (left, right) =>
      toSafeNumber(left.netMarginPercent) - toSafeNumber(right.netMarginPercent)
  );
  const highestFeeChannel = channelsByFeePercent[0] || null;
  const lowestMarginChannel = channelsByMargin[0] || null;
  const priorityChannelIds = new Set(
    [highestFeeChannel?.id, lowestMarginChannel?.id].filter(Boolean)
  );

  return (
    <div className="finance-page">
      <PageHeader
        tag="Financeiro"
        title="Centro financeiro"
        description="Fluxo de caixa, despesas recorrentes, repasses e leitura clara da rentabilidade operacional."
      >
        <div className="finance-header-actions">
          <div className="finance-period-switcher">
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
        </div>
      </PageHeader>

      {error ? <div className="finance-inline-alert">{error}</div> : null}

      <div className="finance-summary-grid">
        {summaryCards.map((card) => (
          <article key={card.id} className="finance-summary-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <InvoicesSection
        invoicePayload={invoicePayload}
        invoiceError={invoiceError}
        invoiceFeedback={invoiceFeedback}
        pullingAllInvoices={pullingAllInvoices}
        busyInvoiceId={busyInvoiceId}
        downloadingDocumentKey={downloadingDocumentKey}
        dismissingInvoiceId={dismissingInvoiceId}
        shouldScroll={shouldScrollInvoices}
        handlePullPendingInvoices={handlePullPendingInvoices}
        handlePullSingleInvoice={handlePullSingleInvoice}
        handleDownloadInvoiceDocument={handleDownloadInvoiceDocument}
        handleDismissInvoice={handleDismissInvoice}
      />

      <div className="finance-layout">
        <section className="panel finance-main-panel">
          <div className="finance-panel-header">
            <div>
              <h2>Fluxo de caixa</h2>
              <p>Entradas e saidas para decidir corte de custos e ritmo de investimento.</p>
            </div>
          </div>

          <div className="finance-cashflow-list">
            {payload.cashFlow.length ? (
              payload.cashFlow.map((row) => (
                <article key={row.id} className="finance-cashflow-item">
                  <div>
                    <strong>{row.label}</strong>
                    <p>Entradas {formatCurrency(row.inflow)}</p>
                  </div>
                  <div className="finance-cashflow-values">
                    <span>Saidas {formatCurrency(row.outflow)}</span>
                    <strong className={row.net >= 0 ? "is-positive" : "is-negative"}>
                      {formatCurrency(row.net)}
                    </strong>
                  </div>
                </article>
              ))
            ) : (
              <div className="finance-empty-state">
                <strong>Sem movimentacao de caixa no periodo.</strong>
                <p>
                  Sincronize pedidos e despesas ou amplie a janela para liberar leitura
                  financeira acionavel.
                </p>
              </div>
            )}
          </div>

          <div className="finance-bridge-grid">
            {payload.netProfitBridge.length ? (
              payload.netProfitBridge.map((item) => (
                <article key={item.id} className={`finance-bridge-card is-${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.amount)}</strong>
                </article>
              ))
            ) : (
              <div className="finance-empty-state">
                <strong>Sem composicao de lucro para exibir.</strong>
                <p>Quando houver base de receita e custo, esta visao destaca os principais impactos.</p>
              </div>
            )}
          </div>
        </section>

        <div className="finance-side-column">
          <section className="panel finance-side-panel">
            <div className="finance-panel-header">
              <div>
                <h2>Despesas recorrentes</h2>
                <p>Custos fixos que pedem revisao para proteger margem liquida.</p>
              </div>
            </div>

            <form className="finance-recurring-form" onSubmit={handleCreateRecurringExpense}>
              <label>
                <span>Descricao</span>
                <input
                  type="text"
                  name="description"
                  value={recurringExpenseForm.description}
                  onChange={handleRecurringExpenseFieldChange}
                  placeholder="Ex.: ERP fiscal"
                />
              </label>

              <label>
                <span>Valor mensal</span>
                <input
                  type="text"
                  name="value"
                  inputMode="decimal"
                  value={recurringExpenseForm.value}
                  onChange={handleRecurringExpenseFieldChange}
                  placeholder="0,00"
                />
              </label>

              <label>
                <span>Categoria</span>
                <input
                  type="text"
                  name="category"
                  value={recurringExpenseForm.category}
                  onChange={handleRecurringExpenseFieldChange}
                  placeholder="Operacao"
                />
              </label>

              <label>
                <span>Dia de vencimento</span>
                <input
                  type="number"
                  name="dueDay"
                  min="1"
                  max="31"
                  value={recurringExpenseForm.dueDay}
                  onChange={handleRecurringExpenseFieldChange}
                />
              </label>

              <button type="submit" disabled={savingRecurringExpense}>
                {savingRecurringExpense ? "Salvando..." : "Adicionar gasto fixo"}
              </button>
            </form>

            {recurringExpenseError ? (
              <div className="finance-inline-alert">{recurringExpenseError}</div>
            ) : null}

            {recurringExpenseFeedback ? (
              <div className="finance-inline-note">{recurringExpenseFeedback}</div>
            ) : null}

            <div
              className={`finance-list ui-scroll-region ${
                shouldScrollRecurringExpenses ? "is-scrollable scroll-region-medium" : ""
              }`}
            >
              {payload.recurringExpenses.length ? (
                payload.recurringExpenses.map((expense) => (
                  <div key={expense.id} className="finance-list-item">
                    <div>
                      <strong>{expense.description}</strong>
                      <p>
                        {expense.category} | vence em {formatDate(expense.nextCharge)}
                      </p>
                    </div>
                    <div className="finance-list-values">
                      <span>{expense.status}</span>
                      <strong>{formatCurrency(expense.amount)}</strong>
                      <button
                        type="button"
                        className="finance-recurring-remove"
                        onClick={() => handleRemoveRecurringExpense(expense.id)}
                        disabled={removingRecurringExpenseId === expense.id}
                      >
                        {removingRecurringExpenseId === expense.id
                          ? "Removendo..."
                          : "Remover gasto"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="finance-empty-state">
                  <strong>Nenhuma despesa recorrente cadastrada.</strong>
                  <p>
                    Cadastre custos fixos principais para acompanhar impacto no lucro e
                    evitar surpresas no fechamento.
                  </p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

      <ReceivablesSection
        receivables={payload.receivables}
        shouldScroll={shouldScrollReceivables}
      />

      <div className="finance-secondary-grid">
        <section className="panel finance-channel-panel">
          <div className="finance-panel-header">
            <div>
              <h2>Taxa por canal</h2>
              <p>Use esta leitura para decidir onde preservar margem antes de escalar.</p>
            </div>
          </div>

          {payload.feesByChannel.length ? (
            <>
              <div className="finance-channel-priority-grid">
                <article className="finance-channel-priority-card">
                  <span>Maior taxa no periodo</span>
                  <strong>{highestFeeChannel?.channel || "--"}</strong>
                  <p>
                    {highestFeeChannel
                      ? `${formatPercent(
                          highestFeeChannel.feePercent
                        )} da receita desse canal virou taxa.`
                      : "Sem base suficiente para comparar taxa por canal."}
                  </p>
                </article>

                <article className="finance-channel-priority-card is-warning">
                  <span>Menor margem liquida</span>
                  <strong>{lowestMarginChannel?.channel || "--"}</strong>
                  <p>
                    {lowestMarginChannel
                      ? `${formatPercent(
                          lowestMarginChannel.netMarginPercent
                        )} de margem. Revise preco e custo antes de aumentar investimento.`
                      : "Sem base suficiente para comparar margem por canal."}
                  </p>
                </article>
              </div>

              <div className="finance-channel-list">
                {payload.feesByChannel.map((channel) => (
                  <article
                    key={channel.id}
                    className={`finance-channel-card ${
                      priorityChannelIds.has(channel.id) ? "is-priority" : ""
                    }`}
                  >
                    <strong>{channel.channel}</strong>
                    <span>Taxas {formatCurrency(channel.feeAmount)}</span>
                    <p>{formatPercent(channel.feePercent)} sobre a receita</p>
                    <div className="finance-channel-footnote">
                      <span>Margem liquida</span>
                      <strong>{formatPercent(channel.netMarginPercent)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="finance-empty-state">
              <strong>Taxa por canal sem dados suficientes.</strong>
              <p>
                Sincronize pedidos do periodo ou amplie o recorte para comparar custo
                de marketplace e margem liquida com seguranca.
              </p>
            </div>
          )}
        </section>

        <section className="panel finance-insights-panel">
          <div className="finance-panel-header">
            <div>
              <h2>Leituras para agir</h2>
              <p>Prioridades praticas para agir hoje e proteger resultado financeiro.</p>
            </div>
          </div>

          <div className="finance-insight-list">
            {actionableInsights.length ? (
              actionableInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`finance-insight-item is-${insight.tone}`}
                >
                  <div className={`finance-insight-dot is-${insight.tone}`} />
                  <div>
                    <strong>{insight.title}</strong>
                    <p>{insight.description}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="finance-empty-state">
                <strong>Sem leitura acionavel no momento.</strong>
                <p>
                  Mantenha pedidos, despesas e repasses sincronizados para liberar
                  orientacoes praticas desta secao.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

    </div>
  );
}

export default FinanceCenter;
