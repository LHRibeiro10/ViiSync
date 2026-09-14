const { parseOptionalNumber } = require("./shared");

function selectBestNumericValue(candidates = []) {
  const parsed = candidates
    .map((value) => parseOptionalNumber(value))
    .filter((value) => value !== null);

  if (!parsed.length) {
    return { found: false, value: 0 };
  }

  const positive = parsed.filter((value) => value > 0);
  if (positive.length) {
    return { found: true, value: Math.max(...positive) };
  }

  return { found: true, value: parsed[0] };
}

function sumNumericValues(candidates = []) {
  let found = false;
  let total = 0;

  for (const candidate of candidates) {
    const parsed = parseOptionalNumber(candidate);
    if (parsed === null) {
      continue;
    }

    found = true;
    total += parsed;
  }

  return {
    found,
    value: found ? total : 0,
  };
}

function resolveMarketplaceFeeInfo(payments = []) {
  const paymentRows = Array.isArray(payments) ? payments : [];
  let found = false;
  let total = 0;

  for (const payment of paymentRows) {
    const direct = selectBestNumericValue([
      payment?.marketplace_fee,
      payment?.marketplace_fee_amount,
      payment?.sale_fee,
      payment?.fee_amount,
    ]);

    const feeDetails = Array.isArray(payment?.fee_details)
      ? payment.fee_details.reduce((sum, feeDetail) => {
          const type = String(
            feeDetail?.type || feeDetail?.fee_type || ""
          ).toLowerCase();
          const shouldUse =
            !type ||
            type.includes("market") ||
            type.includes("sale") ||
            type.includes("fee") ||
            type.includes("financing");

          if (!shouldUse) {
            return sum;
          }

          const amount = parseOptionalNumber(
            feeDetail?.amount !== undefined
              ? feeDetail.amount
              : feeDetail?.cost
          );
          return amount === null ? sum : sum + amount;
        }, 0)
      : null;

    const hasFeeDetails = Number.isFinite(feeDetails);

    if (direct.found) {
      found = true;
      total += direct.value;
      continue;
    }

    if (hasFeeDetails) {
      found = true;
      total += Number(feeDetails);
    }
  }

  return {
    found,
    value: found ? total : 0,
  };
}

function resolveShippingFeeInfo(order = {}, payments = []) {
  const direct = selectBestNumericValue([
    order?.shipping?.cost,
    order?.shipping?.base_cost,
    order?.shipping?.receiver_shipping_cost,
    order?.shipping?.list_cost,
    order?.shipping_cost,
  ]);

  const fromPayments = sumNumericValues(
    (Array.isArray(payments) ? payments : []).flatMap((payment) => [
      payment?.shipping_cost,
      payment?.shipping_amount,
    ])
  );

  if (direct.found) {
    return direct;
  }

  if (fromPayments.found) {
    return fromPayments;
  }

  return {
    found: false,
    value: 0,
  };
}

function resolveDiscountAmountInfo(order = {}) {
  const couponAmount = parseOptionalNumber(order?.coupon?.amount);
  const orderDiscountAmount = parseOptionalNumber(order?.discount_amount);
  const shippingDiscount = parseOptionalNumber(order?.shipping?.discounts);
  const direct = [couponAmount, orderDiscountAmount, shippingDiscount].filter(
    (value) => value !== null
  );

  if (!direct.length) {
    return { found: false, value: 0 };
  }

  return {
    found: true,
    value: direct.reduce((sum, value) => sum + value, 0),
  };
}

function resolveTaxAmountInfo(order = {}, payments = []) {
  const orderTax = selectBestNumericValue([
    order?.tax_amount,
    order?.taxes?.amount,
    order?.taxes_amount,
  ]);
  const paymentTaxes = sumNumericValues(
    (Array.isArray(payments) ? payments : []).flatMap((payment) => [
      payment?.taxes_amount,
      payment?.tax_amount,
    ])
  );

  if (orderTax.found && paymentTaxes.found) {
    return {
      found: true,
      value: Math.max(orderTax.value, paymentTaxes.value),
    };
  }

  if (orderTax.found) {
    return orderTax;
  }

  if (paymentTaxes.found) {
    return paymentTaxes;
  }

  return {
    found: false,
    value: 0,
  };
}

module.exports = {
  selectBestNumericValue,
  sumNumericValues,
  resolveMarketplaceFeeInfo,
  resolveShippingFeeInfo,
  resolveDiscountAmountInfo,
  resolveTaxAmountInfo,
};
