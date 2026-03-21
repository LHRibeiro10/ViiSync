import { useEffect, useState } from "react";
import MercadoLivreQuestionThumbnail from "./MercadoLivreQuestionThumbnail";
import { formatQuestionDate } from "../../utils/mercadoLivreQuestions";

function MercadoLivreQuestionDetails({
  question,
  loading,
  error,
  replyDraft,
  replyFeedback,
  onReplyDraftChange,
  onUseSuggestedReply,
  onSubmitReply,
  onRetry,
  replyLoading,
}) {
  const [copyFeedback, setCopyFeedback] = useState("");

  useEffect(() => {
    if (!copyFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyFeedback("");
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyFeedback]);

  async function handleCopyQuestion() {
    if (!question?.questionText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(question.questionText);
      setCopyFeedback("Texto copiado.");
    } catch {
      setCopyFeedback("Nao foi possivel copiar agora.");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmitReply();
  }

  if (loading && !question) {
    return (
      <section className="panel ml-questions-detail-panel">
        <div className="ml-questions-detail-skeleton" />
        <div className="ml-questions-detail-skeleton is-secondary" />
        <div className="ml-questions-detail-skeleton is-tertiary" />
      </section>
    );
  }

  if (!loading && error && !question) {
    return (
      <section className="panel ml-questions-detail-panel">
        <div className="ml-questions-detail-empty is-error">
          <strong>Nao foi possivel carregar os detalhes.</strong>
          <p>Tente buscar a pergunta novamente para continuar o atendimento.</p>
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  if (!question) {
    return (
      <section className="panel ml-questions-detail-panel">
        <div className="ml-questions-detail-empty">
          <strong>Selecione uma pergunta para abrir o painel de detalhes.</strong>
          <p>
            Aqui voce consegue analisar o contexto da pergunta, copiar o texto e
            responder direto no fluxo operacional.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel ml-questions-detail-panel">
      <div className="ml-questions-panel-header">
        <div>
          <h2>Detalhes da pergunta</h2>
          <p>
            {loading
              ? "Atualizando detalhes..."
              : "Contexto completo do anuncio e do atendimento."}
          </p>
        </div>

        <div className="ml-questions-badge-row">
          <span className={`ml-questions-badge is-${question.statusTone}`}>
            {question.statusLabel}
          </span>

          {question.isUrgent ? (
            <span className="ml-questions-badge is-urgent-soft">Urgente</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="ml-questions-inline-alert is-error">{error}</div>
      ) : null}

      <div className="ml-questions-detail-product">
        <MercadoLivreQuestionThumbnail
          title={question.itemTitle}
          thumbnail={question.thumbnail}
          alt={question.itemTitle}
          size="large"
        />

        <div className="ml-questions-detail-product-copy">
          <strong>{question.itemTitle}</strong>
          <span>Item ID: {question.itemId}</span>
          <span>SKU: {question.sku || "Nao informado"}</span>
          <span>Comprador: {question.buyerNickname || "Cliente Mercado Livre"}</span>
        </div>
      </div>

      <div className="ml-questions-detail-metrics">
        <div className="ml-questions-metric-pill">
          <span>Recebida em</span>
          <strong>{formatQuestionDate(question.createdAt, true)}</strong>
        </div>

        <div className="ml-questions-metric-pill">
          <span>{question.isAnswered ? "Tempo para responder" : "Tempo em aberto"}</span>
          <strong>
            {question.isAnswered
              ? question.answerDelayLabel || "--"
              : question.openDurationLabel || "--"}
          </strong>
        </div>
      </div>

      <div className="ml-questions-detail-section">
        <div className="ml-questions-detail-section-head">
          <div>
            <h3>Pergunta do cliente</h3>
            <p>Texto original recebido no anuncio do Mercado Livre.</p>
          </div>

          <button
            type="button"
            className="ml-questions-secondary-button"
            onClick={handleCopyQuestion}
          >
            Copiar texto
          </button>
        </div>

        <div className="ml-questions-detail-question-card">
          <p>{question.questionText}</p>
        </div>

        {copyFeedback ? (
          <div className="ml-questions-inline-alert is-success">{copyFeedback}</div>
        ) : null}
      </div>

      {question.answerText ? (
        <div className="ml-questions-detail-section">
          <div className="ml-questions-detail-section-head">
            <div>
              <h3>Resposta atual</h3>
              <p>
                Publicada em {formatQuestionDate(question.answeredAt, true)}.
              </p>
            </div>
          </div>

          <div className="ml-questions-detail-answer-card">
            <p>{question.answerText}</p>
          </div>
        </div>
      ) : null}

      <div className="ml-questions-detail-section">
        <div className="ml-questions-detail-section-head">
          <div>
            <h3>{question.isAnswered ? "Resposta concluida" : "Responder pergunta"}</h3>
            <p>
              {question.isAnswered
                ? "A pergunta ja esta encerrada."
                : "Monte a resposta e atualize o status imediatamente."}
            </p>
          </div>
        </div>

        {!question.isAnswered && question.suggestedReplies?.length ? (
          <div className="ml-questions-suggestions">
            {question.suggestedReplies.map((suggestion, index) => (
              <button
                key={`${question.id}-suggestion-${index}`}
                type="button"
                className="ml-questions-suggestion-chip"
                onClick={() => onUseSuggestedReply(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <form className="ml-questions-reply-form" onSubmit={handleSubmit}>
          <textarea
            value={question.isAnswered ? question.answerText || "" : replyDraft}
            onChange={(event) => onReplyDraftChange(event.target.value)}
            placeholder="Digite a resposta que sera enviada ao cliente..."
            disabled={question.isAnswered || replyLoading}
          />

          <div className="ml-questions-reply-actions">
            <span className="ml-questions-helper-copy">
              {question.isAnswered
                ? "Pergunta encerrada."
                : "Respostas claras e objetivas tendem a manter a conversao do anuncio."}
            </span>

            {question.isAnswered ? (
              <span className="ml-questions-readonly-badge">Somente leitura</span>
            ) : (
              <button
                type="submit"
                className="ml-questions-primary-button"
                disabled={replyLoading || replyDraft.trim().length < 8}
              >
                {replyLoading ? "Enviando..." : "Enviar resposta"}
              </button>
            )}
          </div>
        </form>

        {replyFeedback?.message ? (
          <div className={`ml-questions-inline-alert is-${replyFeedback.tone}`}>
            {replyFeedback.message}
          </div>
        ) : null}
      </div>

      <div className="ml-questions-detail-section">
        <div className="ml-questions-detail-section-head">
          <div>
            <h3>Historico da conversa</h3>
            <p>Eventos relevantes do atendimento local.</p>
          </div>
        </div>

        <div className="ml-questions-timeline">
          {question.timeline?.map((event) => (
            <div key={event.id} className="ml-questions-timeline-item">
              <div className="ml-questions-timeline-dot" />
              <div>
                <strong>{event.label}</strong>
                <span>{formatQuestionDate(event.timestamp, true)}</span>
                <p>{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default MercadoLivreQuestionDetails;
