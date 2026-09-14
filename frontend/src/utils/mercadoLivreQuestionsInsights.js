import { getMercadoLivreQuestions, refreshMercadoLivreQuestions } from "../services/api";
import { formatAverageResponse, formatResponseRate } from "./mercadoLivreQuestions";

function buildActiveFilters(filters, searchTerm) {
  return {
    ...filters,
    search: String(searchTerm ?? "").trim(),
  };
}

async function requestQuestions(filters, useRefresh = false) {
  if (useRefresh) {
    return refreshMercadoLivreQuestions(filters);
  }

  return getMercadoLivreQuestions(filters);
}

function buildQuestionsOverview(questionsPayload) {
  const overview = questionsPayload?.meta?.overview || {
    total: 0,
    answered: 0,
    unanswered: 0,
    urgent: 0,
    averageResponseHours: 0,
    responseRate: 0,
  };

  const overviewCards = [
    {
      id: "pending",
      label: "Nao respondidas",
      value: overview.unanswered,
      description: "Trate primeiro as mais antigas para evitar impacto em conversao.",
      tone: "warning",
    },
    {
      id: "answered",
      label: "Respondidas",
      value: overview.answered,
      description: `${formatResponseRate(overview.responseRate)} da fila concluida no recorte atual.`,
      tone: "success",
    },
    {
      id: "urgent",
      label: "Urgentes",
      value: overview.urgent,
      description: "Prioridade imediata para reduzir risco operacional e reputacional.",
      tone: "danger",
    },
    {
      id: "announcements",
      label: "Anuncios monitorados",
      value: questionsPayload?.meta?.announcementCount || 0,
      description: `SLA medio atual em ${formatAverageResponse(
        overview.averageResponseHours
      )}.`,
      tone: "neutral",
    },
  ];

  return { overview, overviewCards };
}

export { buildActiveFilters, requestQuestions, buildQuestionsOverview };
