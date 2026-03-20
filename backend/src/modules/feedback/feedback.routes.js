const express = require("express");

const {
  fetchAdminFeedback,
  fetchAdminFeedbackById,
  fetchSellerFeedback,
  postAdminFeedbackStatus,
  postSellerFeedback,
} = require("./feedback.controller");

const router = express.Router();

router.get("/feedback", fetchSellerFeedback);
router.post("/feedback", postSellerFeedback);

router.get("/admin/feedback", fetchAdminFeedback);
router.get("/admin/feedback/:feedbackId", fetchAdminFeedbackById);
router.post("/admin/feedback/:feedbackId/status", postAdminFeedbackStatus);

module.exports = router;
