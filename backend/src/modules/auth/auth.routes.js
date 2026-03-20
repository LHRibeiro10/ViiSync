const express = require("express");

const { fetchMe, postLogin, postLogout, postRegister } = require("./auth.controller");

const router = express.Router();

router.post("/register", postRegister);
router.post("/login", postLogin);
router.get("/me", fetchMe);
router.post("/logout", postLogout);

module.exports = router;
