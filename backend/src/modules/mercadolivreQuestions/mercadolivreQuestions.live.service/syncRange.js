const { buildCustomRange, resolvePeriodRange } = require("../../../lib/period");
const { throwClientError } = require("./config");

function resolveSyncRange(options = {}) {
  const hasDateOverrides = Boolean(options?.startDate || options?.endDate);

  if (hasDateOverrides) {
    try {
      return buildCustomRange(options.startDate, options.endDate, { strict: true });
    } catch (error) {
      throwClientError(
        error?.message || "Intervalo de datas invalido para sincronizacao.",
        400
      );
    }
  }

  try {
    return resolvePeriodRange(options?.period || "30d", {
      fallbackPeriod: "30d",
      strict: true,
    });
  } catch (error) {
    throwClientError(error?.message || "Periodo invalido para sincronizacao.", 400);
  }
}

function isOrderInsideRange(order = {}, range = null) {
  if (!range || !range.startDate || !range.endDate) {
    return true;
  }

  const saleTimestamp = new Date(order?.saleDate || order?.createdAt || 0).getTime();

  if (!Number.isFinite(saleTimestamp)) {
    return false;
  }

  return (
    saleTimestamp >= range.startDate.getTime() &&
    saleTimestamp <= range.endDate.getTime()
  );
}

module.exports = {
  resolveSyncRange,
  isOrderInsideRange,
};
