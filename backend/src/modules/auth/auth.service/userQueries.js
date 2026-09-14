const prisma = require("../../../lib/prisma");

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

async function fetchUserForPasswordReset(email) {
  return prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      status: true,
      blockedAt: true,
    },
  });
}

module.exports = {
  mapUserPayload,
  fetchUserWithMembershipByEmail,
  fetchUserForPasswordReset,
};
