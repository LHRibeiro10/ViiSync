function SmartSummarySection({
  syncFreshnessLabel,
  summaryActionHandler,
  summaryActionLabel,
  summaryActionDisabled,
  smartSummaryInsights,
}) {
  return (
    <section className="dashboard-smart-summary">
      <div className="dashboard-smart-summary-header">
        <div>
          <span className="dashboard-smart-summary-tag">Leitura operacional</span>
          <h2>Resumo inteligente do dia</h2>
          <p>Ate 3 sinais priorizados para apoiar decisoes rapidas no dashboard.</p>
        </div>

        <div className="dashboard-smart-summary-actions">
          <small>{syncFreshnessLabel}</small>
          <button
            type="button"
            className="panel-link"
            onClick={summaryActionHandler}
            disabled={summaryActionDisabled}
          >
            {summaryActionLabel}
          </button>
        </div>
      </div>

      <div className="dashboard-smart-summary-list">
        {smartSummaryInsights.map((insight) => (
          <article key={insight.id} className={`dashboard-smart-summary-item ${insight.tone}`}>
            <strong>{insight.title}</strong>
            <p>{insight.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default SmartSummarySection;
