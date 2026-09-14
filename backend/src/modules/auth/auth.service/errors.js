const SESSION_REPLACED_ERROR_CODE = "SESSION_REPLACED";

class AuthValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthValidationError";
    this.status = 400;
  }
}

class AuthUnauthorizedError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AuthUnauthorizedError";
    this.status = options.status || 401;
    this.code = options.code || "AUTH_UNAUTHORIZED";
  }
}

function buildUnauthorizedSessionResult(
  message = "Sessao invalida ou expirada.",
  code = "SESSION_INVALID",
  status = 401
) {
  return {
    context: null,
    error: {
      message,
      code,
      status,
    },
  };
}

module.exports = {
  SESSION_REPLACED_ERROR_CODE,
  AuthValidationError,
  AuthUnauthorizedError,
  buildUnauthorizedSessionResult,
};
