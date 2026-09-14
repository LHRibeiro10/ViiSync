function DashboardAttentionSection({ visibleAttentionItems }) {
  return (
    <section className="dashboard-attention-block">
      <div className="dashboard-attention-header">
        <div>
          <span className="dashboard-smart-summary-tag">Prioridade de ajuste</span>
          <h2>Produtos que precisam de atencao</h2>
          <p>Foque primeiro nos itens com risco de margem, lucro ou qualidade de dados.</p>
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

              <button type="button" className="panel-link" onClick={item.action}>
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
  );
}

export default DashboardAttentionSection;
