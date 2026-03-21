const { resolveSessionValidationFromRequest } = require("./auth.service");

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function sendAuthError(res, status, message, code = null) {
  return res.status(status).json({
    error: message,
    ...(code ? { code } : {}),
  });
}

async function requireAuth(req, res, next) {
  try {
    const validation = await resolveSessionValidationFromRequest(req);
    const sessionContext = validation?.context || null;

    if (!sessionContext?.user?.id) {
      return sendAuthError(
        res,
        validation?.error?.status || 401,
        validation?.error?.message || "Sessao invalida ou expirada.",
        validation?.error?.code || null
      );
    }

    if (normalizeRole(sessionContext.user.status) === "SUSPENDED") {
      return sendAuthError(res, 403, "Sua conta esta suspensa no momento.");
    }

    req.auth = sessionContext;
    return next();
  } catch (error) {
    console.error("[auth-middleware:requireAuth]", error);
    return sendAuthError(res, 500, "Nao foi possivel validar a sessao.");
  }
}

function requireRoles(...allowedRoles) {
  const allowed = new Set(allowedRoles.map(normalizeRole).filter(Boolean));

  return (req, res, next) => {
    if (!req.auth?.user?.id) {
      return sendAuthError(res, 401, "Sessao invalida ou expirada.");
    }

    const userRole = normalizeRole(req.auth.user.role);

    if (!allowed.has(userRole)) {
      return sendAuthError(res, 403, "Voce nao possui permissao para esta operacao.");
    }

    return next();
  };
}

const requireAdmin = requireRoles("ADMIN");

module.exports = {
  requireAdmin,
  requireAuth,
  requireRoles,
};
