const {
  getAdminIntegrations,
  getAdminUsers,
  getAuditTrail,
  getObservability,
  toggleAdminUserBlock,
} = require("./adminConsole.service");

function sendError(res, error, fallbackMessage) {
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error("[admin-console]", error);
  return res.status(500).json({ error: fallbackMessage });
}

function fetchObservability(req, res) {
  try {
    res.json(getObservability());
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar a observabilidade.");
  }
}

function fetchAdminUsers(req, res) {
  try {
    res.json(getAdminUsers());
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar os sellers.");
  }
}

function postAdminUserBlock(req, res) {
  try {
    res.json(toggleAdminUserBlock(req.params.userId, req.body));
  } catch (error) {
    sendError(res, error, "Nao foi possivel atualizar o bloqueio do seller.");
  }
}

function fetchAuditTrail(req, res) {
  try {
    res.json(getAuditTrail());
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar a trilha de auditoria.");
  }
}

function fetchAdminIntegrations(req, res) {
  try {
    res.json(getAdminIntegrations());
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar o painel de integracoes.");
  }
}

module.exports = {
  fetchAdminIntegrations,
  fetchAdminUsers,
  fetchAuditTrail,
  fetchObservability,
  postAdminUserBlock,
};
