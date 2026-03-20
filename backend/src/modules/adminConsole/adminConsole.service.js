const {
  adminIntegrationPanel,
  adminUsersSeed,
  auditTrail,
  observabilityData,
} = require("../../data/mockAdminOperationsData");

let adminUsersStore = cloneData(adminUsersSeed);

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function buildUsersSummary(items) {
  return {
    total: items.length,
    paidCount: items.filter((item) => item.subscriptionStatus === "paid").length,
    blockedCount: items.filter((item) => item.isBlocked).length,
    onboardingBlockedCount: items.filter((item) => item.onboardingStatus === "blocked").length,
    churnRiskCount: items.filter((item) => item.churnRisk === "high").length,
    mrrTotal: items.reduce((accumulator, item) => accumulator + item.mrr, 0),
  };
}

function getObservability() {
  return cloneData(observabilityData);
}

function getAdminUsers() {
  return {
    summary: buildUsersSummary(adminUsersStore),
    items: cloneData(adminUsersStore),
  };
}

function toggleAdminUserBlock(userId, payload = {}) {
  const index = adminUsersStore.findIndex((item) => item.id === userId);

  if (index === -1) {
    throw createHttpError(404, "Seller nao encontrado.");
  }

  const currentItem = adminUsersStore[index];
  const nextBlocked =
    typeof payload.blocked === "boolean" ? payload.blocked : !currentItem.isBlocked;

  adminUsersStore[index] = {
    ...currentItem,
    isBlocked: nextBlocked,
    blockedAt: nextBlocked ? new Date().toISOString() : null,
    blockReason: nextBlocked
      ? String(payload.reason ?? "").trim() || "Bloqueio administrativo manual."
      : null,
  };

  return {
    item: cloneData(adminUsersStore[index]),
    summary: buildUsersSummary(adminUsersStore),
  };
}

function getAuditTrail() {
  return {
    items: cloneData(auditTrail),
  };
}

function getAdminIntegrations() {
  return cloneData(adminIntegrationPanel);
}

module.exports = {
  getAdminIntegrations,
  getAdminUsers,
  getAuditTrail,
  getObservability,
  toggleAdminUserBlock,
};
