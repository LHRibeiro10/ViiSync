import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
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
  formatDateTime,
  formatPercent,
} from "../utils/presentation";
import "./FinanceCenter.css";

function triggerDocumentDownload(blob, fileName) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

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
      triggerDocumentDownload(response.blob, response.fileName);
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

  const receivablesSection = (
    <section className="panel finance-receivables-panel">
      <div className="finance-panel-header">
        <div>
          <h2>Repasses a receber</h2>
          <p>Movimentos esperados para aliviar o caixa de curto prazo.</p>
        </div>
      </div>

      <div
        className={`finance-receivables-grid ui-scroll-region ${
          shouldScrollReceivables ? "is-scrollable scroll-region-medium" : ""
        }`}
      >
        {payload.receivables.map((item) => (
          <div key={item.id} className="finance-list-item finance-receivable-card">
            <div>
              <strong>{item.marketplace}</strong>
              <p>{formatDate(item.expectedAt)}</p>
            </div>
            <div className="finance-list-values">
              <span>{item.status}</span>
              <strong>{formatCurrency(item.amount)}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const invoicesSection = (
    <section className="panel finance-invoices-panel">
      <div className="finance-panel-header">
        <div>
          <h2>NFes Mercado Livre</h2>
          <p>
            Acompanhe NFes sincronizadas do canal Mercado Livre e mantenha os
            documentos fiscais da operacao organizados.
          </p>
        </div>

        <div className="finance-invoices-actions">
          <button
            type="button"
            className="finance-invoices-primary"
            onClick={handlePullPendingInvoices}
            disabled={pullingAllInvoices || !invoicePayload?.meta?.pendingCount}
          >
            {pullingAllInvoices ? "Puxando NFes..." : "Puxar NFes nao baixadas"}
          </button>
        </div>
      </div>

      {invoiceError ? <div className="finance-inline-alert">{invoiceError}</div> : null}

      {invoiceFeedback ? (
        <div className="finance-inline-note">{invoiceFeedback}</div>
      ) : null}

      <div className="finance-invoices-summary-grid">
        <article className="finance-invoice-summary-card">
          <span>NFes no periodo</span>
          <strong>{invoicePayload?.meta?.total ?? 0}</strong>
        </article>
        <article className="finance-invoice-summary-card">
          <span>XMLs disponiveis</span>
          <strong>{invoicePayload?.meta?.xmlDownloadedCount ?? 0}</strong>
        </article>
        <article className="finance-invoice-summary-card">
          <span>PDFs disponiveis</span>
          <strong>{invoicePayload?.meta?.pdfDownloadedCount ?? 0}</strong>
        </article>
        <article className="finance-invoice-summary-card">
          <span>Nao baixadas</span>
          <strong>{invoicePayload?.meta?.pendingCount ?? 0}</strong>
        </article>
      </div>

      <div className="finance-invoice-sync-note">
        <span>Ultimo pull</span>
        <strong>
          {invoicePayload?.meta?.lastPullAt
            ? formatDateTime(invoicePayload.meta.lastPullAt)
            : "--"}
        </strong>
      </div>

      <div
        className={`finance-invoice-list ui-scroll-region ${
          shouldScrollInvoices ? "is-scrollable scroll-region-tall" : ""
        }`}
      >
        {invoicePayload?.items?.length ? (
          invoicePayload.items.map((invoice) => (
            <article key={invoice.id} className="finance-invoice-item">
              <div className="finance-invoice-main">
                <div className="finance-invoice-title-row">
                  <strong>{invoice.itemTitle}</strong>
                  <span className={`finance-invoice-badge is-${invoice.statusTone}`}>
                    {invoice.statusLabel}
                  </span>
                </div>

                <p>
                  NFe {invoice.invoiceNumber} | serie {invoice.series} | pedido{" "}
                  {invoice.orderId}
                </p>

                <div className="finance-invoice-meta">
                  <span>Emitida em {formatDateTime(invoice.issuedAt)}</span>
                  <span>Valor {formatCurrency(invoice.amount)}</span>
                  <span>Chave {invoice.accessKey}</span>
                </div>

                <div className="finance-invoice-documents">
                  <div className="finance-invoice-document">
                    <span>XML oficial</span>
                    <strong>{invoice.xmlStatusLabel}</strong>
                    <small>
                      {invoice.downloadedXmlAt
                        ? `Baixado em ${formatDateTime(invoice.downloadedXmlAt)}`
                        : "Ainda nao baixado"}
                    </small>
                  </div>

                  <div className="finance-invoice-document">
                    <span>PDF / DANFE</span>
                    <strong>{invoice.pdfStatusLabel}</strong>
                    <small>
                      {invoice.downloadedPdfAt
                        ? `Disponivel em ${formatDateTime(invoice.downloadedPdfAt)}`
                        : "Sera gerado quando o documento for puxado"}
                    </small>
                  </div>
                </div>
              </div>

              <div className="finance-invoice-actions">
                <div className="finance-invoice-file-group">
                  <span className="finance-invoice-file">
                    XML: {invoice.xmlUrl || "pendente"}
                  </span>
                  <span className="finance-invoice-file">
                    PDF: {invoice.pdfUrl || "pendente"}
                  </span>
                  <span className="finance-invoice-file">
                    Storage: {invoice.storagePath}
                  </span>
                </div>

                <div className="finance-invoice-download-group">
                  <button
                    type="button"
                    className="finance-invoices-download"
                    onClick={() => handleDownloadInvoiceDocument(invoice.id, "xml")}
                    disabled={
                      !invoice.xmlDownloaded ||
                      downloadingDocumentKey === `${invoice.id}:xml`
                    }
                  >
                    {downloadingDocumentKey === `${invoice.id}:xml`
                      ? "Baixando XML..."
                      : "Baixar XML"}
                  </button>

                  <button
                    type="button"
                    className="finance-invoices-download"
                    onClick={() => handleDownloadInvoiceDocument(invoice.id, "pdf")}
                    disabled={
                      !invoice.pdfDownloaded ||
                      downloadingDocumentKey === `${invoice.id}:pdf`
                    }
                  >
                    {downloadingDocumentKey === `${invoice.id}:pdf`
                      ? "Baixando PDF..."
                      : "Baixar PDF"}
                  </button>
                </div>

                <button
                  type="button"
                  className="finance-invoices-secondary"
                  onClick={() => handlePullSingleInvoice(invoice.id)}
                  disabled={!invoice.canPull || busyInvoiceId === invoice.id}
                >
                  {busyInvoiceId === invoice.id
                    ? "Puxando..."
                    : invoice.canPull
                      ? "Puxar NFe"
                      : "Ja baixada"}
                </button>

                {invoice.canDismiss ? (
                  <button
                    type="button"
                    className="finance-invoices-danger"
                    onClick={() => handleDismissInvoice(invoice.id)}
                    disabled={dismissingInvoiceId === invoice.id}
                  >
                    {dismissingInvoiceId === invoice.id
                      ? "Excluindo..."
                      : "Excluir da lista"}
                  </button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="finance-empty-state">
            Nenhuma NFe do Mercado Livre encontrada para o recorte atual.
          </div>
        )}
      </div>
    </section>
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

      {invoicesSection}

      <div className="finance-layout">
        <section className="panel finance-main-panel">
          <div className="finance-panel-header">
            <div>
              <h2>Fluxo de caixa</h2>
              <p>Entradas, saidas e saldo por janela operacional.</p>
            </div>
          </div>

          <div className="finance-cashflow-list">
            {payload.cashFlow.map((row) => (
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
            ))}
          </div>

          <div className="finance-bridge-grid">
            {payload.netProfitBridge.map((item) => (
              <article key={item.id} className={`finance-bridge-card is-${item.tone}`}>
                <span>{item.label}</span>
                <strong>{formatCurrency(item.amount)}</strong>
              </article>
            ))}
          </div>
        </section>

        <div className="finance-side-column">
          <section className="panel finance-side-panel">
            <div className="finance-panel-header">
              <div>
                <h2>Despesas recorrentes</h2>
                <p>Custos fixos que pressionam o lucro do periodo.</p>
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
                  Nenhuma despesa recorrente cadastrada ainda.
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

      {receivablesSection}

      <div className="finance-secondary-grid">
        <section className="panel finance-channel-panel">
          <div className="finance-panel-header">
            <div>
              <h2>Taxa por canal</h2>
              <p>Compare custo de marketplace com margem liquida por canal.</p>
            </div>
          </div>

          <div className="finance-channel-list">
            {payload.feesByChannel.map((channel) => (
              <article key={channel.id} className="finance-channel-card">
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
        </section>

        <section className="panel finance-insights-panel">
          <div className="finance-panel-header">
            <div>
              <h2>Leituras para agir</h2>
              <p>Resumo em linguagem direta do que merece atencao financeira.</p>
            </div>
          </div>

          <div className="finance-insight-list">
            {payload.insights.map((insight, index) => (
              <div key={`${insight}-${index}`} className="finance-insight-item">
                <div className="finance-insight-dot" />
                <p>{insight}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

    </div>
  );
}

export default FinanceCenter;
