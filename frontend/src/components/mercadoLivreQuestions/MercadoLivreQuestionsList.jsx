import MercadoLivreQuestionThumbnail from "./MercadoLivreQuestionThumbnail";
import {
  formatQuestionDate,
  formatQuestionSyncLabel,
  truncateQuestionText,
} from "../../utils/mercadoLivreQuestions";

function getQuestionPriority(question) {
  if (question.isAnswered) {
    return {
      tone: "resolved",
      label: "Concluida",
      action: truncateQuestionText(question.answerText, 92),
    };
  }

  if (question.isUrgent) {
    return {
      tone: "urgent",
      label: "Prioridade alta",
      action: "Atenda agora para reduzir risco de impacto em conversao e reputacao.",
    };
  }

  if (question.needsAttention) {
    return {
      tone: "attention",
      label: "Em atencao",
      action: "Responder hoje evita atraso de SLA e escalonamento da fila.",
    };
  }

  return {
    tone: "pending",
    label: "Na fila",
    action: "Mantenha respostas objetivas para preservar ritmo operacional.",
  };
}

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
  const unansweredCount = questions.filter((question) => !question.isAnswered).length;
  const urgentCount = questions.filter((question) => question.isUrgent).length;
  const attentionCount = questions.filter(
    (question) => !question.isAnswered && !question.isUrgent && question.needsAttention
  ).length;
  const resolvedCount = questions.filter((question) => question.isAnswered).length;
  const queueTone =
    urgentCount > 0
      ? "critical"
      : attentionCount > 0
        ? "attention"
        : unansweredCount > 0
          ? "pending"
          : "stable";

  return (
    <section className="panel ml-questions-list-panel">
      <div className="ml-questions-panel-header">
        <div>
          <h2>Perguntas recebidas</h2>
          <p>
            {hasQuestions
              ? `${filteredTotal} pergunta(s) visiveis. ${urgentCount} urgente(s) e ${attentionCount} em atencao no recorte atual.`
              : "Acompanhe a fila recente de perguntas e mantenha o atendimento dentro do SLA."}
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

      {hasQuestions ? (
        <div className={`ml-questions-operational-strip is-${queueTone}`}>
          <span className="ml-questions-operational-kicker">
            Fila operacional | {formatQuestionSyncLabel(lastSyncAt)}
          </span>

          <div className="ml-questions-operational-chips">
            <span className="ml-questions-operational-chip is-critical">
              {urgentCount} urgente(s)
            </span>
            <span className="ml-questions-operational-chip is-attention">
              {attentionCount} em atencao
            </span>
            <span className="ml-questions-operational-chip is-pending">
              {unansweredCount} pendente(s)
            </span>
            <span className="ml-questions-operational-chip is-resolved">
              {resolvedCount} respondida(s)
            </span>
          </div>
        </div>
      ) : null}

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
          <strong>Nao foi possivel atualizar a fila de perguntas.</strong>
          <p>
            Verifique integracao, conexao e filtros aplicados. Depois atualize a
            lista para retomar o atendimento.
          </p>
          <div className="ml-questions-empty-actions">
            <button type="button" onClick={onRetry}>
              Atualizar fila
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !error && !hasQuestions ? (
        <div className="ml-questions-empty-state">
          <strong>Nenhuma pergunta encontrada para este recorte.</strong>
          <p>
            Revise filtros, amplie o periodo ou atualize os dados para voltar a
            visualizar a fila operacional de atendimento.
          </p>
          <div className="ml-questions-empty-actions">
            <button type="button" onClick={onClearFilters}>
              Limpar filtros
            </button>
            <button type="button" onClick={onRetry}>
              Atualizar fila
            </button>
          </div>
        </div>
      ) : null}

      {hasQuestions ? (
        <div
          className={`ml-questions-list ui-scroll-region ${
            refreshing ? "is-refreshing" : ""
          } ${shouldScrollQuestions ? "is-scrollable scroll-region-tall" : ""}`.trim()}
        >
          {questions.map((question) => {
            const priority = getQuestionPriority(question);

            return (
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
                      <div className="ml-questions-list-item-title-line">
                        <strong>{question.itemTitle}</strong>
                        <span className={`ml-questions-priority-pill is-${priority.tone}`}>
                          {priority.label}
                        </span>
                      </div>
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

                <div className={`ml-questions-list-item-footnote is-${priority.tone}`}>
                  {question.isAnswered ? (
                    <>
                      <strong>Respondida em {question.answerDelayLabel}</strong>
                      <span>{priority.action}</span>
                    </>
                  ) : (
                    <>
                      <strong>Em aberto ha {question.openDurationLabel}</strong>
                      <span>{priority.action}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default MercadoLivreQuestionsList;
