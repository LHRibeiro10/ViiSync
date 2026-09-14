const prisma = require("../../../lib/prisma");
const { toIso } = require("./shared");

async function getAuditTrail() {
  const now = new Date();
  const sessions = await prisma.userSession.findMany({
    where: {
      createdAt: {
        gte: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3),
      },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 15,
  });

  return {
    items: sessions.map((session) => ({
      id: `audit-session-${session.id}`,
      actor: session.user?.name || session.user?.email || "Usuario",
      actorRole: "seller",
      action: "Sessao iniciada",
      target: "Autenticacao",
      severity: "neutral",
      createdAt: toIso(session.createdAt),
    })),
  };
}

module.exports = {
  getAuditTrail,
};
