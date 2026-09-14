const prisma = require("../../../lib/prisma");
const { normalizeEmail, normalizeText, resolveClientIp } = require("./shared");
const { AuthValidationError, AuthUnauthorizedError } = require("./errors");
const { assertLoginRateLimit } = require("./rateLimit");
const { mapUserPayload, fetchUserWithMembershipByEmail } = require("./userQueries");
const { verifyPassword } = require("./passwordCrypto");
const { createSession } = require("./session");

async function loginUser(payload = {}, request = {}) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const rememberMe = Boolean(payload.rememberMe);

  if (!email || !email.includes("@")) {
    throw new AuthValidationError("Informe um e-mail valido.");
  }

  if (!password) {
    throw new AuthValidationError("Informe sua senha.");
  }

  assertLoginRateLimit(email, request);

  const user = await fetchUserWithMembershipByEmail(email);
  if (!user) {
    throw new AuthUnauthorizedError("E-mail ou senha invalidos.");
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AuthUnauthorizedError("E-mail ou senha invalidos.");
  }

  if (user.status === "SUSPENDED" || user.blockedAt) {
    throw new AuthUnauthorizedError("Sua conta esta suspensa no momento.");
  }

  const userAgent = normalizeText(request.headers?.["user-agent"]) || null;
  const ipAddress = resolveClientIp(request);

  const session = await prisma.$transaction(async (tx) => {
    await tx.userSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const createdSession = await createSession(tx, user.id, {
      rememberMe,
      userAgent,
      ipAddress,
    });

    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return createdSession;
  });

  return {
    user: mapUserPayload(user),
    session,
  };
}

module.exports = {
  loginUser,
};
