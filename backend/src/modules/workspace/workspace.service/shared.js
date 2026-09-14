const prisma = require("../../../lib/prisma");
const { resolveSessionContextFromRequest } = require("../../auth/auth.service");

const ENABLE_WORKSPACE_DEMO_DATA =
  String(process.env.ENABLE_WORKSPACE_DEMO_DATA || "")
    .trim()
    .toLowerCase() === "true";

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

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function roundAmount(value) {
  return Number(value.toFixed(2));
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeText(value) {
  return String(value || "").trim();
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
    select: {
      id: true,
    },
  });

  if (!found) {
    throw createHttpError(401, "Sessao invalida ou expirada.");
  }

  return found;
}

module.exports = {
  ENABLE_WORKSPACE_DEMO_DATA,
  MONTH_LABELS,
  cloneData,
  createHttpError,
  roundAmount,
  addDays,
  toIsoDate,
  normalizeText,
  resolveViewerUser,
};
