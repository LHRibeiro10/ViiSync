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

async function fetchObservability(req, res) {
  try {
    res.json(await getObservability());
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar a observabilidade.");
  }
}

async function fetchAdminUsers(req, res) {
  try {
    res.json(await getAdminUsers());
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar os sellers.");
  }
}

async function postAdminUserBlock(req, res) {
  try {
    res.json(await toggleAdminUserBlock(req.params.userId, req.body));
  } catch (error) {
    sendError(res, error, "Nao foi possivel atualizar o bloqueio do seller.");
  }
}

async function fetchAuditTrail(req, res) {
  try {
    res.json(await getAuditTrail());
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar a trilha de auditoria.");
  }
}

async function fetchAdminIntegrations(req, res) {
  try {
    res.json(await getAdminIntegrations());
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
