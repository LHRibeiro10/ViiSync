import { formatDateTime } from "../../utils/presentation";

function IntegrationsEventsPanel({ syncEvents, actionLoading, onRefreshToken }) {
  return (
    <section className="panel integrations-side-panel">
      <div className="integrations-panel-header">
        <div>
          <h2>Eventos recentes</h2>
          <p>Registro recente de status com foco em seguranca e continuidade da sync.</p>
        </div>
        <button
          type="button"
          className="integrations-text-button"
          onClick={onRefreshToken}
          disabled={actionLoading}
        >
          Renovar token
        </button>
      </div>

      <div className="integrations-side-list">
        {syncEvents.length ? (
          syncEvents.map((event) => (
            <article
              key={event.id}
              className={`integrations-side-card integrations-event-card is-${event.tone}`}
            >
              <strong>{event.title}</strong>
              <p>
                {event.source} | Status: {event.syncStatusLabel}
              </p>
              <p className="integrations-event-copy">
                <strong>Leitura:</strong> {event.statusCopy}
              </p>
              <p className="integrations-event-copy">
                <strong>Acao recomendada:</strong> {event.recommendation}
              </p>
              <span>{formatDateTime(event.createdAt)}</span>
            </article>
          ))
        ) : (
          <article className="integrations-side-card">
            <strong>Nenhum evento recente</strong>
            <p>Sem registros operacionais no recorte atual.</p>
            <span>Atualize a integracao para gerar novo checkpoint.</span>
          </article>
        )}
      </div>
    </section>
  );
}

export default IntegrationsEventsPanel;
