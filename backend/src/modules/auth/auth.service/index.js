const { AuthUnauthorizedError, AuthValidationError, SESSION_REPLACED_ERROR_CODE } = require("./errors");
const { hashSessionToken } = require("./passwordCrypto");
const { loginUser } = require("./login");
const { registerUser } = require("./registration");
const { requestPasswordReset, resetPassword } = require("./passwordReset");
const {
  getCurrentSession,
  logoutSession,
  resolveSessionContextByToken,
  resolveSessionContextFromRequest,
  resolveSessionValidationFromRequest,
} = require("./session");

module.exports = {
  AuthUnauthorizedError,
  AuthValidationError,
  getCurrentSession,
  hashSessionToken,
  loginUser,
  logoutSession,
  requestPasswordReset,
  registerUser,
  resetPassword,
  SESSION_REPLACED_ERROR_CODE,
  resolveSessionContextByToken,
  resolveSessionContextFromRequest,
  resolveSessionValidationFromRequest,
};
