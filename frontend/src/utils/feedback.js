export const feedbackTypeOptions = [
  { value: "complaint", label: "Reclamacao" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Sugestao" },
  { value: "feedback", label: "Feedback" },
];

export const feedbackAreaOptions = [
  { value: "dashboard", label: "Dashboard" },
  { value: "assistant", label: "Assistente" },
  { value: "orders", label: "Pedidos" },
  { value: "products", label: "Produtos" },
  { value: "mercado-livre", label: "Perguntas ML" },
  { value: "accounts", label: "Contas conectadas" },
  { value: "reports", label: "Relatorios" },
  { value: "onboarding", label: "Onboarding" },
  { value: "general", label: "Geral" },
];

export const feedbackStatusOptions = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Novos" },
  { value: "in_review", label: "Em analise" },
  { value: "resolved", label: "Resolvidos" },
];

export const feedbackPriorityOptions = [
  { value: "all", label: "Todas prioridades" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baixa" },
];

export function formatFeedbackDateTime(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatFeedbackRelativeTime(value) {
  if (!value) {
    return "--";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min atras`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} h atras`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} dia(s) atras`;
}
