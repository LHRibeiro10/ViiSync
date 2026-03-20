import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { createSellerFeedback, getSellerFeedbacks } from "../services/api";
import {
  feedbackAreaOptions,
  feedbackStatusOptions,
  feedbackTypeOptions,
  formatFeedbackDateTime,
  formatFeedbackRelativeTime,
} from "../utils/feedback";
import "./FeedbackCenter.css";

const initialForm = {
  type: "complaint",
  area: "general",
  subject: "",
  message: "",
};

function FeedbackCenter() {
  const location = useLocation();
  const [payload, setPayload] = useState(null);
  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
  });
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadFeedbacks() {
      try {
        setError("");
        setLoading(true);
        const response = await getSellerFeedbacks(filters);

        if (!isCancelled) {
          setPayload(response);
        }
      } catch (err) {
        if (!isCancelled) {
          setError("Nao foi possivel carregar seu historico de feedback agora.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadFeedbacks();

    return () => {
      isCancelled = true;
    };
  }, [filters]);

  const summaryCards = useMemo(() => {
    return [
      {
        id: "feedback-total",
        label: "Envios totais",
        value: payload?.meta?.total || 0,
      },
      {
        id: "feedback-open",
        label: "Abertos",
        value: payload?.meta?.openCount || 0,
      },
      {
        id: "feedback-review",
        label: "Em analise",
        value: payload?.meta?.inReviewCount || 0,
      },
      {
        id: "feedback-resolved",
        label: "Resolvidos",
        value: payload?.meta?.resolvedCount || 0,
      },
    ];
  }, [payload]);
  const shouldScrollFeedbackHistory = (payload?.items?.length || 0) > 6;

  function handleFormChange(field, value) {
    setForm((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedbackMessage(null);

    if (!form.subject.trim() || !form.message.trim()) {
      setFeedbackMessage({
        tone: "error",
        message: "Preencha assunto e descricao para registrar seu envio.",
      });
      return;
    }

    try {
      setSubmitting(true);

      await createSellerFeedback({
        ...form,
        currentPath: location.pathname,
      });

      const refreshedPayload = await getSellerFeedbacks(filters);
      setPayload(refreshedPayload);
      setForm(initialForm);
      setFeedbackMessage({
        tone: "success",
        message: "Seu feedback foi enviado e entrou na fila do time interno.",
      });
    } catch (err) {
      setFeedbackMessage({
        tone: "error",
        message: err.message || "Nao foi possivel enviar seu feedback.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="feedback-page">
      <PageHeader
        tag="Canal aberto"
        title="Feedbacks e reclamacoes"
        description="Envie bugs, ideias e reclamacoes direto para o time do ViiSync e acompanhe o andamento sem sair do produto."
      />

      <div className="feedback-summary-grid">
        {summaryCards.map((card) => (
          <article key={card.id} className="feedback-summary-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="feedback-grid">
        <section className="panel feedback-form-panel">
          <div className="feedback-panel-header">
            <div>
              <h2>Novo envio</h2>
              <p>Descreva o contexto e o impacto para facilitar a triagem do time.</p>
            </div>
          </div>

          <div className="feedback-type-chips">
            {feedbackTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={form.type === option.value ? "is-active" : ""}
                onClick={() => handleFormChange("type", option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <form className="feedback-form" onSubmit={handleSubmit}>
            <label className="feedback-field">
              <span>Area</span>
              <select
                value={form.area}
                onChange={(event) => handleFormChange("area", event.target.value)}
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
                onChange={(event) => handleFormChange("subject", event.target.value)}
                placeholder="Resumo curto do que aconteceu ou do que voce deseja"
              />
            </label>

            <label className="feedback-field">
              <span>Descricao</span>
              <textarea
                value={form.message}
                onChange={(event) => handleFormChange("message", event.target.value)}
                placeholder="Explique o problema, o impacto e o resultado esperado."
              />
            </label>

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

        <div className="feedback-side-column">
          <section className="panel feedback-profile-panel">
            <div className="feedback-panel-header">
              <div>
                <h2>Contexto do remetente</h2>
                <p>Enquanto nao houver login real, usamos o seller mockado atual do sistema.</p>
              </div>
            </div>

            <div className="feedback-profile-card">
              <strong>{payload?.seller?.company || "Operacao atual"}</strong>
              <span>{payload?.seller?.name || "--"}</span>
              <span>{payload?.seller?.email || "--"}</span>
            </div>
          </section>

          <section className="panel feedback-history-panel">
            <div className="feedback-panel-header">
              <div>
                <h2>Historico recente</h2>
                <p>Aqui aparecem os envios da sua operacao e o status atual de cada item.</p>
              </div>
            </div>

            <div className="feedback-history-filters">
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((currentValue) => ({
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
                  setFilters((currentValue) => ({
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
            ) : payload?.items?.length ? (
              <div
                className={`feedback-history-list ui-scroll-region ${
                  shouldScrollFeedbackHistory ? "is-scrollable scroll-region-medium" : ""
                }`}
              >
                {payload.items.map((item) => (
                  <article key={item.id} className="feedback-history-card">
                    <div className="feedback-history-topline">
                      <div className="feedback-badge-row">
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
                  </article>
                ))}
              </div>
            ) : (
              <div className="feedback-empty-state">
                <strong>Nenhum envio ainda</strong>
                <p>Os feedbacks e reclamacoes enviados por voce aparecerao aqui.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default FeedbackCenter;
