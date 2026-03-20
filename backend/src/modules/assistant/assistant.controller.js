const {
  AssistantNotFoundError,
  AssistantValidationError,
  getConversationState,
  replyToConversation,
  resetConversation,
  startConversation,
} = require("./assistant.service");

async function createConversation(req, res) {
  try {
    const payload = await startConversation({
      currentView: req.body.currentView,
      period: req.body.currentPeriod,
      request: req,
    });

    res.status(201).json(payload);
  } catch (error) {
    handleAssistantError(error, res);
  }
}

async function fetchConversation(req, res) {
  try {
    const payload = await getConversationState(req.params.conversationId, {
      currentView: req.query.currentView,
      period: req.query.currentPeriod,
      request: req,
    });

    res.json(payload);
  } catch (error) {
    handleAssistantError(error, res);
  }
}

async function postMessage(req, res) {
  try {
    const payload = await replyToConversation(req.params.conversationId, {
      message: req.body.message,
      currentView: req.body.currentView,
      period: req.body.currentPeriod,
      request: req,
    });

    res.json(payload);
  } catch (error) {
    handleAssistantError(error, res);
  }
}

async function restartConversation(req, res) {
  try {
    const payload = await resetConversation(req.params.conversationId, {
      currentView: req.body.currentView,
      period: req.body.currentPeriod,
      request: req,
    });

    res.json(payload);
  } catch (error) {
    handleAssistantError(error, res);
  }
}

function handleAssistantError(error, res) {
  if (error instanceof AssistantValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof AssistantNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }

  console.error("[assistant]", error);
  res.status(500).json({
    error: "Nao foi possivel processar a assistente no momento.",
  });
}

module.exports = {
  createConversation,
  fetchConversation,
  postMessage,
  restartConversation,
};
