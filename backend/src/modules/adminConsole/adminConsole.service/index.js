const { getAdminIntegrations } = require("./adminIntegrations");
const { getAdminUsers, toggleAdminUserBlock } = require("./adminUsers");
const { getAuditTrail } = require("./auditTrail");
const { getObservability } = require("./observability");

module.exports = {
  getAdminIntegrations,
  getAdminUsers,
  getAuditTrail,
  getObservability,
  toggleAdminUserBlock,
};
