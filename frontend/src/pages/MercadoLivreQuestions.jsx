import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MercadoLivreQuestionDetails from "../components/mercadoLivreQuestions/MercadoLivreQuestionDetails";
import MercadoLivreQuestionFilters from "../components/mercadoLivreQuestions/MercadoLivreQuestionFilters";
import MercadoLivreQuestionsList from "../components/mercadoLivreQuestions/MercadoLivreQuestionsList";
import MercadoLivreQuestionsOverview from "../components/mercadoLivreQuestions/MercadoLivreQuestionsOverview";
import {
  dismissAnsweredMercadoLivreQuestions,
  getMercadoLivreQuestion,
  replyMercadoLivreQuestion,
} from "../services/api";
import {
  buildActiveFilters,
  buildQuestionsOverview,
  requestQuestions,
} from "../utils/mercadoLivreQuestionsInsights";
import "./MercadoLivreQuestions.css";

const DEFAULT_FILTERS = {
  status: "all",
  itemId: "all",
  period: "30d",
  sort: "recent",
};

function MercadoLivreQuestions() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [questionsPayload, setQuestionsPayload] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [listReloadKey, setListReloadKey] = useState(0);
  const [listError, setListError] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyFeedback, setReplyFeedback] = useState(null);
  const [listFeedback, setListFeedback] = useState(null);
  const [dismissAnsweredLoading, setDismissAnsweredLoading] = useState(false);
  const listHydratedRef = useRef(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeFilters = useMemo(
    () => buildActiveFilters(filters, deferredSearchTerm),
    [filters, deferredSearchTerm]
  );

  useEffect(() => {
    let isActive = true;

    async function loadQuestions() {
      setListError("");
      setListFeedback(null);

      if (listHydratedRef.current) {
        setListRefreshing(true);
      } else {
        setListLoading(true);
      }

      try {
        const payload = await requestQuestions(activeFilters);

        if (!isActive) {
          return;
        }

        setQuestionsPayload(payload);
        listHydratedRef.current = true;
      } catch (error) {
        if (!isActive) {
          return;
        }

        setListError(error.message || "Nao foi possivel carregar as perguntas.");
        listHydratedRef.current = true;
      } finally {
        if (isActive) {
          setListLoading(false);
          setListRefreshing(false);
        }
      }
    }

    loadQuestions();

    return () => {
      isActive = false;
    };
  }, [
    activeFilters,
    listReloadKey,
  ]);

  useEffect(() => {
    const visibleQuestions = questionsPayload?.items || [];

    if (visibleQuestions.length === 0) {
      setSelectedQuestionId("");
      setSelectedQuestion(null);
      setDetailError("");
      setReplyDraft("");
      return;
    }

    const hasSelectedQuestion = visibleQuestions.some(
      (question) => question.id === selectedQuestionId
    );

    if (!hasSelectedQuestion) {
      setSelectedQuestionId(visibleQuestions[0].id);
    }
  }, [questionsPayload, selectedQuestionId]);

  useEffect(() => {
    if (!selectedQuestionId) {
      setSelectedQuestion(null);
      setDetailError("");
      setReplyDraft("");
      return;
    }

    let isActive = true;

    async function loadQuestionDetail() {
      setDetailLoading(true);
      setDetailError("");

      try {
        const payload = await getMercadoLivreQuestion(selectedQuestionId);

        if (!isActive) {
          return;
        }

        setSelectedQuestion(payload.question);
        setReplyDraft(payload.question.isAnswered ? payload.question.answerText || "" : "");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setSelectedQuestion(null);
        setDetailError(error.message || "Nao foi possivel carregar os detalhes.");
      } finally {
        if (isActive) {
          setDetailLoading(false);
        }
      }
    }

    loadQuestionDetail();

    return () => {
      isActive = false;
    };
  }, [selectedQuestionId, detailReloadKey]);

  useEffect(() => {
    setReplyFeedback(null);
  }, [selectedQuestionId]);

  async function handleRefreshQuestions() {
    setListError("");
    setReplyFeedback(null);
    setListFeedback(null);
    setListRefreshing(true);

    try {
      const payload = await requestQuestions(activeFilters, true);
      setQuestionsPayload(payload);
      listHydratedRef.current = true;

      if (selectedQuestionId) {
        setDetailReloadKey((currentValue) => currentValue + 1);
      }
    } catch (error) {
      setListError(error.message || "Nao foi possivel atualizar as perguntas.");
    } finally {
      setListLoading(false);
      setListRefreshing(false);
    }
  }

  async function handleReplySubmit() {
    if (!selectedQuestionId || replyDraft.trim().length < 8) {
      return;
    }

    setReplyLoading(true);
    setReplyFeedback(null);

    try {
      const payload = await replyMercadoLivreQuestion(selectedQuestionId, replyDraft);
      setSelectedQuestion(payload.question);
      setReplyDraft(payload.question.answerText || "");
      setReplyFeedback({
        tone: "success",
        message: payload.message,
      });

      try {
        const refreshedPayload = await requestQuestions(activeFilters);
        setQuestionsPayload(refreshedPayload);
      } catch {
        setListError(
          "Resposta enviada, mas a lista nao foi atualizada visualmente agora."
        );
      }
    } catch (error) {
      setReplyFeedback({
        tone: "error",
        message: error.message || "Nao foi possivel responder essa pergunta.",
      });
    } finally {
      setReplyLoading(false);
    }
  }

  async function handleDismissAnsweredQuestions() {
    setDismissAnsweredLoading(true);
    setReplyFeedback(null);
    setListFeedback(null);

    try {
      const payload = await dismissAnsweredMercadoLivreQuestions(activeFilters);
      const nextSelectedQuestionId = payload.items[0]?.id || "";

      setQuestionsPayload(payload);
      setSelectedQuestionId(nextSelectedQuestionId);
      setSelectedQuestion(null);
      setReplyDraft("");
      setDetailError("");
      setListFeedback({
        tone: "success",
        message: payload.message || "Perguntas respondidas removidas da lista.",
      });
    } catch (error) {
      setReplyFeedback({
        tone: "error",
        message:
          error.message ||
          "Nao foi possivel remover as perguntas respondidas da lista.",
      });
    } finally {
      setDismissAnsweredLoading(false);
    }
  }

  function handleRetryList() {
    if (!questionsPayload?.items?.length) {
      listHydratedRef.current = false;
      setListLoading(true);
    }

    setListReloadKey((currentValue) => currentValue + 1);
  }

  function handleRetryDetails() {
    setDetailReloadKey((currentValue) => currentValue + 1);
  }

  function handleFilterChange(field, value) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
  }

  function handleClearFilters() {
    setFilters(DEFAULT_FILTERS);
    setSearchTerm("");
  }

  function handleSelectQuestion(questionId) {
    startTransition(() => {
      setSelectedQuestionId(questionId);
    });
  }

  const { overview, overviewCards } = buildQuestionsOverview(questionsPayload);

  return (
    <div className="ml-questions-page">
      <MercadoLivreQuestionsOverview
        overview={overview}
        overviewCards={overviewCards}
        meta={questionsPayload?.meta}
        listLoading={listLoading}
        listRefreshing={listRefreshing}
        hasQuestionsPayload={Boolean(questionsPayload)}
        onRefresh={handleRefreshQuestions}
      />

      <MercadoLivreQuestionFilters
        filters={filters}
        searchTerm={searchTerm}
        meta={questionsPayload?.meta}
        isRefreshing={listRefreshing}
        onSearchChange={setSearchTerm}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      {listFeedback?.message ? (
        <div className={`ml-questions-inline-alert is-${listFeedback.tone}`}>
          {listFeedback.message}
        </div>
      ) : null}

      <div className="ml-questions-content-grid">
        <MercadoLivreQuestionsList
          questions={questionsPayload?.items || []}
          selectedQuestionId={selectedQuestionId}
          loading={listLoading}
          refreshing={listRefreshing}
          error={listError}
          lastSyncAt={questionsPayload?.meta?.lastSyncAt}
          filteredTotal={questionsPayload?.meta?.filteredTotal || 0}
          dismissAnsweredDisabled={
            dismissAnsweredLoading ||
            !(questionsPayload?.items || []).some((question) => question.isAnswered)
          }
          dismissAnsweredLoading={dismissAnsweredLoading}
          onDismissAnswered={handleDismissAnsweredQuestions}
          onSelectQuestion={handleSelectQuestion}
          onRetry={handleRetryList}
          onClearFilters={handleClearFilters}
        />

        <MercadoLivreQuestionDetails
          question={selectedQuestion}
          loading={detailLoading}
          error={detailError}
          replyDraft={replyDraft}
          replyFeedback={replyFeedback}
          onReplyDraftChange={setReplyDraft}
          onUseSuggestedReply={setReplyDraft}
          onSubmitReply={handleReplySubmit}
          onRetry={handleRetryDetails}
          onRefreshQuestions={handleRefreshQuestions}
          onClearFilters={handleClearFilters}
          hasVisibleQuestions={(questionsPayload?.items || []).length > 0}
          replyLoading={replyLoading}
        />
      </div>
    </div>
  );
}

export default MercadoLivreQuestions;
