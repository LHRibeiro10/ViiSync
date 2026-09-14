import { feedbackAreaOptions, feedbackTypeOptions } from "../../utils/feedback";
import { getFeedbackTypeUi } from "../../utils/feedbackCenterInsights";

function FeedbackFormPanel({ form, onFormChange, feedbackMessage, submitting, onSubmit }) {
  const activeTypeUi = getFeedbackTypeUi(form.type);

  return (
    <section className="panel feedback-form-panel">
      <div className="feedback-panel-header">
        <div>
          <h2>Novo envio</h2>
          <p>
            Canal oficial com o time ViiSync para registrar bug, reclamacao,
            sugestao e feedback com rastreabilidade.
          </p>
        </div>
      </div>

      <div className="feedback-type-chips">
        {feedbackTypeOptions.map((option) => {
          const typeUi = getFeedbackTypeUi(option.value);
          const isActive = form.type === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={`feedback-type-chip is-${typeUi.tone} ${isActive ? "is-active" : ""}`}
              onClick={() => onFormChange("type", option.value)}
            >
              <span>{option.label}</span>
              <small>{typeUi.subtitle}</small>
            </button>
          );
        })}
      </div>

      <div className={`feedback-type-spotlight is-${activeTypeUi.tone}`}>
        <strong>{activeTypeUi.spotlightTitle}</strong>
        <p>{activeTypeUi.spotlightDescription}</p>
      </div>

      <form className="feedback-form" onSubmit={onSubmit}>
        <div className="feedback-form-section">
          <h3>Classificacao e contexto</h3>
          <p>Defina area e assunto para facilitar a triagem e acelerar retorno.</p>

          <div className="feedback-form-compact-grid">
            <label className="feedback-field">
              <span>Area</span>
              <select
                value={form.area}
                onChange={(event) => onFormChange("area", event.target.value)}
              >
                {feedbackAreaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="feedback-field">
              <span>Assunto</span>
              <input
                type="text"
                value={form.subject}
                onChange={(event) => onFormChange("subject", event.target.value)}
                placeholder="Resumo curto do que aconteceu ou do que voce deseja"
              />
            </label>
          </div>
        </div>

        <div className="feedback-form-section">
          <h3>Descricao do envio</h3>
          <p>Contextualize situacao, impacto e resultado esperado de forma objetiva.</p>

          <label className="feedback-field">
            <span>Descricao</span>
            <textarea
              value={form.message}
              onChange={(event) => onFormChange("message", event.target.value)}
              placeholder="Explique o problema, o impacto e o resultado esperado."
            />
          </label>
        </div>

        {feedbackMessage ? (
          <div className={`feedback-inline-alert is-${feedbackMessage.tone}`}>
            {feedbackMessage.message}
          </div>
        ) : null}

        <button type="submit" className="feedback-submit-button" disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar para o time"}
        </button>
      </form>
    </section>
  );
}

export default FeedbackFormPanel;
