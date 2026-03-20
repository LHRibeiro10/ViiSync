function createProductPhoto(label, startColor, endColor) {
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
      <text x="48" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">
        ${label}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function calculateProfit(item) {
  const taxAmount = item.value * (item.taxPercent / 100);
  const profit =
    item.value - item.fee - item.sellerShipping - item.productCost - taxAmount;

  return Number(profit.toFixed(2));
}

function createProfitRow(row) {
  return {
    ...row,
    profit: calculateProfit(row),
  };
}

function createProfitReportRow(row) {
  const grossRevenue = Number((row.salePrice * row.quantity).toFixed(2));
  const netProfit = Number(
    (
      grossRevenue -
      row.marketplaceFee -
      row.shippingPaid -
      row.productCost
    ).toFixed(2)
  );
  const profitMargin = grossRevenue
    ? Number(((netProfit / grossRevenue) * 100).toFixed(2))
    : 0;
  const roi = row.productCost
    ? Number(((netProfit / row.productCost) * 100).toFixed(2))
    : 0;

  return {
    ...row,
    grossRevenue,
    netProfit,
    profitMargin,
    roi,
  };
}

const dashboardSummaries = {
  "7d": {
    revenue: 4250.5,
    profit: 1160.2,
    sales: 29,
    averageTicket: 146.57,
  },
  "30d": {
    revenue: 12850.75,
    profit: 3420.5,
    sales: 87,
    averageTicket: 147.71,
  },
  "90d": {
    revenue: 34210.9,
    profit: 9240.3,
    sales: 231,
    averageTicket: 148.09,
  },
};

const dashboardTopProducts = [
  { id: "1", name: "Cadeira Gamer GX", revenue: "R$ 3.599,60" },
  { id: "2", name: "Teclado Mecanico K500", revenue: "R$ 2.099,30" },
  { id: "3", name: "Fone Bluetooth X200", revenue: "R$ 1.709,10" },
];

const dashboardRecentOrders = [
  {
    id: "1",
    product: "Fone Bluetooth X200",
    marketplace: "Mercado Livre",
    value: "R$ 189,90",
  },
  {
    id: "2",
    product: "Mouse Gamer RGB",
    marketplace: "Shopee",
    value: "R$ 129,90",
  },
  {
    id: "3",
    product: "Teclado Mecanico K500",
    marketplace: "Mercado Livre",
    value: "R$ 299,90",
  },
];

const profitTableByPeriod = {
  "7d": [
    createProfitRow({
      id: "pt-101",
      photo: createProductPhoto("PF", "#1d4ed8", "#60a5fa"),
      title: "Purificador de Agua Smart Filter",
      account: "Loja Principal ML",
      sku: "PF-1376",
      date: "13/03 09:03",
      quantity: 1,
      value: 1199.0,
      fee: 197.84,
      sellerShipping: 49.35,
      productCost: 0,
      taxPercent: 0,
    }),
    createProfitRow({
      id: "pt-102",
      photo: createProductPhoto("SM", "#0f172a", "#334155"),
      title: "Suporte Modular para Monitor Articulado",
      account: "Loja Secundaria ML",
      sku: "SM-3346",
      date: "13/03 08:20",
      quantity: 1,
      value: 77.99,
      fee: 10.14,
      sellerShipping: 8.95,
      productCost: 44.28,
      taxPercent: 0,
    }),
    createProfitRow({
      id: "pt-103",
      photo: createProductPhoto("AQ", "#f59e0b", "#f97316"),
      title: "Apagador Profissional para Quadro Branco",
      account: "Loja Shopee 1",
      sku: "AQ-2815",
      date: "13/03 08:01",
      quantity: 5,
      value: 95.05,
      fee: 10.95,
      sellerShipping: 32.76,
      productCost: 16,
      taxPercent: 0,
    }),
    createProfitRow({
      id: "pt-104",
      photo: createProductPhoto("CF", "#7c3aed", "#8b5cf6"),
      title: "Cafeteira Portatil Brew Go",
      account: "Loja Principal ML",
      sku: "CF-2401",
      date: "12/03 16:44",
      quantity: 1,
      value: 219.9,
      fee: 28.37,
      sellerShipping: 17.9,
      productCost: 96.5,
      taxPercent: 8.5,
    }),
    createProfitRow({
      id: "pt-105",
      photo: createProductPhoto("LT", "#0891b2", "#22d3ee"),
      title: "Luminaria Touch Flex Desk",
      account: "Loja Shopee 1",
      sku: "LT-9012",
      date: "12/03 14:10",
      quantity: 2,
      value: 158.4,
      fee: 18.51,
      sellerShipping: 14.7,
      productCost: 62.9,
      taxPercent: 6,
    }),
  ],
  "30d": [
    createProfitRow({
      id: "pt-201",
      photo: createProductPhoto("PF", "#1d4ed8", "#60a5fa"),
      title: "Purificador de Agua Smart Filter",
      account: "Loja Principal ML",
      sku: "PF-1376",
      date: "13/03 09:03",
      quantity: 1,
      value: 1199.0,
      fee: 197.84,
      sellerShipping: 49.35,
      productCost: 0,
      taxPercent: 0,
    }),
    createProfitRow({
      id: "pt-202",
      photo: createProductPhoto("SM", "#0f172a", "#334155"),
      title: "Suporte Modular para Monitor Articulado",
      account: "Loja Secundaria ML",
      sku: "SM-3346",
      date: "13/03 08:20",
      quantity: 1,
      value: 77.99,
      fee: 10.14,
      sellerShipping: 8.95,
      productCost: 44.28,
      taxPercent: 0,
    }),
    createProfitRow({
      id: "pt-203",
      photo: createProductPhoto("AQ", "#f59e0b", "#f97316"),
      title: "Apagador Profissional para Quadro Branco",
      account: "Loja Shopee 1",
      sku: "AQ-2815",
      date: "13/03 08:01",
      quantity: 5,
      value: 95.05,
      fee: 10.95,
      sellerShipping: 32.76,
      productCost: 16,
      taxPercent: 0,
    }),
    createProfitRow({
      id: "pt-204",
      photo: createProductPhoto("CF", "#7c3aed", "#8b5cf6"),
      title: "Cafeteira Portatil Brew Go",
      account: "Loja Principal ML",
      sku: "CF-2401",
      date: "12/03 16:44",
      quantity: 1,
      value: 219.9,
      fee: 28.37,
      sellerShipping: 17.9,
      productCost: 96.5,
      taxPercent: 8.5,
    }),
    createProfitRow({
      id: "pt-205",
      photo: createProductPhoto("LT", "#0891b2", "#22d3ee"),
      title: "Luminaria Touch Flex Desk",
      account: "Loja Shopee 1",
      sku: "LT-9012",
      date: "12/03 14:10",
      quantity: 2,
      value: 158.4,
      fee: 18.51,
      sellerShipping: 14.7,
      productCost: 62.9,
      taxPercent: 6,
    }),
    createProfitRow({
      id: "pt-206",
      photo: createProductPhoto("KB", "#16a34a", "#4ade80"),
      title: "Kit Blender Portatil Fresh Mix",
      account: "Loja Principal ML",
      sku: "KB-5540",
      date: "11/03 20:18",
      quantity: 1,
      value: 139.9,
      fee: 18.8,
      sellerShipping: 12.7,
      productCost: 51.3,
      taxPercent: 7,
    }),
  ],
  "90d": [
    createProfitRow({
      id: "pt-301",
      photo: createProductPhoto("PF", "#1d4ed8", "#60a5fa"),
      title: "Purificador de Agua Smart Filter",
      account: "Loja Principal ML",
      sku: "PF-1376",
      date: "13/03 09:03",
      quantity: 1,
      value: 1199.0,
      fee: 197.84,
      sellerShipping: 49.35,
      productCost: 0,
      taxPercent: 0,
    }),
    createProfitRow({
      id: "pt-302",
      photo: createProductPhoto("SM", "#0f172a", "#334155"),
      title: "Suporte Modular para Monitor Articulado",
      account: "Loja Secundaria ML",
      sku: "SM-3346",
      date: "13/03 08:20",
      quantity: 1,
      value: 77.99,
      fee: 10.14,
      sellerShipping: 8.95,
      productCost: 44.28,
      taxPercent: 0,
    }),
    createProfitRow({
      id: "pt-303",
      photo: createProductPhoto("AQ", "#f59e0b", "#f97316"),
      title: "Apagador Profissional para Quadro Branco",
      account: "Loja Shopee 1",
      sku: "AQ-2815",
      date: "13/03 08:01",
      quantity: 5,
      value: 95.05,
      fee: 10.95,
      sellerShipping: 32.76,
      productCost: 16,
      taxPercent: 0,
    }),
    createProfitRow({
      id: "pt-304",
      photo: createProductPhoto("CF", "#7c3aed", "#8b5cf6"),
      title: "Cafeteira Portatil Brew Go",
      account: "Loja Principal ML",
      sku: "CF-2401",
      date: "12/03 16:44",
      quantity: 1,
      value: 219.9,
      fee: 28.37,
      sellerShipping: 17.9,
      productCost: 96.5,
      taxPercent: 8.5,
    }),
    createProfitRow({
      id: "pt-305",
      photo: createProductPhoto("LT", "#0891b2", "#22d3ee"),
      title: "Luminaria Touch Flex Desk",
      account: "Loja Shopee 1",
      sku: "LT-9012",
      date: "12/03 14:10",
      quantity: 2,
      value: 158.4,
      fee: 18.51,
      sellerShipping: 14.7,
      productCost: 62.9,
      taxPercent: 6,
    }),
    createProfitRow({
      id: "pt-306",
      photo: createProductPhoto("KB", "#16a34a", "#4ade80"),
      title: "Kit Blender Portatil Fresh Mix",
      account: "Loja Principal ML",
      sku: "KB-5540",
      date: "11/03 20:18",
      quantity: 1,
      value: 139.9,
      fee: 18.8,
      sellerShipping: 12.7,
      productCost: 51.3,
      taxPercent: 7,
    }),
    createProfitRow({
      id: "pt-307",
      photo: createProductPhoto("RS", "#dc2626", "#fb7185"),
      title: "Roteador Smart Mesh Dual Band",
      account: "Loja Secundaria ML",
      sku: "RS-7788",
      date: "11/03 10:06",
      quantity: 1,
      value: 329.9,
      fee: 42.88,
      sellerShipping: 21.9,
      productCost: 149.5,
      taxPercent: 9.5,
    }),
  ],
};

const profitReportByPeriod = {
  "7d": [
    createProfitReportRow({
      id: "pr-101",
      date: "13/03/2026",
      marketplace: "Mercado Livre",
      product: "Purificador de Agua Smart Filter",
      supplier: "AquaPure Distribuidora",
      quantity: 1,
      salePrice: 1199.0,
      productCost: 620.0,
      marketplaceFee: 197.84,
      shippingPaid: 49.35,
    }),
    createProfitReportRow({
      id: "pr-102",
      date: "13/03/2026",
      marketplace: "Shopee",
      product: "Suporte Modular para Monitor Articulado",
      supplier: "MetalPrime Imports",
      quantity: 2,
      salePrice: 77.99,
      productCost: 68.0,
      marketplaceFee: 20.28,
      shippingPaid: 13.4,
    }),
    createProfitReportRow({
      id: "pr-103",
      date: "12/03/2026",
      marketplace: "Mercado Livre",
      product: "Teclado Mecanico K500",
      supplier: "KeyLab Eletronicos",
      quantity: 1,
      salePrice: 299.9,
      productCost: 170.0,
      marketplaceFee: 44.98,
      shippingPaid: 18.9,
    }),
  ],
  "30d": [
    createProfitReportRow({
      id: "pr-201",
      date: "13/03/2026",
      marketplace: "Mercado Livre",
      product: "Purificador de Agua Smart Filter",
      supplier: "AquaPure Distribuidora",
      quantity: 1,
      salePrice: 1199.0,
      productCost: 620.0,
      marketplaceFee: 197.84,
      shippingPaid: 49.35,
    }),
    createProfitReportRow({
      id: "pr-202",
      date: "13/03/2026",
      marketplace: "Shopee",
      product: "Suporte Modular para Monitor Articulado",
      supplier: "MetalPrime Imports",
      quantity: 2,
      salePrice: 77.99,
      productCost: 68.0,
      marketplaceFee: 20.28,
      shippingPaid: 13.4,
    }),
    createProfitReportRow({
      id: "pr-203",
      date: "12/03/2026",
      marketplace: "Mercado Livre",
      product: "Teclado Mecanico K500",
      supplier: "KeyLab Eletronicos",
      quantity: 1,
      salePrice: 299.9,
      productCost: 170.0,
      marketplaceFee: 44.98,
      shippingPaid: 18.9,
    }),
    createProfitReportRow({
      id: "pr-204",
      date: "11/03/2026",
      marketplace: "Shopee",
      product: "Mouse Gamer RGB",
      supplier: "Pixel Gear Supply",
      quantity: 3,
      salePrice: 129.9,
      productCost: 186.0,
      marketplaceFee: 46.76,
      shippingPaid: 25.8,
    }),
    createProfitReportRow({
      id: "pr-205",
      date: "10/03/2026",
      marketplace: "Mercado Livre",
      product: "Fone Bluetooth X200",
      supplier: "AudioMax Trading",
      quantity: 4,
      salePrice: 189.9,
      productCost: 380.0,
      marketplaceFee: 113.94,
      shippingPaid: 36.5,
    }),
    createProfitReportRow({
      id: "pr-206",
      date: "09/03/2026",
      marketplace: "Shopee",
      product: "Cadeira Gamer GX",
      supplier: "Comfort House Brasil",
      quantity: 1,
      salePrice: 899.9,
      productCost: 540.0,
      marketplaceFee: 117.0,
      shippingPaid: 64.9,
    }),
  ],
  "90d": [
    createProfitReportRow({
      id: "pr-301",
      date: "13/03/2026",
      marketplace: "Mercado Livre",
      product: "Purificador de Agua Smart Filter",
      supplier: "AquaPure Distribuidora",
      quantity: 1,
      salePrice: 1199.0,
      productCost: 620.0,
      marketplaceFee: 197.84,
      shippingPaid: 49.35,
    }),
    createProfitReportRow({
      id: "pr-302",
      date: "24/02/2026",
      marketplace: "Shopee",
      product: "Suporte Modular para Monitor Articulado",
      supplier: "MetalPrime Imports",
      quantity: 2,
      salePrice: 77.99,
      productCost: 68.0,
      marketplaceFee: 20.28,
      shippingPaid: 13.4,
    }),
    createProfitReportRow({
      id: "pr-303",
      date: "18/02/2026",
      marketplace: "Mercado Livre",
      product: "Teclado Mecanico K500",
      supplier: "KeyLab Eletronicos",
      quantity: 1,
      salePrice: 299.9,
      productCost: 170.0,
      marketplaceFee: 44.98,
      shippingPaid: 18.9,
    }),
    createProfitReportRow({
      id: "pr-304",
      date: "06/03/2026",
      marketplace: "Shopee",
      product: "Mouse Gamer RGB",
      supplier: "Pixel Gear Supply",
      quantity: 3,
      salePrice: 129.9,
      productCost: 186.0,
      marketplaceFee: 46.76,
      shippingPaid: 25.8,
    }),
    createProfitReportRow({
      id: "pr-305",
      date: "27/01/2026",
      marketplace: "Mercado Livre",
      product: "Fone Bluetooth X200",
      supplier: "AudioMax Trading",
      quantity: 4,
      salePrice: 189.9,
      productCost: 380.0,
      marketplaceFee: 113.94,
      shippingPaid: 36.5,
    }),
    createProfitReportRow({
      id: "pr-306",
      date: "15/01/2026",
      marketplace: "Shopee",
      product: "Cadeira Gamer GX",
      supplier: "Comfort House Brasil",
      quantity: 1,
      salePrice: 899.9,
      productCost: 540.0,
      marketplaceFee: 117.0,
      shippingPaid: 64.9,
    }),
    createProfitReportRow({
      id: "pr-307",
      date: "02/03/2026",
      marketplace: "Mercado Livre",
      product: "Webcam Pro Stream 2K",
      supplier: "Vision Importadora",
      quantity: 2,
      salePrice: 249.9,
      productCost: 276.0,
      marketplaceFee: 74.97,
      shippingPaid: 22.4,
    }),
  ],
};

const orders = [
  {
    id: "1",
    product: "Fone Bluetooth X200",
    marketplace: "Mercado Livre",
    value: "R$ 189,90",
    status: "Enviado",
  },
  {
    id: "2",
    product: "Mouse Gamer RGB",
    marketplace: "Shopee",
    value: "R$ 129,90",
    status: "Pendente",
  },
  {
    id: "3",
    product: "Teclado Mecanico K500",
    marketplace: "Mercado Livre",
    value: "R$ 299,90",
    status: "Entregue",
  },
  {
    id: "4",
    product: "Cadeira Gamer GX",
    marketplace: "Shopee",
    value: "R$ 899,90",
    status: "Enviado",
  },
];

const products = [
  {
    id: "1",
    name: "Cadeira Gamer GX",
    sku: "CADEIRA-GX",
    price: "R$ 899,90",
    cost: "R$ 540,00",
    margin: "20,5%",
    status: "Ativo",
  },
  {
    id: "2",
    name: "Teclado Mecanico K500",
    sku: "TEC-K500",
    price: "R$ 299,90",
    cost: "R$ 170,00",
    margin: "22,6%",
    status: "Ativo",
  },
  {
    id: "3",
    name: "Fone Bluetooth X200",
    sku: "FONE-X200",
    price: "R$ 189,90",
    cost: "R$ 95,00",
    margin: "28,6%",
    status: "Ativo",
  },
  {
    id: "4",
    name: "Mouse Gamer RGB",
    sku: "MOUSE-RGB-01",
    price: "R$ 129,90",
    cost: "R$ 62,00",
    margin: "29,9%",
    status: "Pausado",
  },
];

const accounts = [
  {
    id: "1",
    name: "Loja Principal ML",
    marketplace: "Mercado Livre",
    status: "Conectada",
    lastSync: "Hoje, 14:32",
    orders: 248,
  },
  {
    id: "2",
    name: "Loja Shopee 1",
    marketplace: "Shopee",
    status: "Conectada",
    lastSync: "Hoje, 13:48",
    orders: 117,
  },
  {
    id: "3",
    name: "Loja Secundaria ML",
    marketplace: "Mercado Livre",
    status: "Pendente",
    lastSync: "Ontem, 19:10",
    orders: 52,
  },
];

const reports = {
  summary: {
    totalRevenue: "R$ 34.210,90",
    totalProfit: "R$ 9.240,30",
    totalOrders: 231,
    averageMargin: "27,0%",
  },
  channels: [
    {
      id: "1",
      name: "Mercado Livre",
      revenue: "R$ 21.540,40",
      profit: "R$ 5.920,10",
    },
    {
      id: "2",
      name: "Shopee",
      revenue: "R$ 12.670,50",
      profit: "R$ 3.320,20",
    },
  ],
  topProfitableProducts: [
    { id: "1", name: "Cadeira Gamer GX", profit: "R$ 2.410,00" },
    { id: "2", name: "Teclado Mecanico K500", profit: "R$ 1.380,00" },
    { id: "3", name: "Fone Bluetooth X200", profit: "R$ 980,00" },
  ],
  rows: [
    { id: "1", period: "Janeiro", revenue: "R$ 9.200,00", profit: "R$ 2.450,00", orders: 61 },
    { id: "2", period: "Fevereiro", revenue: "R$ 11.100,00", profit: "R$ 3.010,00", orders: 73 },
    { id: "3", period: "Marco", revenue: "R$ 13.910,90", profit: "R$ 3.780,30", orders: 97 },
  ],
};

const settings = {
  profile: {
    name: "Luiz Henrique",
    email: "luiz@email.com",
    company: "ViiSync Seller",
  },
  preferences: {
    theme: "Claro",
    periodDefault: "30 dias",
    notifications: "Ativadas",
  },
  security: {
    lastPasswordChange: "10/03/2026",
    twoFactor: "Desativado",
  },
};

const chartDataByPeriod = {
  "7d": [
    { label: "Seg", revenue: 420 },
    { label: "Ter", revenue: 610 },
    { label: "Qua", revenue: 530 },
    { label: "Qui", revenue: 780 },
    { label: "Sex", revenue: 690 },
    { label: "Sab", revenue: 920 },
    { label: "Dom", revenue: 840 },
  ],
  "30d": [
    { label: "01/03", revenue: 420 },
    { label: "05/03", revenue: 610 },
    { label: "10/03", revenue: 530 },
    { label: "15/03", revenue: 780 },
    { label: "20/03", revenue: 690 },
    { label: "25/03", revenue: 920 },
    { label: "30/03", revenue: 840 },
  ],
  "90d": [
    { label: "Jan", revenue: 9200 },
    { label: "Fev", revenue: 11100 },
    { label: "Mar", revenue: 13910 },
  ],
};

module.exports = {
  accounts,
  chartDataByPeriod,
  dashboardRecentOrders,
  dashboardSummaries,
  dashboardTopProducts,
  orders,
  products,
  profitReportByPeriod,
  profitTableByPeriod,
  reports,
  settings,
};
