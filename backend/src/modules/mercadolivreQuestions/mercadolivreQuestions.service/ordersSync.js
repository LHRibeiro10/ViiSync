const prisma = require("../../../lib/prisma");
const { normalizeText, round2, toNumber, ensureDate } = require("./primitives");
const { ensureProductForOrderItem } = require("./productUpsert");

async function persistRemoteOrders(user, account, remoteOrders = [], lastSyncAt = null) {
  const syncTimestamp = ensureDate(lastSyncAt, new Date()) || new Date();
  let imported = 0;
  const productCostByProductId = new Map();

  for (const remoteOrder of remoteOrders) {
    const marketplaceOrderId = normalizeText(remoteOrder?.id);
    if (!marketplaceOrderId) {
      continue;
    }

    const saleDate =
      ensureDate(remoteOrder?.saleDate, null) ||
      ensureDate(remoteOrder?.createdAt, null) ||
      syncTimestamp;
    const marketplaceFeeDataFound =
      typeof remoteOrder?.marketplaceFeeDataFound === "boolean"
        ? remoteOrder.marketplaceFeeDataFound
        : remoteOrder?.marketplaceFee !== null &&
          remoteOrder?.marketplaceFee !== undefined;
    const shippingFeeDataFound =
      typeof remoteOrder?.shippingFeeDataFound === "boolean"
        ? remoteOrder.shippingFeeDataFound
        : remoteOrder?.shippingFee !== null &&
          remoteOrder?.shippingFee !== undefined;
    const taxAmountDataFound =
      typeof remoteOrder?.taxAmountDataFound === "boolean"
        ? remoteOrder.taxAmountDataFound
        : remoteOrder?.taxAmount !== null && remoteOrder?.taxAmount !== undefined;
    const totalAmount = round2(toNumber(remoteOrder?.totalAmount, 0));
    const marketplaceFee = round2(toNumber(remoteOrder?.marketplaceFee, 0));
    const shippingFee = round2(toNumber(remoteOrder?.shippingFee, 0));
    const discountAmount = round2(toNumber(remoteOrder?.discountAmount, 0));
    const taxAmount = round2(toNumber(remoteOrder?.taxAmount, 0));
    const netReceived = round2(
      toNumber(
        remoteOrder?.netReceived,
        totalAmount - marketplaceFee - shippingFee - discountAmount - taxAmount
      )
    );

    const existingOrder = await prisma.order.findFirst({
      where: {
        userId: user.id,
        marketplaceAccountId: account.id,
        marketplaceOrderId,
      },
      select: {
        id: true,
      },
    });

    const orderRecord = existingOrder?.id
      ? await prisma.order.update({
          where: {
            id: existingOrder.id,
          },
          data: {
            orderNumber: marketplaceOrderId,
            status: normalizeText(remoteOrder?.status) || "EM_PROCESSAMENTO",
            buyerName: normalizeText(remoteOrder?.buyerName) || "Comprador",
            saleDate,
            totalAmount,
            marketplaceFee,
            marketplaceFeeMissing: !marketplaceFeeDataFound,
            shippingFee,
            shippingFeeMissing: !shippingFeeDataFound,
            discountAmount,
            taxAmount,
            taxAmountMissing: !taxAmountDataFound,
            netReceived,
            cancelled: false,
          },
          select: {
            id: true,
          },
        })
      : await prisma.order.create({
          data: {
            userId: user.id,
            marketplaceAccountId: account.id,
            marketplaceOrderId,
            orderNumber: marketplaceOrderId,
            status: normalizeText(remoteOrder?.status) || "EM_PROCESSAMENTO",
            buyerName: normalizeText(remoteOrder?.buyerName) || "Comprador",
            saleDate,
            totalAmount,
            marketplaceFee,
            marketplaceFeeMissing: !marketplaceFeeDataFound,
            shippingFee,
            shippingFeeMissing: !shippingFeeDataFound,
            discountAmount,
            taxAmount,
            taxAmountMissing: !taxAmountDataFound,
            netReceived,
            cancelled: false,
          },
          select: {
            id: true,
          },
        });

    await prisma.orderItem.deleteMany({
      where: {
        orderId: orderRecord.id,
      },
    });

    const items = Array.isArray(remoteOrder?.items) ? remoteOrder.items : [];
    const grossBase = items.reduce((sum, item) => {
      return sum + round2(toNumber(item.totalPrice, toNumber(item.quantity, 0) * toNumber(item.unitPrice, 0)));
    }, 0);
    const fallbackShare = items.length ? 1 / items.length : 0;

    for (const item of items) {
      const quantity = Math.max(0, Math.floor(toNumber(item.quantity, 0)));
      if (!quantity) {
        continue;
      }

      const unitPrice = round2(toNumber(item.unitPrice, 0));
      const totalPrice = round2(toNumber(item.totalPrice, quantity * unitPrice));
      const share = grossBase > 0 ? totalPrice / grossBase : fallbackShare;
      const feeShare = round2(marketplaceFee * share);
      const shippingShare = round2(shippingFee * share);
      const discountShare = round2(discountAmount * share);
      const orderTaxShare = round2(taxAmount * share);
      const grossRevenue = round2(totalPrice - discountShare);
      const productId = await ensureProductForOrderItem(
        user.id,
        account.id,
        item,
        syncTimestamp
      );
      let productCostRow = null;

      if (productId) {
        if (productCostByProductId.has(productId)) {
          productCostRow = productCostByProductId.get(productId);
        } else {
          productCostRow = await prisma.productCost.findUnique({
            where: {
              productId,
            },
            select: {
              costPrice: true,
              extraCost: true,
              taxPercent: true,
            },
          });

          productCostByProductId.set(productId, productCostRow || null);
        }
      }

      const remoteUnitCostValue = Number(
        item?.unitCost ?? item?.unit_cost ?? item?.cost
      );
      const remoteExtraCostRaw = item?.extraCost ?? item?.extra_cost;
      const remoteExtraCostValue = Number(remoteExtraCostRaw);
      const remoteItemTaxAmountValue = Number(
        item?.taxAmount ?? item?.tax_amount
      );
      const hasRemoteItemTaxAmount =
        Number.isFinite(remoteItemTaxAmountValue) && remoteItemTaxAmountValue >= 0;
      const hasRemoteUnitCost =
        Number.isFinite(remoteUnitCostValue) && remoteUnitCostValue >= 0;
      const hasRemoteExtraCost =
        remoteExtraCostRaw !== null &&
        remoteExtraCostRaw !== undefined &&
        remoteExtraCostRaw !== "" &&
        Number.isFinite(remoteExtraCostValue) &&
        remoteExtraCostValue >= 0;

      const unitCost = hasRemoteUnitCost
        ? round2(remoteUnitCostValue)
        : round2(toNumber(productCostRow?.costPrice, 0));
      const extraCost = hasRemoteExtraCost
        ? round2(remoteExtraCostValue)
        : round2(toNumber(productCostRow?.extraCost, 0));
      const taxPercentFromCatalog = toNumber(productCostRow?.taxPercent, 0);
      const taxPercentFromItem = Number(item?.taxPercent ?? item?.tax_percent);
      const hasTaxPercentFromItem =
        Number.isFinite(taxPercentFromItem) && taxPercentFromItem > 0;
      const hasTaxPercentFromCatalog =
        Number.isFinite(taxPercentFromCatalog) && taxPercentFromCatalog > 0;
      const taxPercentFromOrderShare =
        grossRevenue > 0 && orderTaxShare > 0
          ? round2((orderTaxShare / grossRevenue) * 100)
          : 0;
      const taxPercent =
        hasTaxPercentFromItem
          ? round2(taxPercentFromItem)
          : hasTaxPercentFromCatalog
            ? round2(taxPercentFromCatalog)
            : taxPercentFromOrderShare;
      const estimatedTaxFromPercent =
        taxPercent > 0 && grossRevenue > 0
          ? round2(grossRevenue * (taxPercent / 100))
          : 0;
      const itemTaxAmount = hasRemoteItemTaxAmount
        ? round2(remoteItemTaxAmountValue)
        : 0;
      const appliedTaxAmount =
        orderTaxShare > 0
          ? orderTaxShare
          : itemTaxAmount > 0
            ? itemTaxAmount
            : estimatedTaxFromPercent;
      const hasCatalogUnitCost =
        Number.isFinite(Number(productCostRow?.costPrice));
      const unitCostMissing = !hasRemoteUnitCost && !hasCatalogUnitCost;
      const productCost = round2(unitCost * quantity + extraCost);
      const profit = round2(
        grossRevenue - feeShare - shippingShare - productCost - appliedTaxAmount
      );
      const marginPercent = grossRevenue ? round2((profit / grossRevenue) * 100) : 0;
      const roiPercent = productCost ? round2((profit / productCost) * 100) : 0;

      await prisma.orderItem.create({
        data: {
          orderId: orderRecord.id,
          productId,
          marketplaceItemId: normalizeText(item.marketplaceItemId) || null,
          title: normalizeText(item.title) || "Item sem titulo",
          sku: normalizeText(item.sku) || null,
          quantity,
          unitPrice,
          totalPrice: grossRevenue,
          unitCost,
          unitCostMissing,
          extraCost,
          taxPercent,
          profit,
          marginPercent,
          roiPercent,
        },
      });
    }

    imported += 1;
  }

  await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      lastSyncedAt: syncTimestamp,
      integrationStatus: "connected",
    },
  });

  return {
    imported,
    lastSyncAt: syncTimestamp.toISOString(),
  };
}

module.exports = {
  persistRemoteOrders,
};
