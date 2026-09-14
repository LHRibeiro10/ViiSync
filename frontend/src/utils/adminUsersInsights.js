const SUBSCRIPTION_LABELS = {
  paid: "Pago",
  trial: "Trial",
  overdue: "Atrasado",
};

const ONBOARDING_LABELS = {
  done: "Concluido",
  in_progress: "Em andamento",
  blocked: "Travado",
};

const CHURN_LABELS = {
  low: "Baixo risco",
  medium: "Risco medio",
  high: "Alto risco",
};

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function getSubscriptionTone(status) {
  if (status === "paid") {
    return "success";
  }

  if (status === "trial") {
    return "neutral";
  }

  return "danger";
}

function getRiskTone(risk) {
  if (risk === "high") {
    return "danger";
  }

  if (risk === "medium") {
    return "warning";
  }

  return "success";
}

function getOnboardingTone(status) {
  if (status === "blocked") {
    return "danger";
  }

  if (status === "in_progress") {
    return "warning";
  }

  return "success";
}

function matchesFilters(user, filters) {
  if (filters.subscription !== "all" && user.subscriptionStatus !== filters.subscription) {
    return false;
  }

  if (filters.blockStatus === "blocked" && !user.isBlocked) {
    return false;
  }

  if (filters.blockStatus === "active" && user.isBlocked) {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const haystack = [
    user.name,
    user.company,
    user.email,
    user.plan,
    SUBSCRIPTION_LABELS[user.subscriptionStatus],
  ]
    .filter(Boolean)
    .map(normalizeText)
    .join(" ");

  return haystack.includes(normalizeText(filters.search));
}

export {
  SUBSCRIPTION_LABELS,
  ONBOARDING_LABELS,
  CHURN_LABELS,
  getSubscriptionTone,
  getRiskTone,
  getOnboardingTone,
  matchesFilters,
};
