const {
  createFeedback,
  getAdminFeedbackById,
  listAdminFeedback,
  listFeedback,
  updateAdminFeedbackStatus,
} = require("./feedback.service");

function sendError(res, error, fallbackMessage) {
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error("[feedback]", error);
  return res.status(500).json({ error: fallbackMessage });
}

async function fetchSellerFeedback(req, res) {
  try {
    res.json(await listFeedback(req.query, req));
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar os feedbacks do seller.");
  }
}

async function postSellerFeedback(req, res) {
  try {
    res.status(201).json(await createFeedback(req.body, req));
  } catch (error) {
    sendError(res, error, "Nao foi possivel registrar o feedback.");
  }
}

async function fetchAdminFeedback(req, res) {
  try {
    res.json(await listAdminFeedback(req.query));
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar a inbox administrativa.");
  }
}

async function fetchAdminFeedbackById(req, res) {
  try {
    res.json(await getAdminFeedbackById(req.params.feedbackId));
  } catch (error) {
    sendError(res, error, "Nao foi possivel carregar o feedback solicitado.");
  }
}

async function postAdminFeedbackStatus(req, res) {
  try {
    res.json(await updateAdminFeedbackStatus(req.params.feedbackId, req.body));
  } catch (error) {
    sendError(res, error, "Nao foi possivel atualizar o status do feedback.");
  }
}

module.exports = {
  fetchAdminFeedback,
  fetchAdminFeedbackById,
  fetchSellerFeedback,
  postAdminFeedbackStatus,
  postSellerFeedback,
};
