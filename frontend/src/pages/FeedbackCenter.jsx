import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { createSellerFeedback, getSellerFeedbacks } from "../services/api";
import FeedbackSummaryGrid from "../components/feedbackCenter/FeedbackSummaryGrid";
import FeedbackFormPanel from "../components/feedbackCenter/FeedbackFormPanel";
import FeedbackProfilePanel from "../components/feedbackCenter/FeedbackProfilePanel";
import FeedbackHistoryPanel from "../components/feedbackCenter/FeedbackHistoryPanel";
import "./FeedbackCenter.css";

const initialForm = {
  type: "complaint",
  area: "general",
  subject: "",
  message: "",
};

function FeedbackCenter({ embedded = false }) {
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
      } catch {
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
  const latestFeedbackItem = payload?.items?.[0] || null;
  const pendingCount = (payload?.meta?.openCount || 0) + (payload?.meta?.inReviewCount || 0);

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
    <div className={`feedback-page ${embedded ? "is-embedded" : ""}`}>
      {embedded ? null : (
        <PageHeader
          tag="Canal aberto"
          title="Feedbacks e reclamacoes"
          description="Envie bugs, ideias e reclamacoes direto para o time do ViiSync e acompanhe o andamento sem sair do produto."
        />
      )}

      <FeedbackSummaryGrid summaryCards={summaryCards} />

      <div className="feedback-grid">
        <FeedbackFormPanel
          form={form}
          onFormChange={handleFormChange}
          feedbackMessage={feedbackMessage}
          submitting={submitting}
          onSubmit={handleSubmit}
        />

        <div className="feedback-side-column">
          <FeedbackProfilePanel seller={payload?.seller} />

          <FeedbackHistoryPanel
            pendingCount={pendingCount}
            latestFeedbackItem={latestFeedbackItem}
            filters={filters}
            onFiltersChange={setFilters}
            loading={loading}
            error={error}
            items={payload?.items}
            shouldScrollFeedbackHistory={shouldScrollFeedbackHistory}
          />
        </div>
      </div>
    </div>
  );
}

export default FeedbackCenter;
