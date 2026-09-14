function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toIso(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function daysSince(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  const diffMs = Date.now() - timestamp;
  return diffMs / (1000 * 60 * 60 * 24);
}

function toneForCount(value, warningThreshold = 1, dangerThreshold = 5) {
  const numeric = Number(value || 0);

  if (numeric >= dangerThreshold) {
    return "danger";
  }

  if (numeric >= warningThreshold) {
    return "warning";
  }

  return "success";
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")}%`;
}

function formatMilliseconds(value) {
  return `${Math.max(0, Math.round(Number(value || 0)))} ms`;
}

function formatDurationMinutes(value) {
  const minutes = Math.max(0, Math.round(Number(value || 0)));
  return `${minutes} min`;
}

module.exports = {
  createHttpError,
  toIso,
  daysSince,
  toneForCount,
  formatPercent,
  formatMilliseconds,
  formatDurationMinutes,
};
