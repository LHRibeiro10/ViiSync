const express = require("express");

const {
  fetchAdminIntegrations,
  fetchAdminUsers,
  fetchAuditTrail,
  fetchObservability,
  postAdminUserBlock,
} = require("./adminConsole.controller");

const router = express.Router();

router.get("/observability", fetchObservability);
router.get("/users", fetchAdminUsers);
router.post("/users/:userId/block", postAdminUserBlock);
router.get("/audit", fetchAuditTrail);
router.get("/integrations", fetchAdminIntegrations);

module.exports = router;
