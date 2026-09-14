const { normalizeText } = require("./config");
const { toIsoDateOrNull, toNumber, parseOptionalNumber, normalizeImageUrl } = require("./shared");
const {
  resolveMarketplaceFeeInfo,
  resolveShippingFeeInfo,
  resolveDiscountAmountInfo,
  resolveTaxAmountInfo,
} = require("./orderMoneyHelpers");

function resolveItemThumbnail(item = {}) {
  const pictures = Array.isArray(item?.pictures) ? item.pictures : [];
  const pictureUrls = pictures.flatMap((picture) => [
    picture?.secure_url,
    picture?.url,
  ]);

  const attributes = Array.isArray(item?.attributes) ? item.attributes : [];
  const attributeImageUrls = attributes
    .filter((attribute) =>
      ["MAIN_PICTURE", "PICTURE", "IMAGE", "THUMBNAIL"].includes(
        String(attribute?.id || "").toUpperCase()
      )
    )
    .flatMap((attribute) => [attribute?.value_name, attribute?.value_id]);

  const [bestImage] = [
    item?.picture_url,
    item?.secure_thumbnail,
    item?.thumbnail,
    ...pictureUrls,
    ...attributeImageUrls,
  ]
    .map((value) => normalizeImageUrl(value))
    .filter(Boolean);

  return bestImage || null;
}

function buildItemSku(item = {}) {
  if (item.seller_custom_field) {
    return String(item.seller_custom_field);
  }

  if (item.seller_sku) {
    return String(item.seller_sku);
  }

  const attributes = Array.isArray(item.attributes) ? item.attributes : [];
  const skuAttribute = attributes.find((attribute) =>
    ["SELLER_SKU", "SKU"].includes(String(attribute?.id || "").toUpperCase())
  );

  return skuAttribute?.value_name ? String(skuAttribute.value_name) : null;
}

function mapQuestion(question = {}, itemData = {}) {
  const answerText = normalizeText(question?.answer?.text || "") || null;
  const answeredAt = toIsoDateOrNull(question?.answer?.date_created || question?.answer?.date_created_from);
  const createdAt =
    toIsoDateOrNull(question?.date_created || question?.created_at) || new Date().toISOString();

  return {
    id: normalizeText(question?.id),
    itemId: normalizeText(question?.item_id),
    itemTitle:
      normalizeText(itemData?.title) ||
      normalizeText(question?.item_title) ||
      `Anuncio ${normalizeText(question?.item_id)}`,
    questionText: normalizeText(question?.text),
    answerText,
    createdAt,
    answeredAt,
    buyerNickname:
      normalizeText(question?.from?.nickname) ||
      (question?.from?.id ? `Comprador ${question.from.id}` : "Comprador"),
    thumbnail: resolveItemThumbnail(itemData),
    sku: buildItemSku(itemData),
    rawPayload: question,
  };
}

function mapOrderEntry(order = {}) {
  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const marketplaceFeeInfo = resolveMarketplaceFeeInfo(payments);
  const shippingFeeInfo = resolveShippingFeeInfo(order, payments);
  const discountAmountInfo = resolveDiscountAmountInfo(order);
  const taxAmountInfo = resolveTaxAmountInfo(order, payments);
  const totalAmount = toNumber(order.total_amount || order.paid_amount, 0);

  return {
    id: normalizeText(order?.id),
    status: normalizeText(order?.status) || "EM_PROCESSAMENTO",
    saleDate:
      toIsoDateOrNull(order?.date_created || order?.date_closed || order?.last_updated) ||
      new Date().toISOString(),
    buyerName: normalizeText(order?.buyer?.nickname) || "Comprador",
    totalAmount,
    marketplaceFee: marketplaceFeeInfo.found ? marketplaceFeeInfo.value : null,
    marketplaceFeeDataFound: marketplaceFeeInfo.found,
    shippingFee: shippingFeeInfo.found ? shippingFeeInfo.value : null,
    shippingFeeDataFound: shippingFeeInfo.found,
    discountAmount: discountAmountInfo.found ? discountAmountInfo.value : null,
    discountAmountDataFound: discountAmountInfo.found,
    taxAmount: taxAmountInfo.found ? taxAmountInfo.value : null,
    taxAmountDataFound: taxAmountInfo.found,
    netReceived:
      totalAmount -
      (marketplaceFeeInfo.found ? marketplaceFeeInfo.value : 0) -
      (shippingFeeInfo.found ? shippingFeeInfo.value : 0) -
      (discountAmountInfo.found ? discountAmountInfo.value : 0) -
      (taxAmountInfo.found ? taxAmountInfo.value : 0),
    items: orderItems.map((entry) => {
      const quantity = toNumber(entry?.quantity, 0);
      const unitPrice = toNumber(entry?.unit_price ?? entry?.full_unit_price, 0);
      const fullUnitPrice = parseOptionalNumber(entry?.full_unit_price);
      const lineTotal = Number.isFinite(fullUnitPrice)
        ? toNumber(fullUnitPrice * quantity, quantity * unitPrice)
        : quantity * unitPrice;
      const taxPercent = parseOptionalNumber(
        entry?.tax_percent ??
          entry?.taxes?.percentage ??
          entry?.item?.tax_percent ??
          entry?.item?.taxes?.percentage
      );
      const taxAmount = parseOptionalNumber(
        entry?.tax_amount ?? entry?.taxes?.amount
      );
      const unitCost = parseOptionalNumber(
        entry?.unit_cost ?? entry?.cost ?? entry?.item?.unit_cost
      );
      const extraCost = parseOptionalNumber(
        entry?.extra_cost ?? entry?.extraCost
      );
      const marketplaceItemId = normalizeText(entry?.item?.id);
      const itemData = entry?.item || {};

      return {
        marketplaceItemId,
        title: normalizeText(itemData?.title) || "Item sem titulo",
        thumbnail: resolveItemThumbnail(itemData),
        sku:
          buildItemSku(itemData) ||
          normalizeText(entry?.seller_sku) ||
          null,
        quantity,
        unitPrice,
        totalPrice: toNumber(lineTotal, quantity * unitPrice),
        taxPercent,
        taxAmount,
        unitCost,
        extraCost,
      };
    }),
    rawPayload: order,
  };
}

function mapItemEntry(item = {}) {
  return {
    id: normalizeText(item?.id),
    title: normalizeText(item?.title) || "Item sem titulo",
    price: toNumber(item?.price, 0),
    status: normalizeText(item?.status) || "unknown",
    availableQuantity: Number(toNumber(item?.available_quantity, 0)),
    thumbnail: resolveItemThumbnail(item),
    category: normalizeText(item?.category_id) || null,
    sku: buildItemSku(item),
    rawPayload: item,
  };
}

module.exports = {
  resolveItemThumbnail,
  buildItemSku,
  mapQuestion,
  mapOrderEntry,
  mapItemEntry,
};
