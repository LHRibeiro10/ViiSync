const prisma = require("../../lib/prisma");
const {
  resolveViewerUser,
  normalizeText,
  normalizeThumbnailUrl,
  formatCurrency,
  formatPercent,
  buildRealMarketplaceAccountWhere,
  hasRealMarketplaceIdentity,
} = require("./shared");

function isLikelyMockProduct(product = {}) {
  const thumbnail = normalizeText(product?.thumbnail).toLowerCase();
  const hasSeedThumbnail = thumbnail.includes("picsum.photos/seed/viisync-");
  const hasMarketplaceProductId = Boolean(
    normalizeText(product?.marketplaceProductId)
  );
  const hasSellerId = hasRealMarketplaceIdentity(product?.marketplaceAccount || {});

  return hasSeedThumbnail && !hasMarketplaceProductId && !hasSellerId;
}

function createProductPhoto(startColor, endColor) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="24" fill="url(#g)" />
      <rect x="12" y="12" width="72" height="72" rx="18" fill="rgba(255,255,255,0.18)" />
      <circle cx="36" cy="38" r="7" fill="rgba(255,255,255,0.62)" />
      <path d="M24 66l14-14 10 10 8-8 16 12H24z" fill="rgba(255,255,255,0.72)" />
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function photoColorsForId(id = "") {
  const palette = [
    ["#1d4ed8", "#60a5fa"],
    ["#7c3aed", "#8b5cf6"],
    ["#0891b2", "#22d3ee"],
    ["#16a34a", "#4ade80"],
    ["#dc2626", "#fb7185"],
    ["#0f172a", "#334155"],
  ];

  let acc = 0;
  const text = String(id || "");
  for (let index = 0; index < text.length; index += 1) {
    acc += text.charCodeAt(index);
  }

  return palette[acc % palette.length];
}

async function getProducts(request = {}) {
  const user = await resolveViewerUser(request);

  const products = await prisma.product.findMany({
    where: {
      userId: user.id,
      marketplaceProductId: {
        not: null,
      },
      marketplaceAccount: {
        is: buildRealMarketplaceAccountWhere(),
      },
    },
    include: {
      cost: true,
      marketplaceAccount: true,
      orderItems: {
        include: {
          order: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 60,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const activeCutoff = new Date();
  activeCutoff.setDate(activeCutoff.getDate() - 90);

  return products
    .filter((product) => !isLikelyMockProduct(product))
    .map((product) => {
    const orderItems = Array.isArray(product.orderItems) ? product.orderItems : [];
    const avgPrice = orderItems.length
      ? orderItems.reduce((sum, item) => sum + Number(item.unitPrice || 0), 0) / orderItems.length
      : 0;
    const baseCost = Number(product.cost?.costPrice || 0) + Number(product.cost?.extraCost || 0);
    const avgCost = baseCost || (orderItems.length
      ? orderItems.reduce((sum, item) => sum + Number(item.unitCost || 0), 0) / orderItems.length
      : 0);
    const marginFromItems = orderItems.length
      ? orderItems.reduce((sum, item) => sum + Number(item.marginPercent || 0), 0) / orderItems.length
      : 0;
    const taxPercent = Number(product.cost?.taxPercent || 0);
    const computedMargin = avgPrice
      ? ((avgPrice - avgCost - avgPrice * (taxPercent / 100)) / avgPrice) * 100
      : 0;
    const margin = Number.isFinite(marginFromItems) && marginFromItems > 0
      ? marginFromItems
      : computedMargin;
    const hasRecentOrders = orderItems.some((item) => {
      const saleDate = item.order?.saleDate ? new Date(item.order.saleDate) : null;
      return saleDate && saleDate.getTime() >= activeCutoff.getTime();
    });
    const isActive = Boolean(product.marketplaceAccount?.isActive) && hasRecentOrders;

    return {
      id: product.id,
      name: product.title,
      thumbnail: normalizeThumbnailUrl(product.thumbnail),
      sku: product.sku || "N/A",
      price: formatCurrency(avgPrice),
      cost: formatCurrency(avgCost),
      margin: formatPercent(margin),
      status: isActive ? "Ativo" : "Pausado",
    };
  });
}

module.exports = {
  isLikelyMockProduct,
  createProductPhoto,
  photoColorsForId,
  getProducts,
};
