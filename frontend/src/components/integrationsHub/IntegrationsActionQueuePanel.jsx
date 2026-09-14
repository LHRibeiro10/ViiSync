function IntegrationsActionQueuePanel({ queueActions, actionLoading, onActionFromQueue }) {
  return (
    <section className="panel integrations-side-panel">
      <div className="integrations-panel-header">
        <div>
          <h2>Fila de acoes</h2>
          <p>Pendencias ordenadas por prioridade com o proximo passo esperado.</p>
        </div>
      </div>

      <div className="integrations-side-list">
        {queueActions.length ? (
          queueActions.map((action) => (
            <article
              key={action.id}
              className={`integrations-side-card integrations-action-card is-${action.priorityTone}`}
            >
              <div className="integrations-action-head">
                <strong>{action.title}</strong>
                <span className={`integrations-action-priority is-${action.priorityTone}`}>
                  {action.priorityLabel}
                </span>
              </div>
              <p>{action.description}</p>
              <p className="integrations-action-copy">
                <strong>Proximo passo:</strong> {action.nextStep}
              </p>
              <p className="integrations-action-copy">
                <strong>Resultado esperado:</strong> {action.expectedResult}
              </p>
              <button
                type="button"
                className="integrations-text-button"
                onClick={() => onActionFromQueue(action)}
                disabled={actionLoading || !action.actionable}
              >
                {action.ctaLabel}
              </button>
            </article>
          ))
        ) : (
          <article className="integrations-side-card">
            <strong>Sem acoes pendentes</strong>
            <p>Fila operacional vazia para este momento.</p>
            <span>Mantenha monitoramento diario da conta conectada.</span>
          </article>
        )}
      </div>
    </section>
  );
}

export default IntegrationsActionQueuePanel;
