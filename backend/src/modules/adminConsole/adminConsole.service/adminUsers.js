const prisma = require("../../../lib/prisma");
const { createHttpError, toIso, daysSince } = require("./shared");

const PLAN_MRR = {
  "Plano Fundador": 197,
  Growth: 297,
  Scale: 497,
  Trial: 0,
};

function inferSubscriptionStatus(userStatus) {
  const normalized = String(userStatus || "").toUpperCase();

  if (normalized === "PENDING") {
    return "trial";
  }

  if (normalized === "SUSPENDED") {
    return "overdue";
  }

  return "paid";
}

function inferOnboardingStatus(userStatus, connectedAccounts) {
  const normalized = String(userStatus || "").toUpperCase();

  if (normalized === "SUSPENDED") {
    return "blocked";
  }

  if (connectedAccounts <= 0) {
    return "in_progress";
  }

  return "done";
}

function inferPlan(connectedAccounts, subscriptionStatus) {
  if (subscriptionStatus === "trial") {
    return "Trial";
  }

  if (connectedAccounts >= 4) {
    return "Scale";
  }

  if (connectedAccounts >= 2) {
    return "Growth";
  }

  return "Plano Fundador";
}

function inferChurnRisk(lastActiveAt, isBlocked) {
  if (isBlocked) {
    return "high";
  }

  const daysInactive = daysSince(lastActiveAt);

  if (daysInactive >= 30) {
    return "high";
  }

  if (daysInactive >= 14) {
    return "medium";
  }

  return "low";
}

function mapAdminUser(user) {
  const companyName =
    user.memberships?.[0]?.organization?.name || "Operacao sem nome";
  const connectedAccounts = Array.isArray(user.marketplaceAccounts)
    ? user.marketplaceAccounts.length
    : 0;
  const isBlocked =
    String(user.status || "").toUpperCase() === "SUSPENDED" || Boolean(user.blockedAt);
  const subscriptionStatus = inferSubscriptionStatus(user.status);
  const onboardingStatus = inferOnboardingStatus(user.status, connectedAccounts);
  const lastActiveAt =
    user.lastLoginAt ||
    user.sessions?.[0]?.lastSeenAt ||
    user.sessions?.[0]?.createdAt ||
    user.updatedAt ||
    user.createdAt;
  const churnRisk = inferChurnRisk(lastActiveAt, isBlocked);
  const plan = inferPlan(connectedAccounts, subscriptionStatus);

  return {
    id: user.id,
    name: user.name,
    company: companyName,
    email: user.email,
    plan,
    subscriptionStatus,
    paidSince: subscriptionStatus === "trial" ? null : toIso(user.createdAt),
    onboardingStatus,
    churnRisk,
    connectedAccounts,
    lastActiveAt: toIso(lastActiveAt),
    mrr: PLAN_MRR[plan] || 0,
    isBlocked,
    blockedAt: toIso(user.blockedAt),
    blockReason: user.blockReason || null,
  };
}

function buildUsersSummary(items) {
  return {
    total: items.length,
    paidCount: items.filter((item) => item.subscriptionStatus === "paid").length,
    blockedCount: items.filter((item) => item.isBlocked).length,
    onboardingBlockedCount: items.filter((item) => item.onboardingStatus === "blocked").length,
    churnRiskCount: items.filter((item) => item.churnRisk === "high").length,
    mrrTotal: items.reduce((accumulator, item) => accumulator + Number(item.mrr || 0), 0),
  };
}

async function loadAdminUsers() {
  const users = await prisma.user.findMany({
    include: {
      memberships: {
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      marketplaceAccounts: {
        select: {
          id: true,
        },
      },
      sessions: {
        where: {
          revokedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          createdAt: true,
          lastSeenAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return users.map(mapAdminUser);
}

async function getAdminUsers() {
  const items = await loadAdminUsers();

  return {
    summary: buildUsersSummary(items),
    items,
  };
}

async function toggleAdminUserBlock(userId, payload = {}) {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    throw createHttpError(400, "Seller invalido.");
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      status: true,
      blockedAt: true,
      blockReason: true,
    },
  });

  if (!currentUser) {
    throw createHttpError(404, "Seller nao encontrado.");
  }

  const currentBlocked =
    String(currentUser.status || "").toUpperCase() === "SUSPENDED" || Boolean(currentUser.blockedAt);
  const nextBlocked =
    typeof payload.blocked === "boolean" ? payload.blocked : !currentBlocked;

  await prisma.user.update({
    where: {
      id: currentUser.id,
    },
    data: nextBlocked
      ? {
          status: "SUSPENDED",
          blockedAt: new Date(),
          blockReason:
            String(payload.reason || "").trim() ||
            "Bloqueio administrativo manual.",
        }
      : {
          status: "ACTIVE",
          blockedAt: null,
          blockReason: null,
        },
  });

  const usersPayload = await getAdminUsers();
  const item = usersPayload.items.find((entry) => entry.id === currentUser.id);

  if (!item) {
    throw createHttpError(500, "Nao foi possivel carregar o seller atualizado.");
  }

  return {
    item,
    summary: usersPayload.summary,
  };
}

module.exports = {
  getAdminUsers,
  toggleAdminUserBlock,
};
