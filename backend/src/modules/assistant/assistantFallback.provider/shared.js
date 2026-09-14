const { getPeriodLabel } = require("../../../lib/period");

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function labelForPeriod(period) {
  return getPeriodLabel(period);
}

module.exports = {
  hasAny,
  labelForPeriod,
};
