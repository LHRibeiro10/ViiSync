const { createHash, randomBytes, scrypt: scryptCallback, timingSafeEqual } = require("crypto");
const { promisify } = require("util");

const prisma = require("../../lib/prisma");

const scrypt = promisify(scryptCallback);
const PASSWORD_SCRYPT_KEYLEN = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
const REMEMBER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

class AuthValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthValidationError";
    this.status = 400;
  }
}

class AuthUnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthUnauthorizedError";
    this.status = 401;
  }
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function slugify(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "seller-space";
}

async function createPasswordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, PASSWORD_SCRYPT_KEYLEN);
  return `scrypt$${salt}$${Buffer.from(key).toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") {
    return false;
  }

  if (!storedHash.startsWith("scrypt$")) {
    // Legacy fallback for early dev users created with plain text.
    return storedHash === password;
  }

  const parts = storedHash.split("$");
  if (parts.length !== 3) {
    return false;
  }

  const [, salt, keyHex] = parts;
  const expectedBuffer = Buffer.from(keyHex, "hex");
  const calculated = await scrypt(password, salt, PASSWORD_SCRYPT_KEYLEN);
  const calculatedBuffer = Buffer.from(calculated);

  if (expectedBuffer.length !== calculatedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, calculatedBuffer);
}

function hashSessionToken(sessionToken) {
  return createHash("sha256").update(String(sessionToken || "")).digest("hex");
}

function extractBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || "").trim();

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

function buildSessionWindow(rememberMe) {
  const now = Date.now();
  const duration = rememberMe ? REMEMBER_SESSION_TTL_MS : SESSION_TTL_MS;
  return new Date(now + duration);
}

function resolveClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).trim();
  }

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return (
    request.ip ||
    request.socket?.remoteAddress ||
    request.connection?.remoteAddress ||
    null
  );
}

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

function formatMarketplaceOrderId(marketplacePrefix, index) {
  const suffix = String(index + 1).padStart(6, "0");
  return `${marketplacePrefix}-${suffix}`;
}

async function seedStarterDataForUser(tx, userId, accountIds) {
  const productsSeed = [
    {
      key: "cadeira-gx",
      title: "Cadeira Gamer GX",
      sku: "CADEIRA-GX",
      category: "Cadeiras",
      costPrice: 540,
      extraCost: 14,
      taxPercent: 7.5,
      marketplaceAccountId: accountIds.mercadoLivre,
    },
    {
      key: "teclado-k500",
      title: "Teclado Mecanico K500",
      sku: "TEC-K500",
      category: "Perifericos",
      costPrice: 170,
      extraCost: 6,
      taxPercent: 6.5,
      marketplaceAccountId: accountIds.mercadoLivre,
    },
    {
      key: "fone-x200",
      title: "Fone Bluetooth X200",
      sku: "FONE-X200",
      category: "Audio",
      costPrice: 95,
      extraCost: 4,
      taxPercent: 6,
      marketplaceAccountId: accountIds.mercadoLivre,
    },
    {
      key: "mouse-rgb",
      title: "Mouse Gamer RGB",
      sku: "MOUSE-RGB-01",
      category: "Perifericos",
      costPrice: 62,
      extraCost: 3,
      taxPercent: 5.5,
      marketplaceAccountId: accountIds.shopee,
    },
  ];

  const productByKey = {};

  for (const product of productsSeed) {
    const created = await tx.product.create({
      data: {
        userId,
        marketplaceAccountId: product.marketplaceAccountId,
        title: product.title,
        sku: product.sku,
        category: product.category,
        cost: {
          create: {
            costPrice: product.costPrice,
            extraCost: product.extraCost,
            taxPercent: product.taxPercent,
          },
        },
      },
      include: {
        cost: true,
      },
    });

    productByKey[product.key] = created;
  }

  const now = new Date();
  const orderSeed = [
    {
      productKey: "fone-x200",
      marketplaceAccountId: accountIds.mercadoLivre,
      marketplacePrefix: "MLB",
      daysAgo: 1,
      quantity: 1,
      unitPrice: 189.9,
      marketplaceFee: 28.49,
      shippingFee: 10.2,
      discountAmount: 0,
      status: "ENVIADO",
    },
    {
      productKey: "teclado-k500",
      marketplaceAccountId: accountIds.mercadoLivre,
      marketplacePrefix: "MLB",
      daysAgo: 3,
      quantity: 2,
      unitPrice: 299.9,
      marketplaceFee: 89.97,
      shippingFee: 19.8,
      discountAmount: 20,
      status: "ENTREGUE",
    },
    {
      productKey: "mouse-rgb",
      marketplaceAccountId: accountIds.shopee,
      marketplacePrefix: "SHP",
      daysAgo: 4,
      quantity: 3,
      unitPrice: 129.9,
      marketplaceFee: 46.76,
      shippingFee: 25.8,
      discountAmount: 0,
      status: "PENDENTE",
    },
    {
      productKey: "cadeira-gx",
      marketplaceAccountId: accountIds.shopee,
      marketplacePrefix: "SHP",
      daysAgo: 8,
      quantity: 1,
      unitPrice: 899.9,
      marketplaceFee: 117,
      shippingFee: 64.9,
      discountAmount: 0,
      status: "ENVIADO",
    },
    {
      productKey: "fone-x200",
      marketplaceAccountId: accountIds.mercadoLivre,
      marketplacePrefix: "MLB",
      daysAgo: 11,
      quantity: 4,
      unitPrice: 189.9,
      marketplaceFee: 113.94,
      shippingFee: 36.5,
      discountAmount: 0,
      status: "ENTREGUE",
    },
    {
      productKey: "cadeira-gx",
      marketplaceAccountId: accountIds.mercadoLivre,
      marketplacePrefix: "MLB",
      daysAgo: 17,
      quantity: 1,
      unitPrice: 899.9,
      marketplaceFee: 117,
      shippingFee: 64.9,
      discountAmount: 0,
      status: "ENTREGUE",
    },
  ];

  for (let index = 0; index < orderSeed.length; index += 1) {
    const row = orderSeed[index];
    const product = productByKey[row.productKey];

    if (!product) {
      continue;
    }

    const saleDate = new Date(now);
    saleDate.setDate(now.getDate() - row.daysAgo);

    const grossValue = Number((row.unitPrice * row.quantity).toFixed(2));
    const productCostUnit = (product.cost?.costPrice || 0) + (product.cost?.extraCost || 0);
    const productCostTotal = Number((productCostUnit * row.quantity).toFixed(2));
    const taxPercent = Number(product.cost?.taxPercent || 0);
    const taxAmount = Number((grossValue * (taxPercent / 100)).toFixed(2));
    const totalBeforeDiscount = grossValue;
    const totalAmount = Number((totalBeforeDiscount - row.discountAmount).toFixed(2));
    const netReceived = Number(
      (totalAmount - row.marketplaceFee - row.shippingFee - taxAmount).toFixed(2)
    );
    const profit = Number(
      (totalAmount - row.marketplaceFee - row.shippingFee - productCostTotal - taxAmount).toFixed(2)
    );
    const marginPercent = totalAmount ? Number(((profit / totalAmount) * 100).toFixed(2)) : 0;
    const roiPercent = productCostTotal
      ? Number(((profit / productCostTotal) * 100).toFixed(2))
      : 0;

    const order = await tx.order.create({
      data: {
        userId,
        marketplaceAccountId: row.marketplaceAccountId,
        marketplaceOrderId: formatMarketplaceOrderId(row.marketplacePrefix, index),
        orderNumber: `${row.marketplacePrefix}-${String(index + 1).padStart(5, "0")}`,
        status: row.status,
        buyerName: `Cliente ${index + 1}`,
        saleDate,
        totalAmount,
        marketplaceFee: row.marketplaceFee,
        shippingFee: row.shippingFee,
        discountAmount: row.discountAmount,
        taxAmount,
        netReceived,
      },
    });

    await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        marketplaceItemId: `${row.marketplacePrefix}-ITEM-${String(index + 1).padStart(5, "0")}`,
        title: product.title,
        sku: product.sku,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        totalPrice: totalAmount,
        unitCost: productCostUnit,
        extraCost: 0,
        taxPercent,
        profit,
        marginPercent,
        roiPercent,
      },
    });
  }
}

function mapUserPayload(userRecord) {
  const firstMembership = userRecord.memberships?.[0];

  return {
    id: userRecord.id,
    name: userRecord.name,
    email: userRecord.email,
    role: userRecord.role,
    status: userRecord.status,
    company: firstMembership?.organization?.name || null,
    organizationId: firstMembership?.organizationId || null,
  };
}

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

async function fetchUserWithMembershipByEmail(email) {
  return prisma.user.findUnique({
    where: {
      email,
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

      const marketplaceAccountMain = await tx.marketplaceAccount.create({
        data: {
          userId: user.id,
          marketplace: "Mercado Livre",
          accountName: "Loja Principal ML",
          sellerId: `ML-${randomBytes(4).toString("hex").toUpperCase()}`,
          isActive: true,
        },
      });

      const marketplaceAccountShopee = await tx.marketplaceAccount.create({
        data: {
          userId: user.id,
          marketplace: "Shopee",
          accountName: "Loja Shopee 1",
          sellerId: `SHP-${randomBytes(4).toString("hex").toUpperCase()}`,
          isActive: true,
        },
      });

      await seedStarterDataForUser(tx, user.id, {
        mercadoLivre: marketplaceAccountMain.id,
        shopee: marketplaceAccountShopee.id,
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

  const user = await fetchUserWithMembershipByEmail(email);
  if (!user) {
    throw new AuthUnauthorizedError("E-mail ou senha invalidos.");
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AuthUnauthorizedError("E-mail ou senha invalidos.");
  }

  if (user.status === "SUSPENDED") {
    throw new AuthUnauthorizedError("Sua conta esta suspensa no momento.");
  }

  const userAgent = normalizeText(request.headers?.["user-agent"]) || null;
  const ipAddress = resolveClientIp(request);

  const session = await createSession(prisma, user.id, {
    rememberMe,
    userAgent,
    ipAddress,
  });

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt: new Date(),
    },
  });

  return {
    user: mapUserPayload(user),
    session,
  };
}

async function resolveSessionContextByToken(token) {
  if (!token) {
    return null;
  }

  const sessionTokenHash = hashSessionToken(token);
  const now = new Date();

  const session = await prisma.userSession.findFirst({
    where: {
      sessionTokenHash,
      revokedAt: null,
      expiresAt: {
        gt: now,
      },
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
    return null;
  }

  return {
    token,
    sessionId: session.id,
    expiresAt: session.expiresAt.toISOString(),
    user: mapUserPayload(session.user),
  };
}

async function resolveSessionContextFromRequest(request = {}) {
  const token = extractBearerToken(request.headers?.authorization);

  if (!token) {
    return null;
  }

  return resolveSessionContextByToken(token);
}

async function getCurrentSession(request = {}) {
  const context = await resolveSessionContextFromRequest(request);

  if (!context) {
    throw new AuthUnauthorizedError("Sessao invalida ou expirada.");
  }

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
  AuthUnauthorizedError,
  AuthValidationError,
  getCurrentSession,
  hashSessionToken,
  loginUser,
  logoutSession,
  registerUser,
  resolveSessionContextByToken,
  resolveSessionContextFromRequest,
};
