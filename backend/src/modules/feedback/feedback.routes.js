const express = require("express");
const { requireAdmin } = require("../auth/auth.middleware");

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

router.get("/admin/feedback", requireAdmin, fetchAdminFeedback);
router.get("/admin/feedback/:feedbackId", requireAdmin, fetchAdminFeedbackById);
router.post("/admin/feedback/:feedbackId/status", requireAdmin, postAdminFeedbackStatus);

module.exports = router;
