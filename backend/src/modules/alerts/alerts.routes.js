const express = require("express");

const { fetchAlerts } = require("./alerts.controller");

const router = express.Router();

router.get("/", fetchAlerts);

module.exports = router;
