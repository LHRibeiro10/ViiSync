import { feedbackStatusOptions, feedbackTypeOptions, formatFeedbackDateTime, formatFeedbackRelativeTime } from "../../utils/feedback";
import { getHistoryFollowUpCopy } from "../../utils/feedbackCenterInsights";

function FeedbackHistoryPanel({
  pendingCount,
  latestFeedbackItem,
  filters,
  onFiltersChange,
  loading,
  error,
  items,
  shouldScrollFeedbackHistory,
}) {
  return (
    <section className="panel feedback-history-panel">
      <div className="feedback-panel-header">
        <div>
          <h2>Historico recente</h2>
          <p>Acompanhe retorno oficial do time e o andamento de cada envio.</p>
        </div>
      </div>

      <div className="feedback-history-priority">
        <div>
          <strong>
            {pendingCount
              ? `${pendingCount} envio(s) aguardando andamento`
              : "Sem pendencias abertas no momento"}
          </strong>
          <p>
            {pendingCount
              ? "Priorize acompanhar itens em aberto para manter alinhamento com o time."
              : "Se precisar, registre novo envio para abrir comunicacao oficial com o time."}
          </p>
        </div>
        <span>
          {latestFeedbackItem
            ? `Ultimo envio ${formatFeedbackRelativeTime(latestFeedbackItem.createdAt)}`
            : "Nenhum envio recente"}
        </span>
      </div>

      <div className="feedback-history-filters">
        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange((currentValue) => ({
              ...currentValue,
              status: event.target.value,
            }))
          }
        >
          {feedbackStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(event) =>
            onFiltersChange((currentValue) => ({
              ...currentValue,
              type: event.target.value,
            }))
          }
        >
          <option value="all">Todos os tipos</option>
          {feedbackTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="feedback-empty-state">
          <strong>Carregando historico...</strong>
        </div>
      ) : error ? (
        <div className="feedback-empty-state is-error">
          <strong>Falha ao carregar</strong>
          <p>{error}</p>
        </div>
      ) : items?.length ? (
        <div
          className={`feedback-history-list ui-scroll-region ${
            shouldScrollFeedbackHistory ? "is-scrollable scroll-region-medium" : ""
          }`}
        >
          {items.map((item, index) => (
            <article
              key={item.id}
              className={`feedback-history-card is-${item.statusTone} ${
                index === 0 ? "is-latest" : ""
              }`}
            >
              <div className="feedback-history-topline">
                <div className="feedback-badge-row">
                  {index === 0 ? (
                    <span className="feedback-latest-chip">Mais recente</span>
                  ) : null}
                  <span className={`feedback-badge is-${item.priorityTone}`}>
                    {item.priorityLabel}
                  </span>
                  <span className={`feedback-badge is-${item.statusTone}`}>
                    {item.statusLabel}
                  </span>
                </div>
                <small>{formatFeedbackRelativeTime(item.createdAt)}</small>
              </div>

              <strong>{item.subject}</strong>
              <p>{item.message}</p>

              <div className="feedback-history-meta">
                <span>{item.typeLabel}</span>
                <span>{item.areaLabel}</span>
                <span>{formatFeedbackDateTime(item.createdAt)}</span>
              </div>

              <div className="feedback-history-followup">
                <strong>Proximo acompanhamento</strong>
                <p>{getHistoryFollowUpCopy(item)}</p>
              </div>

              {item.adminResponse || item.resolutionEta ? (
                <div className="feedback-admin-response">
                  <strong>Atualizacao do time</strong>
                  {item.adminResponse ? <p>{item.adminResponse}</p> : null}
                  {item.resolutionEta ? (
                    <span>
                      Previsao informada: {formatFeedbackDateTime(item.resolutionEta)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="feedback-empty-state">
          <strong>Nenhum envio ainda</strong>
          <p>
            Seus proximos envios aparecerao neste historico com status,
            prioridade e retorno oficial do time.
          </p>
        </div>
      )}
    </section>
  );
}

export default FeedbackHistoryPanel;
