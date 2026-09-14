import { formatCurrency, formatDate } from "../../utils/presentation";

function ReceivablesSection({ receivables, shouldScroll }) {
  return (
    <section className="panel finance-receivables-panel">
      <div className="finance-panel-header">
        <div>
          <h2>Repasses a receber</h2>
          <p>Projecoes de entrada para sustentar o caixa de curto prazo.</p>
        </div>
      </div>

      <div
        className={`finance-receivables-grid ui-scroll-region ${
          shouldScroll ? "is-scrollable scroll-region-medium" : ""
        }`}
      >
        {receivables.length ? (
          receivables.map((item) => (
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
          ))
        ) : (
          <div className="finance-empty-state">
            <strong>Nenhum repasse previsto no periodo.</strong>
            <p>Amplie o recorte ou sincronize pedidos para projetar melhor seu caixa.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default ReceivablesSection;
