export const ML_QUESTION_STATUS_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "unanswered", label: "Nao respondidas" },
  { value: "answered", label: "Respondidas" },
];

export const ML_QUESTION_PERIOD_OPTIONS = [
  { value: "24h", label: "Ultimas 24h" },
  { value: "7d", label: "Ultimos 7 dias" },
  { value: "30d", label: "Ultimos 30 dias" },
  { value: "90d", label: "Ultimos 90 dias" },
  { value: "all", label: "Todo o historico" },
];

export const ML_QUESTION_SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigas" },
];

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function formatQuestionDate(value, detailed = false) {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return detailed
    ? longDateFormatter.format(parsedDate)
    : shortDateFormatter.format(parsedDate);
}

export function formatResponseRate(value) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return percentFormatter.format(value);
}

export function formatAverageResponse(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "sem historico";
  }

  if (value < 1) {
    return `${Math.max(1, Math.round(value * 60))} min`;
  }

  if (value < 24) {
    return `${value.toFixed(1).replace(".", ",")} h`;
  }

  const days = Math.floor(value / 24);
  const remainingHours = Math.round(value % 24);

  if (remainingHours === 0) {
    return `${days} d`;
  }

  return `${days} d ${remainingHours} h`;
}

export function formatQuestionSyncLabel(value) {
  if (!value) {
    return "Sem sincronizacao recente";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Sem sincronizacao recente";
  }

  const minutesAgo = Math.max(
    0,
    Math.round((Date.now() - parsedDate.getTime()) / (1000 * 60))
  );

  if (minutesAgo <= 1) {
    return "Atualizado agora";
  }

  if (minutesAgo < 60) {
    return `Atualizado ha ${minutesAgo} min`;
  }

  const hoursAgo = Math.round(minutesAgo / 60);

  if (hoursAgo < 24) {
    return `Atualizado ha ${hoursAgo} h`;
  }

  return `Atualizado em ${formatQuestionDate(value)}`;
}

export function truncateQuestionText(value, maxLength = 140) {
  const text = String(value ?? "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}
