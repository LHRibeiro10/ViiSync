const express = require("express");
const { requireAdmin, requireAuth } = require("../auth/auth.middleware");

const {
  fetchAdminFeedback,
  fetchAdminFeedbackById,
  fetchSellerFeedback,
  postAdminFeedbackStatus,
  postSellerFeedback,
} = require("./feedback.controller");

const router = express.Router();

router.get("/feedback", requireAuth, fetchSellerFeedback);
router.post("/feedback", requireAuth, postSellerFeedback);

router.get("/admin/feedback", requireAuth, requireAdmin, fetchAdminFeedback);
router.get("/admin/feedback/:feedbackId", requireAuth, requireAdmin, fetchAdminFeedbackById);
router.post(
  "/admin/feedback/:feedbackId/status",
  requireAuth,
  requireAdmin,
  postAdminFeedbackStatus
);

module.exports = router;
