import MercadoLivreQuestionThumbnail from "./MercadoLivreQuestionThumbnail";
import {
  formatQuestionDate,
  formatQuestionSyncLabel,
  truncateQuestionText,
} from "../../utils/mercadoLivreQuestions";

function MercadoLivreQuestionsList({
  questions,
  selectedQuestionId,
  loading,
  refreshing,
  error,
  lastSyncAt,
  filteredTotal,
  dismissAnsweredDisabled,
  dismissAnsweredLoading,
  onDismissAnswered,
  onSelectQuestion,
  onRetry,
  onClearFilters,
}) {
  const hasQuestions = questions.length > 0;
  const shouldScrollQuestions = questions.length > 6;

  return (
    <section className="panel ml-questions-list-panel">
      <div className="ml-questions-panel-header">
        <div>
          <h2>Perguntas recebidas</h2>
          <p>
            {hasQuestions
              ? `${filteredTotal} pergunta(s) no recorte atual. ${formatQuestionSyncLabel(
                  lastSyncAt
                )}.`
              : "Acompanhe o historico recente de perguntas recebidas nos anuncios."}
          </p>
        </div>

        <div className="ml-questions-list-actions">
          <button
            type="button"
            className="ml-questions-secondary-button"
            onClick={onDismissAnswered}
            disabled={dismissAnsweredDisabled}
          >
            {dismissAnsweredLoading ? "Limpando..." : "Ocultar respondidas"}
          </button>

          {refreshing ? (
            <span className="ml-questions-panel-chip">Atualizando...</span>
          ) : null}
        </div>
      </div>

      {error && hasQuestions ? (
        <div className="ml-questions-inline-alert is-error">{error}</div>
      ) : null}

      {loading && !hasQuestions ? (
        <div className="ml-questions-list-skeleton">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="ml-questions-skeleton-card" />
          ))}
        </div>
      ) : null}

      {!loading && error && !hasQuestions ? (
        <div className="ml-questions-empty-state is-error">
          <strong>Nao foi possivel carregar as perguntas.</strong>
          <p>Verifique o backend local e tente buscar novamente.</p>
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!loading && !error && !hasQuestions ? (
        <div className="ml-questions-empty-state">
          <strong>Nenhuma pergunta encontrada com os filtros atuais.</strong>
          <p>Ajuste o recorte para voltar a visualizar a fila de atendimento.</p>
          <button type="button" onClick={onClearFilters}>
            Limpar filtros
          </button>
        </div>
      ) : null}

      {hasQuestions ? (
        <div
          className={`ml-questions-list ui-scroll-region ${
            refreshing ? "is-refreshing" : ""
          } ${shouldScrollQuestions ? "is-scrollable scroll-region-tall" : ""}`.trim()}
        >
          {questions.map((question) => (
            <button
              key={question.id}
              type="button"
              className={`ml-questions-list-item ${
                selectedQuestionId === question.id ? "is-selected" : ""
              } ${question.isAnswered ? "is-answered" : "is-pending"} ${
                question.isUrgent ? "is-urgent" : ""
              }`}
              onClick={() => onSelectQuestion(question.id)}
            >
              <div className="ml-questions-list-item-top">
                <MercadoLivreQuestionThumbnail
                  title={question.itemTitle}
                  thumbnail={question.thumbnail}
                  alt={question.itemTitle}
                />

                <div className="ml-questions-list-item-copy">
                  <div className="ml-questions-list-item-title-row">
                    <strong>{question.itemTitle}</strong>
                    <span>{question.itemId}</span>
                  </div>

                  <div className="ml-questions-badge-row">
                    <span
                      className={`ml-questions-badge is-${question.statusTone}`}
                    >
                      {question.statusLabel}
                    </span>

                    {question.isUrgent ? (
                      <span className="ml-questions-badge is-urgent-soft">
                        Urgente
                      </span>
                    ) : question.needsAttention ? (
                      <span className="ml-questions-badge is-attention">
                        Em atencao
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="ml-questions-list-item-question">
                {truncateQuestionText(question.questionText)}
              </p>

              <div className="ml-questions-list-item-meta">
                <span>{question.buyerNickname || "Cliente Mercado Livre"}</span>
                <span>{question.sku || "Sem SKU"}</span>
                <span>{formatQuestionDate(question.createdAt)}</span>
              </div>

              <div className="ml-questions-list-item-footnote">
                {question.isAnswered ? (
                  <>
                    <strong>Respondida em {question.answerDelayLabel}</strong>
                    <span>{truncateQuestionText(question.answerText, 92)}</span>
                  </>
                ) : (
                  <>
                    <strong>Em aberto ha {question.openDurationLabel}</strong>
                    <span>Priorize esse atendimento para preservar conversao.</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default MercadoLivreQuestionsList;
