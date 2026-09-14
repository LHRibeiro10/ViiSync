const prisma = require("../../lib/prisma");
const { DEFAULT_PERIOD, resolvePeriodRange } = require("../../lib/period");
const { listMonthKeysBetween, parseReferenceMonth } = require("./dateHelpers");
const {
  round2,
  createHttpError,
  normalizeText,
  resolveViewerUser,
  resolvePeriod,
} = require("./shared");

function clampDueDayToMonth(dueDay, year, monthIndex) {
  const monthLastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(Number(dueDay) || 1, monthLastDay));
}

function countRecurringOccurrencesInRange(dueDay, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  let occurrences = 0;
  let year = start.getFullYear();
  let month = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const day = clampDueDayToMonth(dueDay, year, month);
    const dueDate = new Date(year, month, day, 0, 0, 0, 0);

    if (dueDate.getTime() >= start.getTime() && dueDate.getTime() <= end.getTime()) {
      occurrences += 1;
    }

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return occurrences;
}

function mapAdditionalCostRow(row) {
  return {
    id: row.id,
    description: row.description,
    value: round2(Number(row.amount || 0)),
    monthReference: row.referenceMonth,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null,
  };
}

function normalizeAdditionalCostInput(payload = {}, { partial = false } = {}) {
  const normalized = {};

  if (!partial || payload.description !== undefined) {
    const description = normalizeText(payload.description);

    if (description.length < 2) {
      throw createHttpError(400, "Informe a descricao do gasto adicional.");
    }

    normalized.description = description;
  }

  if (!partial || payload.amount !== undefined || payload.value !== undefined) {
    const amount = Number(
      payload.amount !== undefined ? payload.amount : payload.value
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      throw createHttpError(400, "Informe um valor valido maior que zero.");
    }

    normalized.amount = round2(amount);
  }

  if (!partial || payload.referenceMonth !== undefined || payload.monthReference !== undefined) {
    const referenceMonth = parseReferenceMonth(
      payload.referenceMonth !== undefined
        ? payload.referenceMonth
        : payload.monthReference
    );

    if (!referenceMonth) {
      throw createHttpError(400, "Informe um mes de referencia valido no formato YYYY-MM.");
    }

    normalized.referenceMonth = referenceMonth;
  }

  return normalized;
}

async function getFinancialAdjustmentsForUser(userId, period = "30d") {
  if (!userId) {
    return {
      recurringTotal: 0,
      additionalTotal: 0,
      totalAdjustments: 0,
      additionalCosts: [],
      monthKeys: [],
    };
  }

  const resolvedPeriod = resolvePeriod(period);
  const periodRange = resolvePeriodRange(resolvedPeriod, {
    fallbackPeriod: DEFAULT_PERIOD,
  });
  const periodStart = periodRange.startDate;
  const periodEnd = periodRange.endDate;
  const monthKeys = listMonthKeysBetween(periodStart, periodEnd);

  const [recurringExpenses, additionalCosts] = await Promise.all([
    prisma.recurringExpense.findMany({
      where: {
        userId,
      },
      select: {
        amount: true,
        dueDay: true,
      },
    }),
    prisma.additionalCost.findMany({
      where: {
        userId,
        ...(monthKeys.length
          ? {
              referenceMonth: {
                in: monthKeys,
              },
            }
          : {}),
      },
      orderBy: [{ referenceMonth: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const recurringTotal = round2(
    recurringExpenses.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return sum;
      }

      const occurrences = countRecurringOccurrencesInRange(
        item.dueDay,
        periodStart,
        periodEnd
      );

      return sum + amount * occurrences;
    }, 0)
  );

  const additionalTotal = round2(
    additionalCosts.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );

  return {
    recurringTotal,
    additionalTotal,
    totalAdjustments: round2(recurringTotal + additionalTotal),
    additionalCosts: additionalCosts.map(mapAdditionalCostRow),
    monthKeys,
  };
}

async function listAdditionalCosts(period = "30d", request = {}) {
  const user = await resolveViewerUser(request);
  const resolvedPeriod = resolvePeriod(period);
  const adjustments = await getFinancialAdjustmentsForUser(user.id, resolvedPeriod);

  return {
    period: resolvedPeriod,
    summary: {
      count: adjustments.additionalCosts.length,
      total: round2(adjustments.additionalTotal),
    },
    items: adjustments.additionalCosts,
  };
}

async function createAdditionalCost(payload = {}, period = "30d", request = {}) {
  const user = await resolveViewerUser(request);
  const normalized = normalizeAdditionalCostInput(payload, { partial: false });

  await prisma.additionalCost.create({
    data: {
      userId: user.id,
      description: normalized.description,
      amount: normalized.amount,
      referenceMonth: normalized.referenceMonth,
    },
  });

  return {
    ...(await listAdditionalCosts(period, request)),
    message: "Gasto adicional cadastrado com sucesso.",
  };
}

async function updateAdditionalCost(costId, payload = {}, period = "30d", request = {}) {
  const user = await resolveViewerUser(request);
  const id = normalizeText(costId);

  if (!id) {
    throw createHttpError(400, "Gasto adicional invalido.");
  }

  const existing = await prisma.additionalCost.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!existing) {
    throw createHttpError(404, "Gasto adicional nao encontrado.");
  }

  const normalized = normalizeAdditionalCostInput(payload, { partial: true });

  if (!Object.keys(normalized).length) {
    throw createHttpError(400, "Nenhuma alteracao valida foi informada.");
  }

  await prisma.additionalCost.update({
    where: {
      id: existing.id,
    },
    data: normalized,
  });

  return {
    ...(await listAdditionalCosts(period, request)),
    message: "Gasto adicional atualizado com sucesso.",
  };
}

async function removeAdditionalCost(costId, period = "30d", request = {}) {
  const user = await resolveViewerUser(request);
  const id = normalizeText(costId);

  if (!id) {
    throw createHttpError(400, "Gasto adicional invalido.");
  }

  const existing = await prisma.additionalCost.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw createHttpError(404, "Gasto adicional nao encontrado.");
  }

  await prisma.additionalCost.delete({
    where: {
      id: existing.id,
    },
  });

  return {
    ...(await listAdditionalCosts(period, request)),
    message: "Gasto adicional removido com sucesso.",
  };
}

module.exports = {
  getFinancialAdjustmentsForUser,
  listAdditionalCosts,
  createAdditionalCost,
  updateAdditionalCost,
  removeAdditionalCost,
};
