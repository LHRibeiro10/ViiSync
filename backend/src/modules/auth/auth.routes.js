const express = require("express");

const {
  fetchMe,
  postForgotPassword,
  postLogin,
  postLogout,
  postRegister,
  postResetPassword,
} = require("./auth.controller");

const router = express.Router();

router.post("/register", postRegister);
router.post("/login", postLogin);
router.post("/forgot-password", postForgotPassword);
router.post("/reset-password", postResetPassword);
router.get("/me", fetchMe);
router.post("/logout", postLogout);

module.exports = router;
