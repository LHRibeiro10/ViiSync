const {
  AuthUnauthorizedError,
  AuthValidationError,
  getCurrentSession,
  loginUser,
  logoutSession,
  requestPasswordReset,
  registerUser,
  resetPassword,
} = require("./auth.service");

async function postRegister(req, res) {
  try {
    const payload = await registerUser(req.body, req);
    res.status(201).json(payload);
  } catch (error) {
    handleAuthError(error, res);
  }
}

async function postLogin(req, res) {
  try {
    const payload = await loginUser(req.body, req);
    res.json(payload);
  } catch (error) {
    handleAuthError(error, res);
  }
}

async function fetchMe(req, res) {
  try {
    const payload = await getCurrentSession(req);
    res.json(payload);
  } catch (error) {
    handleAuthError(error, res);
  }
}

async function postLogout(req, res) {
  try {
    const payload = await logoutSession(req);
    res.json(payload);
  } catch (error) {
    handleAuthError(error, res);
  }
}

async function postForgotPassword(req, res) {
  try {
    const payload = await requestPasswordReset(req.body, req);
    res.json(payload);
  } catch (error) {
    handleAuthError(error, res);
  }
}

async function postResetPassword(req, res) {
  try {
    const payload = await resetPassword(req.body);
    res.json(payload);
  } catch (error) {
    handleAuthError(error, res);
  }
}

function handleAuthError(error, res) {
  if (error instanceof AuthValidationError) {
    res.status(error.status || 400).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
    return;
  }

  if (error instanceof AuthUnauthorizedError) {
    res.status(error.status || 401).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
    return;
  }

  if (error && Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    res.status(error.status).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
    return;
  }

  console.error("[auth]", error);
  res.status(500).json({
    error: "Nao foi possivel processar a autenticacao.",
  });
}

module.exports = {
  fetchMe,
  postForgotPassword,
  postLogin,
  postLogout,
  postRegister,
  postResetPassword,
};
