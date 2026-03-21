const express = require("express");

const {
  fetchQuestionById,
  fetchQuestions,
  fetchMercadoLivreAuthorizationUrl,
  fetchMercadoLivreItems,
  fetchMercadoLivreIntegrationStatus,
  fetchMercadoLivreOrders,
  handleMercadoLivreOAuthCallback,
  postMercadoLivreDisconnect,
  postMercadoLivreTokenRefresh,
  startMercadoLivreAuthorization,
  postDismissAnsweredQuestions,
  postDismissQuestion,
  postQuestionReply,
  postRefreshQuestions,
  postSyncItems,
  postSyncMarketplaceData,
  postSyncOrders,
  postSyncQuestions,
} = require("./mercadolivreQuestions.controller");

const router = express.Router();

router.get("/status", fetchMercadoLivreIntegrationStatus);
router.get("/connect", startMercadoLivreAuthorization);
router.get("/callback", handleMercadoLivreOAuthCallback);
router.get("/auth/url", fetchMercadoLivreAuthorizationUrl);
router.get("/auth/start", startMercadoLivreAuthorization);
router.get("/oauth/callback", handleMercadoLivreOAuthCallback);
router.post("/refresh", postMercadoLivreTokenRefresh);
router.post("/disconnect", postMercadoLivreDisconnect);
router.post("/sync/all", postSyncMarketplaceData);
router.get("/questions", fetchQuestions);
router.post("/questions/dismiss-answered", postDismissAnsweredQuestions);
router.post("/questions/refresh", postRefreshQuestions);
router.post("/questions/sync", postSyncQuestions);
router.post("/sync/orders", postSyncOrders);
router.post("/sync/items", postSyncItems);
router.get("/orders", fetchMercadoLivreOrders);
router.get("/items", fetchMercadoLivreItems);
router.get("/questions/:questionId", fetchQuestionById);
router.post("/questions/:questionId/reply", postQuestionReply);
router.post("/questions/:questionId/dismiss", postDismissQuestion);

module.exports = router;
