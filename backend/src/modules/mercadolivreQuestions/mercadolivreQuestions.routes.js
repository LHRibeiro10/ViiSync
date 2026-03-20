const express = require("express");

const {
  fetchQuestionById,
  fetchQuestions,
  fetchMercadoLivreAuthorizationUrl,
  fetchMercadoLivreIntegrationStatus,
  handleMercadoLivreOAuthCallback,
  postDismissAnsweredQuestions,
  postDismissQuestion,
  postQuestionReply,
  postRefreshQuestions,
  postSyncQuestions,
} = require("./mercadolivreQuestions.controller");

const router = express.Router();

router.get("/status", fetchMercadoLivreIntegrationStatus);
router.get("/auth/url", fetchMercadoLivreAuthorizationUrl);
router.get("/oauth/callback", handleMercadoLivreOAuthCallback);
router.get("/questions", fetchQuestions);
router.post("/questions/dismiss-answered", postDismissAnsweredQuestions);
router.post("/questions/refresh", postRefreshQuestions);
router.post("/questions/sync", postSyncQuestions);
router.get("/questions/:questionId", fetchQuestionById);
router.post("/questions/:questionId/reply", postQuestionReply);
router.post("/questions/:questionId/dismiss", postDismissQuestion);

module.exports = router;
