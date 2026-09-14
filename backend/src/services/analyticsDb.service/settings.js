const { resolveViewerUser, reportDateFormatter } = require("./shared");

async function getSettings(request = {}) {
  const user = await resolveViewerUser(request);

  const company = user.memberships?.[0]?.organization?.name || "ViiSync Seller";

  return {
    profile: {
      name: user.name,
      email: user.email,
      company,
    },
    preferences: {
      theme: "Claro",
      periodDefault: "30 dias",
      notifications: "Ativadas",
    },
    security: {
      lastPasswordChange: user.updatedAt
        ? reportDateFormatter.format(new Date(user.updatedAt))
        : "",
      twoFactor: "Desativado",
    },
  };
}

module.exports = {
  getSettings,
};
