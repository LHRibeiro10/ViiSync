const { randomBytes } = require("crypto");

const prisma = require("../../../lib/prisma");
const { sendPasswordResetEmail } = require("../auth.passwordResetMailer");
const {
  normalizeEmail,
  normalizeText,
  buildPasswordResetWindow,
  resolvePasswordResetBaseUrl,
} = require("./shared");
const { AuthValidationError, AuthUnauthorizedError } = require("./errors");
const { assertPasswordResetRateLimit } = require("./rateLimit");
const { fetchUserForPasswordReset } = require("./userQueries");
const { createPasswordHash, hashSessionToken } = require("./passwordCrypto");

const PASSWORD_RESET_SUCCESS_MESSAGE =
  "Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.";

async function requestPasswordReset(payload = {}, request = {}) {
  const email = normalizeEmail(payload.email);

  if (!email || !email.includes("@")) {
    throw new AuthValidationError("Informe um e-mail valido.");
  }

  const genericResponse = {
    accepted: true,
    message: PASSWORD_RESET_SUCCESS_MESSAGE,
  };

  assertPasswordResetRateLimit(email, request);

  const user = await fetchUserForPasswordReset(email);
  if (!user || user.status === "SUSPENDED" || user.blockedAt) {
    return genericResponse;
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = buildPasswordResetWindow();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  const resetUrl = `${resolvePasswordResetBaseUrl()}/reset-password?token=${encodeURIComponent(
    token
  )}`;

  try {
    await sendPasswordResetEmail({
      toEmail: user.email,
      resetUrl,
      expiresAtIso: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[auth:password-reset:email]", error);
  }

  return genericResponse;
}

async function resetPassword(payload = {}) {
  const token = normalizeText(payload.token);
  const password = String(payload.password || "");

  if (!token) {
    throw new AuthValidationError("Token de redefinicao invalido.");
  }

  if (password.length < 8) {
    throw new AuthValidationError("A senha deve ter pelo menos 8 caracteres.");
  }

  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      userId: true,
      usedAt: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          status: true,
          blockedAt: true,
        },
      },
    },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
    throw new AuthValidationError("Token de redefinicao invalido ou expirado.");
  }

  if (!resetToken.user?.id || resetToken.user.status === "SUSPENDED" || resetToken.user.blockedAt) {
    throw new AuthUnauthorizedError("Sua conta esta suspensa no momento.", {
      status: 403,
      code: "ACCOUNT_SUSPENDED",
    });
  }

  const passwordHash = await createPasswordHash(password);

  const revokeResult = await prisma.$transaction(async (tx) => {
    const consumeResult = await tx.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    });

    if (!consumeResult.count) {
      throw new AuthValidationError("Token de redefinicao invalido ou expirado.");
    }

    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.user.update({
      where: {
        id: resetToken.userId,
      },
      data: {
        passwordHash,
      },
    });

    return tx.userSession.updateMany({
      where: {
        userId: resetToken.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
  });

  return {
    reset: true,
    revokedSessions: revokeResult.count || 0,
    message: "Senha atualizada com sucesso. Faca login novamente.",
  };
}

module.exports = {
  requestPasswordReset,
  resetPassword,
};
