function FeedbackProfilePanel({ seller }) {
  return (
    <section className="panel feedback-profile-panel">
      <div className="feedback-panel-header">
        <div>
          <h2>Contexto do remetente</h2>
          <p>Dados da sua conta autenticada para rastreabilidade do envio.</p>
        </div>
      </div>

      <div className="feedback-profile-card">
        <strong>{seller?.company || "Operacao atual"}</strong>
        <span>{seller?.name || "--"}</span>
        <span>{seller?.email || "--"}</span>
      </div>
    </section>
  );
}

export default FeedbackProfilePanel;
