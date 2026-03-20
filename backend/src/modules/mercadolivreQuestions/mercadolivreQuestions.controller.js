const {
  completeAuthorizationCallback,
  dismissAnsweredQuestions,
  dismissQuestion,
  getAuthorizationUrl,
  getIntegrationStatus,
  MercadoLivreQuestionNotFoundError,
  MercadoLivreQuestionValidationError,
  getQuestionById,
  listQuestions,
  receiveWebhook,
  refreshQuestions,
  replyQuestion,
  syncQuestions,
} = require("./mercadolivreQuestions.service");

async function fetchQuestions(req, res) {
  try {
    const payload = await listQuestions(req.query);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function fetchQuestionById(req, res) {
  try {
    const payload = await getQuestionById(req.params.questionId);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postQuestionReply(req, res) {
  try {
    const payload = await replyQuestion(req.params.questionId, req.body.text);
    res.status(201).json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postDismissQuestion(req, res) {
  try {
    const payload = await dismissQuestion(req.params.questionId, req.body);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postDismissAnsweredQuestions(req, res) {
  try {
    const payload = await dismissAnsweredQuestions(req.body);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postRefreshQuestions(req, res) {
  try {
    const payload = await refreshQuestions(req.body);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function postSyncQuestions(req, res) {
  try {
    const payload = await syncQuestions(req.body);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function handleMercadoLivreWebhook(req, res) {
  try {
    const payload = await receiveWebhook(req.body);
    res.status(202).json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function fetchMercadoLivreIntegrationStatus(req, res) {
  try {
    const payload = await getIntegrationStatus();
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

function fetchMercadoLivreAuthorizationUrl(req, res) {
  try {
    const payload = getAuthorizationUrl(req.query);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

function startMercadoLivreAuthorization(req, res) {
  try {
    const payload = getAuthorizationUrl(req.query);
    res.redirect(payload.authorizationUrl);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

async function handleMercadoLivreOAuthCallback(req, res) {
  try {
    const payload = await completeAuthorizationCallback(req.query);
    res.json(payload);
  } catch (error) {
    handleMercadoLivreError(error, res);
  }
}

function handleMercadoLivreError(error, res) {
  if (error instanceof MercadoLivreQuestionValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof MercadoLivreQuestionNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error && Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("[mercadolivre-questions]", error);
  res.status(500).json({
    error: "Nao foi possivel processar as perguntas do Mercado Livre.",
  });
}

module.exports = {
  fetchQuestionById,
  fetchQuestions,
  fetchMercadoLivreAuthorizationUrl,
  fetchMercadoLivreIntegrationStatus,
  handleMercadoLivreWebhook,
  handleMercadoLivreOAuthCallback,
  startMercadoLivreAuthorization,
  postDismissAnsweredQuestions,
  postDismissQuestion,
  postQuestionReply,
  postRefreshQuestions,
  postSyncQuestions,
};
