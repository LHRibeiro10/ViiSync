const prisma = require("../../lib/prisma");
const { resolveSessionContextFromRequest } = require("../../modules/auth/auth.service");
const { DEFAULT_PERIOD, resolvePeriod: resolvePeriodValue } = require("../../lib/period");

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});
const reportDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const tableDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function resolvePeriod(period) {
  return resolvePeriodValue(period, DEFAULT_PERIOD);
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeThumbnailUrl(value) {
  const url = normalizeText(value);

  if (!url) {
    return null;
  }

  if (url.startsWith("data:image/")) {
    return url;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (url.startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }

  if (url.startsWith("https://")) {
    return url;
  }

  return null;
}

function isMercadoLivreMarketplace(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("mercado livre") || normalized.includes("mercadolivre");
}

function hasRealMarketplaceIdentity(account = {}) {
  return Boolean(normalizeText(account?.sellerId));
}

function buildRealMarketplaceAccountWhere() {
  return {
    sellerId: {
      not: null,
    },
    OR: [
      {
        marketplace: {
          contains: "mercado livre",
          mode: "insensitive",
        },
      },
      {
        marketplace: {
          contains: "mercadolivre",
          mode: "insensitive",
        },
      },
    ],
  };
}

async function resolveViewerUser(request = {}) {
  const sessionContext = await resolveSessionContextFromRequest(request);

  if (!sessionContext?.user?.id) {
    throw createHttpError(401, "Sessao invalida ou expirada.");
  }

  const found = await prisma.user.findUnique({
    where: {
      id: sessionContext.user.id,
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

  if (!found) {
    throw createHttpError(401, "Sessao invalida ou expirada.");
  }

  return found;
}

module.exports = {
  currencyFormatter,
  percentFormatter,
  shortDateFormatter,
  reportDateFormatter,
  tableDateFormatter,
  dateTimeFormatter,
  MONTH_LABELS,
  resolvePeriod,
  round2,
  formatCurrency,
  formatPercent,
  createHttpError,
  normalizeText,
  normalizeThumbnailUrl,
  isMercadoLivreMarketplace,
  hasRealMarketplaceIdentity,
  buildRealMarketplaceAccountWhere,
  resolveViewerUser,
};
