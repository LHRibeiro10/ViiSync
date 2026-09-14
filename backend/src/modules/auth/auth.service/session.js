const { randomBytes } = require("crypto");

const prisma = require("../../../lib/prisma");
const { hashSessionToken } = require("./passwordCrypto");
const { extractBearerToken, buildSessionWindow } = require("./shared");
const { mapUserPayload } = require("./userQueries");
const {
  AuthUnauthorizedError,
  SESSION_REPLACED_ERROR_CODE,
  buildUnauthorizedSessionResult,
} = require("./errors");

async function createSession(tx, userId, { rememberMe = false, userAgent = null, ipAddress = null } = {}) {
  const token = randomBytes(48).toString("hex");
  const sessionTokenHash = hashSessionToken(token);
  const expiresAt = buildSessionWindow(Boolean(rememberMe));

  await tx.userSession.create({
    data: {
      userId,
      sessionTokenHash,
      rememberMe: Boolean(rememberMe),
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    rememberMe: Boolean(rememberMe),
  };
}

async function resolveSessionValidationByToken(token) {
  if (!token) {
    return buildUnauthorizedSessionResult();
  }

  const sessionTokenHash = hashSessionToken(token);
  const now = new Date();
  const session = await prisma.userSession.findUnique({
    where: {
      sessionTokenHash,
    },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              organization: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });

  if (!session || !session.user) {
    return buildUnauthorizedSessionResult();
  }

  if (session.user.status === "SUSPENDED" || session.user.blockedAt) {
    return buildUnauthorizedSessionResult(
      "Sua conta esta suspensa no momento.",
      "ACCOUNT_SUSPENDED",
      403
    );
  }

  if (session.revokedAt) {
    const replacementSession = await prisma.userSession.findFirst({
      where: {
        userId: session.userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
        id: {
          not: session.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (replacementSession) {
      return buildUnauthorizedSessionResult(
        "Voce iniciou sessao em outro navegador.",
        SESSION_REPLACED_ERROR_CODE,
        401
      );
    }

    return buildUnauthorizedSessionResult(
      "Sessao encerrada. Faca login novamente.",
      "SESSION_REVOKED",
      401
    );
  }

  if (session.expiresAt <= now) {
    return buildUnauthorizedSessionResult(
      "Sessao expirada. Faca login novamente.",
      "SESSION_EXPIRED",
      401
    );
  }

  return {
    context: {
      token,
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      user: mapUserPayload(session.user),
    },
    error: null,
  };
}

async function resolveSessionValidationFromRequest(request = {}) {
  const token = extractBearerToken(request.headers?.authorization);
  return resolveSessionValidationByToken(token);
}

async function resolveSessionContextByToken(token) {
  const validation = await resolveSessionValidationByToken(token);
  return validation.context || null;
}

async function resolveSessionContextFromRequest(request = {}) {
  const validation = await resolveSessionValidationFromRequest(request);
  return validation.context || null;
}

async function getCurrentSession(request = {}) {
  const validation = await resolveSessionValidationFromRequest(request);

  if (!validation.context) {
    throw new AuthUnauthorizedError(
      validation.error?.message || "Sessao invalida ou expirada.",
      {
        status: validation.error?.status || 401,
        code: validation.error?.code || "SESSION_INVALID",
      }
    );
  }

  const context = validation.context;

  return {
    user: context.user,
    session: {
      token: context.token,
      expiresAt: context.expiresAt,
    },
  };
}

async function logoutSession(request = {}) {
  const token = extractBearerToken(request.headers?.authorization);

  if (!token) {
    return {
      loggedOut: true,
      revokedSessions: 0,
    };
  }

  const sessionTokenHash = hashSessionToken(token);

  const revokeResult = await prisma.userSession.updateMany({
    where: {
      sessionTokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return {
    loggedOut: true,
    revokedSessions: revokeResult.count || 0,
  };
}

module.exports = {
  createSession,
  resolveSessionValidationByToken,
  resolveSessionValidationFromRequest,
  resolveSessionContextByToken,
  resolveSessionContextFromRequest,
  getCurrentSession,
  logoutSession,
};
