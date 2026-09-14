import { formatCurrency, formatDateTime } from "../../utils/presentation";

function InvoicesSection({
  invoicePayload,
  invoiceError,
  invoiceFeedback,
  pullingAllInvoices,
  busyInvoiceId,
  downloadingDocumentKey,
  dismissingInvoiceId,
  shouldScroll,
  handlePullPendingInvoices,
  handlePullSingleInvoice,
  handleDownloadInvoiceDocument,
  handleDismissInvoice,
}) {
  return (
    <section className="panel finance-invoices-panel">
      <div className="finance-panel-header">
        <div>
          <h2>NFes Mercado Livre</h2>
          <p>
            Garanta XML e PDF disponiveis para fechamento contabil, suporte ao cliente
            e rotina fiscal sem retrabalho.
          </p>
        </div>

        <div className="finance-invoices-actions">
          <button
            type="button"
            className="finance-invoices-primary"
            onClick={handlePullPendingInvoices}
            disabled={pullingAllInvoices || !invoicePayload?.meta?.pendingCount}
          >
            {pullingAllInvoices ? "Atualizando NFes..." : "Atualizar NFes pendentes"}
          </button>
        </div>
      </div>

      {invoiceError ? <div className="finance-inline-alert">{invoiceError}</div> : null}

      {invoiceFeedback ? (
        <div className="finance-inline-note">{invoiceFeedback}</div>
      ) : null}

      <div className="finance-invoices-summary-grid">
        <article className="finance-invoice-summary-card">
          <span>Documentos no periodo</span>
          <strong>{invoicePayload?.meta?.total ?? 0}</strong>
        </article>
        <article className="finance-invoice-summary-card">
          <span>XML pronto para fechamento</span>
          <strong>{invoicePayload?.meta?.xmlDownloadedCount ?? 0}</strong>
        </article>
        <article className="finance-invoice-summary-card">
          <span>PDF pronto para consulta</span>
          <strong>{invoicePayload?.meta?.pdfDownloadedCount ?? 0}</strong>
        </article>
        <article className="finance-invoice-summary-card">
          <span>Pendentes de pull</span>
          <strong>{invoicePayload?.meta?.pendingCount ?? 0}</strong>
        </article>
      </div>

      <div className="finance-invoice-sync-note">
        <div>
          <span>Ultima atualizacao fiscal</span>
          <strong>
            {invoicePayload?.meta?.lastPullAt
              ? formatDateTime(invoicePayload.meta.lastPullAt)
              : "--"}
          </strong>
        </div>
        <p>
          {(invoicePayload?.meta?.pendingCount || 0) > 0
            ? `${invoicePayload.meta.pendingCount} pendencia(s) ativa(s). Execute o pull para regularizar os documentos.`
            : "Sem pendencias abertas no momento para o periodo selecionado."}
        </p>
      </div>

      <div
        className={`finance-invoice-list ui-scroll-region ${
          shouldScroll ? "is-scrollable scroll-region-tall" : ""
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
                    <span>XML para contabil</span>
                    <strong>{invoice.xmlStatusLabel}</strong>
                    <small>
                      {invoice.downloadedXmlAt
                        ? `Disponivel desde ${formatDateTime(invoice.downloadedXmlAt)}`
                        : "Puxe esta NFe para liberar o XML do fechamento."}
                    </small>
                  </div>

                  <div className="finance-invoice-document">
                    <span>PDF para conferencia</span>
                    <strong>{invoice.pdfStatusLabel}</strong>
                    <small>
                      {invoice.downloadedPdfAt
                        ? `Disponivel desde ${formatDateTime(invoice.downloadedPdfAt)}`
                        : "Gere no pull para consulta rapida e atendimento."}
                    </small>
                  </div>
                </div>
              </div>

              <div className="finance-invoice-actions">
                <div className="finance-invoice-file-group">
                  <span className="finance-invoice-file">
                    XML no storage: {invoice.xmlUrl || "pendente"}
                  </span>
                  <span className="finance-invoice-file">
                    PDF no storage: {invoice.pdfUrl || "pendente"}
                  </span>
                  <span className="finance-invoice-file">
                    Referencia interna: {invoice.storagePath}
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
            <strong>Nenhuma NFe do Mercado Livre neste recorte.</strong>
            <p>
              Revise o periodo selecionado ou atualize NFes pendentes para manter os
              documentos fiscais prontos para operacao.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default InvoicesSection;
