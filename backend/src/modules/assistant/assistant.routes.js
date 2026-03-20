const express = require("express");

const {
  createConversation,
  fetchConversation,
  postMessage,
  restartConversation,
} = require("./assistant.controller");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.post("/conversations", createConversation);
router.get("/conversations/:conversationId", fetchConversation);
router.post("/conversations/:conversationId/messages", postMessage);
router.post("/conversations/:conversationId/reset", restartConversation);

module.exports = router;
