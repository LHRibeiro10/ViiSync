const prisma = require("../../../lib/prisma");
const { normalizeText, normalizeEmail, slugify, resolveClientIp } = require("./shared");
const { AuthValidationError } = require("./errors");
const { createPasswordHash } = require("./passwordCrypto");
const { mapUserPayload, fetchUserWithMembershipByEmail } = require("./userQueries");
const { createSession } = require("./session");

async function buildUniqueOrganizationSlug(tx, companyName) {
  const baseSlug = slugify(companyName);
  let candidate = baseSlug;
  let counter = 0;

  while (true) {
    const existing = await tx.organization.findUnique({
      where: {
        slug: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return candidate;
    }

    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
}

async function registerUser(payload = {}, request = {}) {
  const name = normalizeText(payload.name);
  const company = normalizeText(payload.company || "ViiSync Seller");
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const rememberMe = Boolean(payload.rememberMe);

  if (name.length < 3) {
    throw new AuthValidationError("Informe um nome com pelo menos 3 caracteres.");
  }

  if (company.length < 2) {
    throw new AuthValidationError("Informe o nome da empresa.");
  }

  if (!email || !email.includes("@")) {
    throw new AuthValidationError("Informe um e-mail valido.");
  }

  if (password.length < 8) {
    throw new AuthValidationError("A senha deve ter pelo menos 8 caracteres.");
  }

  const existingUser = await fetchUserWithMembershipByEmail(email);
  if (existingUser) {
    throw new AuthValidationError("Ja existe uma conta cadastrada com esse e-mail.");
  }

  const passwordHash = await createPasswordHash(password);
  const userAgent = normalizeText(request.headers?.["user-agent"]) || null;
  const ipAddress = resolveClientIp(request);

  const result = await prisma.$transaction(
    async (tx) => {
      const organizationSlug = await buildUniqueOrganizationSlug(tx, company);
      const organization = await tx.organization.create({
        data: {
          name: company,
          slug: organizationSlug,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "SELLER",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          acceptedTermsAt: new Date(),
        },
      });

      await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      const session = await createSession(tx, user.id, {
        rememberMe,
        userAgent,
        ipAddress,
      });

      const fullUser = await tx.user.findUnique({
        where: {
          id: user.id,
        },
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
      });

      return {
        session,
        user: fullUser,
      };
    },
    {
      maxWait: 10000,
      timeout: 20000,
    }
  );

  return {
    user: mapUserPayload(result.user),
    session: result.session,
  };
}

module.exports = {
  registerUser,
};
