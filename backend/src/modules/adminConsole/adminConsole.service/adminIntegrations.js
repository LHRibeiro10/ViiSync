const prisma = require("../../../lib/prisma");
const { toneForCount } = require("./shared");

function normalizeMarketplaceName(value) {
  return String(value || "Marketplace").trim() || "Marketplace";
}

function statusFromIssues(issueCount) {
  if (issueCount <= 0) {
    return "success";
  }

  if (issueCount >= 4) {
    return "danger";
  }

  return "warning";
}

async function getAdminIntegrations() {
  const now = new Date();
  const accounts = await prisma.marketplaceAccount.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      marketplace: true,
      accountName: true,
      tokenExpiresAt: true,
      updatedAt: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  const byMarketplace = new Map();

  accounts.forEach((account) => {
    const marketplace = normalizeMarketplaceName(account.marketplace);
    const tokenExpiring =
      account.tokenExpiresAt &&
      account.tokenExpiresAt.getTime() > now.getTime() &&
      account.tokenExpiresAt.getTime() - now.getTime() <= 1000 * 60 * 60 * 48;
    const stale = new Date(account.updatedAt).getTime() < now.getTime() - 1000 * 60 * 60 * 24 * 7;

    const current = byMarketplace.get(marketplace) || {
      id: `mk-${byMarketplace.size + 1}`,
      name: marketplace,
      healthyAccounts: 0,
      accountsWithIssues: 0,
      tokenExpiring: 0,
      reconciliationLag: "0 min",
      incidentCount: 0,
      status: "success",
      note: "",
    };

    const hasIssue = Boolean(tokenExpiring || stale);

    if (hasIssue) {
      current.accountsWithIssues += 1;
      current.incidentCount += 1;
    } else {
      current.healthyAccounts += 1;
    }

    if (tokenExpiring) {
      current.tokenExpiring += 1;
    }

    const lagMinutes = Math.max(
      0,
      Math.round((now.getTime() - new Date(account.updatedAt).getTime()) / (1000 * 60))
    );
    current.reconciliationLag = `${Math.max(
      Number(String(current.reconciliationLag).replace(/[^\d]/g, "")) || 0,
      lagMinutes
    )} min`;

    current.status = statusFromIssues(current.accountsWithIssues);
    current.note =
      current.accountsWithIssues > 0
        ? "Existem contas com token ou sincronizacao exigindo acao."
        : "Contas sem pendencias relevantes no momento.";

    byMarketplace.set(marketplace, current);
  });

  const marketplaces = Array.from(byMarketplace.values());

  const expiringTokens = accounts
    .filter((account) => {
      if (!account.tokenExpiresAt) {
        return false;
      }

      const expiresIn = account.tokenExpiresAt.getTime() - now.getTime();
      return expiresIn > 0 && expiresIn <= 1000 * 60 * 60 * 48;
    })
    .slice(0, 20)
    .map((account) => {
      const expiresInMs = account.tokenExpiresAt.getTime() - now.getTime();
      const expiresInHours = Math.max(1, Math.round(expiresInMs / (1000 * 60 * 60)));

      return {
        id: `tok-${account.id}`,
        accountName: account.accountName,
        marketplace: normalizeMarketplaceName(account.marketplace),
        expiresIn: `${expiresInHours} h`,
        owner: account.user?.name || "Seller",
      };
    });

  return {
    summary: [
      {
        id: "integration-issues",
        label: "Contas com falha",
        value: String(marketplaces.reduce((acc, item) => acc + item.accountsWithIssues, 0)),
        tone: toneForCount(
          marketplaces.reduce((acc, item) => acc + item.accountsWithIssues, 0),
          1,
          8
        ),
      },
      {
        id: "integration-expiring-tokens",
        label: "Tokens expirando",
        value: String(expiringTokens.length),
        tone: toneForCount(expiringTokens.length, 1, 5),
      },
      {
        id: "integration-marketplaces",
        label: "Marketplaces monitorados",
        value: String(marketplaces.length),
        tone: "neutral",
      },
      {
        id: "integration-accounts",
        label: "Contas monitoradas",
        value: String(accounts.length),
        tone: "neutral",
      },
    ],
    marketplaces,
    expiringTokens,
    reconciliationQueue: marketplaces.map((item) => ({
      id: `queue-${item.id}`,
      name: `Pendencias ${item.name}`,
      backlog: item.accountsWithIssues,
      owner: "Integracoes",
      severity: item.accountsWithIssues > 0 ? "warning" : "neutral",
    })),
    incidents: marketplaces
      .filter((item) => item.accountsWithIssues > 0)
      .map((item) => ({
        id: `incident-${item.id}`,
        title: `${item.name} com contas exigindo reconexao`,
        severity: item.accountsWithIssues >= 4 ? "warning" : "success",
        createdAt: now.toISOString(),
      })),
  };
}

module.exports = {
  getAdminIntegrations,
};
