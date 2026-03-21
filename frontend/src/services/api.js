const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
).replace(/\/$/, "");
export const AUTH_SESSION_STORAGE_KEY = "viisync.sessionToken";

function getSessionTokenFromStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  return token ? token.trim() : null;
}

export function setSessionToken(token) {
  if (typeof window === "undefined") {
    return;
  }

  const value = String(token || "").trim();

  if (!value) {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, value);
}

export function clearSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();

  return queryString ? `?${queryString}` : "";
}

async function requestJson(path, options = {}) {
  const sessionToken = getSessionTokenFromStorage();
  const requestOptions = {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(options.headers || {}),
    },
  };

  if (options.body) {
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const errorMessage = errorPayload?.error || `Erro ao buscar ${path}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.code = errorPayload?.code || null;

    if (
      typeof window !== "undefined" &&
      (response.status === 401 || response.status === 403)
    ) {
      window.dispatchEvent(
        new CustomEvent("viisync:auth-failure", {
          detail: {
            status: response.status,
            code: error.code,
            message: errorMessage,
          },
        })
      );
    }

    throw error;
  }

  return response.json();
}

async function requestBlob(path, options = {}) {
  const sessionToken = getSessionTokenFromStorage();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const errorMessage = errorPayload?.error || `Erro ao buscar ${path}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.code = errorPayload?.code || null;

    if (
      typeof window !== "undefined" &&
      (response.status === 401 || response.status === 403)
    ) {
      window.dispatchEvent(
        new CustomEvent("viisync:auth-failure", {
          detail: {
            status: response.status,
            code: error.code,
            message: errorMessage,
          },
        })
      );
    }

    throw error;
  }

  return response;
}

function parseFileNameFromDisposition(headerValue, fallbackFileName) {
  const match = /filename="?([^"]+)"?/i.exec(headerValue || "");
  return match?.[1] || fallbackFileName;
}

export async function getDashboard(period = "30d") {
  return requestJson(`/dashboard?period=${period}`);
}

export async function registerUser(payload) {
  return requestJson("/auth/register", {
    method: "POST",
    body: payload,
  });
}

export async function loginUser(payload) {
  return requestJson("/auth/login", {
    method: "POST",
    body: payload,
  });
}

export async function getCurrentUser() {
  return requestJson("/auth/me");
}

export async function logoutUser() {
  return requestJson("/auth/logout", {
    method: "POST",
  });
}

export async function getChartData(period = "30d") {
  return requestJson(`/chart-data?period=${period}`);
}

export async function getProfitTable(period = "30d") {
  return requestJson(`/profit-table?period=${period}`);
}

export async function getProfitReport(period = "30d") {
  return requestJson(`/profit-report?period=${period}`);
}

export async function getOrders() {
  return requestJson("/orders");
}

export async function getProducts() {
  return requestJson("/products");
}

export async function getProductDetail(productId, period = "30d") {
  return requestJson(`/workspace/products/${productId}?period=${period}`);
}

export async function getAccounts() {
  return requestJson("/accounts");
}

export async function getReports(period = "30d") {
  return requestJson(`/reports?period=${period}`);
}

export async function getAdditionalReportCosts(period = "30d") {
  return requestJson(`/reports/additional-costs?period=${period}`);
}

export async function createAdditionalReportCost(payload, period = "30d") {
  return requestJson("/reports/additional-costs", {
    method: "POST",
    body: {
      ...payload,
      period,
    },
  });
}

export async function updateAdditionalReportCost(costId, payload, period = "30d") {
  return requestJson(`/reports/additional-costs/${costId}`, {
    method: "PATCH",
    body: {
      ...payload,
      period,
    },
  });
}

export async function removeAdditionalReportCost(costId, period = "30d") {
  return requestJson(`/reports/additional-costs/${costId}?period=${period}`, {
    method: "DELETE",
  });
}

export async function getSettings() {
  return requestJson("/settings");
}

export async function getFinanceCenter(period = "30d") {
  return requestJson(`/workspace/finance?period=${period}`);
}

export async function createRecurringFinanceExpense(payload, period = "30d") {
  return requestJson("/workspace/finance/recurring-expenses", {
    method: "POST",
    body: {
      ...payload,
      period,
    },
  });
}

export async function removeRecurringFinanceExpense(expenseId, period = "30d") {
  return requestJson(`/workspace/finance/recurring-expenses/${expenseId}?period=${period}`, {
    method: "DELETE",
  });
}

export async function getMercadoLivreInvoices(period = "30d") {
  return requestJson(`/workspace/finance/mercadolivre-invoices?period=${period}`);
}

export async function pullPendingMercadoLivreInvoices(period = "30d") {
  return requestJson("/workspace/finance/mercadolivre-invoices/pull-pending", {
    method: "POST",
    body: {
      period,
    },
  });
}

export async function pullMercadoLivreInvoice(invoiceId) {
  return requestJson(`/workspace/finance/mercadolivre-invoices/${invoiceId}/pull`, {
    method: "POST",
  });
}

export async function dismissMercadoLivreInvoice(invoiceId, period = "30d") {
  return requestJson(`/workspace/finance/mercadolivre-invoices/${invoiceId}/dismiss`, {
    method: "POST",
    body: {
      period,
    },
  });
}

export async function downloadMercadoLivreInvoiceDocument(invoiceId, format) {
  const response = await requestBlob(
    `/workspace/finance/mercadolivre-invoices/${invoiceId}/download/${format}`
  );
  const blob = await response.blob();

  return {
    blob,
    fileName: parseFileNameFromDisposition(
      response.headers.get("Content-Disposition"),
      `${invoiceId}.${format}`
    ),
  };
}

export async function getOperationalCalendar(filters = {}) {
  return requestJson(`/workspace/calendar${buildQueryString(filters)}`);
}

export async function getAutomations() {
  return requestJson("/workspace/automations");
}

export async function toggleAutomationRule(ruleId, enabled) {
  return requestJson(`/workspace/automations/${ruleId}/toggle`, {
    method: "POST",
    body: {
      enabled,
    },
  });
}

export async function getIntegrationsHub() {
  return requestJson("/workspace/integrations");
}

export async function getSellerAlerts(period = "30d") {
  return requestJson(`/alerts?period=${period}`);
}

export async function getSellerFeedbacks(filters = {}) {
  return requestJson(`/feedback${buildQueryString(filters)}`);
}

export async function createSellerFeedback(payload) {
  return requestJson("/feedback", {
    method: "POST",
    body: payload,
  });
}

export async function getAdminFeedbacks(filters = {}) {
  return requestJson(`/admin/feedback${buildQueryString(filters)}`);
}

export async function getAdminObservability() {
  return requestJson("/admin-console/observability");
}

export async function getAdminUsers() {
  return requestJson("/admin-console/users");
}

export async function toggleAdminUserBlock(userId, blocked, reason = "") {
  return requestJson(`/admin-console/users/${userId}/block`, {
    method: "POST",
    body: {
      blocked,
      reason,
    },
  });
}

export async function getAdminAuditTrail() {
  return requestJson("/admin-console/audit");
}

export async function getAdminIntegrationPanel() {
  return requestJson("/admin-console/integrations");
}

export async function updateAdminFeedbackStatus(feedbackId, status, noteOrOptions = "") {
  const usingObjectPayload =
    typeof noteOrOptions === "object" && noteOrOptions !== null;
  const options = usingObjectPayload ? noteOrOptions : { note: noteOrOptions };
  const body = {
    status,
    note: options.note || "",
  };

  if (usingObjectPayload) {
    if (Object.prototype.hasOwnProperty.call(options, "response")) {
      body.response = options.response || "";
    }

    if (Object.prototype.hasOwnProperty.call(options, "resolutionEta")) {
      body.resolutionEta = options.resolutionEta || null;
    }
  }

  return requestJson(`/admin/feedback/${feedbackId}/status`, {
    method: "POST",
    body,
  });
}

export async function createAssistantConversation(
  currentView = "/",
  currentPeriod = "30d"
) {
  return requestJson("/assistant/conversations", {
    method: "POST",
    body: {
      currentView,
      currentPeriod,
    },
  });
}

export async function getAssistantConversation(
  conversationId,
  currentView = "/",
  currentPeriod = "30d"
) {
  return requestJson(
    `/assistant/conversations/${conversationId}?currentView=${encodeURIComponent(
      currentView
    )}&currentPeriod=${encodeURIComponent(currentPeriod)}`
  );
}

export async function sendAssistantMessage(
  conversationId,
  message,
  currentView = "/",
  currentPeriod = "30d"
) {
  return requestJson(`/assistant/conversations/${conversationId}/messages`, {
    method: "POST",
    body: {
      message,
      currentView,
      currentPeriod,
    },
  });
}

export async function resetAssistantConversation(
  conversationId,
  currentView = "/",
  currentPeriod = "30d"
) {
  return requestJson(`/assistant/conversations/${conversationId}/reset`, {
    method: "POST",
    body: {
      currentView,
      currentPeriod,
    },
  });
}

export async function getMercadoLivreQuestions(filters = {}) {
  return requestJson(
    `/integrations/mercadolivre/questions${buildQueryString(filters)}`
  );
}

export async function getMercadoLivreIntegrationStatus() {
  return requestJson("/integrations/mercadolivre/status");
}

export async function getMercadoLivreAuthorizationUrl(params = {}) {
  return requestJson(
    `/integrations/mercadolivre/auth/url${buildQueryString(params)}`
  );
}

export function getMercadoLivreAuthorizationStartUrl(params = {}) {
  return `${API_BASE_URL}/integrations/mercadolivre/auth/start${buildQueryString(params)}`;
}

export async function getMercadoLivreQuestion(questionId) {
  return requestJson(`/integrations/mercadolivre/questions/${questionId}`);
}

export async function replyMercadoLivreQuestion(questionId, text) {
  return requestJson(`/integrations/mercadolivre/questions/${questionId}/reply`, {
    method: "POST",
    body: {
      text,
    },
  });
}

export async function dismissMercadoLivreQuestion(questionId, filters = {}) {
  return requestJson(`/integrations/mercadolivre/questions/${questionId}/dismiss`, {
    method: "POST",
    body: filters,
  });
}

export async function dismissAnsweredMercadoLivreQuestions(filters = {}) {
  return requestJson("/integrations/mercadolivre/questions/dismiss-answered", {
    method: "POST",
    body: filters,
  });
}

export async function refreshMercadoLivreQuestions(filters = {}) {
  return requestJson("/integrations/mercadolivre/questions/refresh", {
    method: "POST",
    body: filters,
  });
}

export async function syncMercadoLivreQuestions(filters = {}) {
  return requestJson("/integrations/mercadolivre/questions/sync", {
    method: "POST",
    body: filters,
  });
}

export async function refreshMercadoLivreIntegrationToken() {
  return requestJson("/integrations/mercadolivre/refresh", {
    method: "POST",
  });
}

export async function disconnectMercadoLivreIntegration() {
  return requestJson("/integrations/mercadolivre/disconnect", {
    method: "POST",
  });
}

export async function syncMercadoLivreOrders(payload = {}) {
  return requestJson("/integrations/mercadolivre/sync/orders", {
    method: "POST",
    body: payload,
  });
}

export async function syncMercadoLivreItems(payload = {}) {
  return requestJson("/integrations/mercadolivre/sync/items", {
    method: "POST",
    body: payload,
  });
}

export async function syncMercadoLivreAll(payload = {}) {
  return requestJson("/integrations/mercadolivre/sync/all", {
    method: "POST",
    body: payload,
  });
}

export async function getMercadoLivreOrders(params = {}) {
  return requestJson(`/integrations/mercadolivre/orders${buildQueryString(params)}`);
}

export async function getMercadoLivreItems(params = {}) {
  return requestJson(`/integrations/mercadolivre/items${buildQueryString(params)}`);
}
