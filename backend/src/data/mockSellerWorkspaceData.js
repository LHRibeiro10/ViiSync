const productDetails = [
  {
    id: "1",
    name: "Cadeira Gamer GX",
    sku: "CADEIRA-GX",
    status: "Ativo",
    category: "Ergonomia",
    supplier: "Comfort House Brasil",
    healthLabel: "Produto lider em lucro",
    summaryByPeriod: {
      "7d": { revenue: 1799.8, profit: 478.2, marginPercent: 26.6, feeAmount: 234.1, sales: 2, orders: 2, averageTicket: 899.9 },
      "30d": { revenue: 3599.6, profit: 968.4, marginPercent: 26.9, feeAmount: 471.8, sales: 4, orders: 4, averageTicket: 899.9 },
      "90d": { revenue: 9898.9, profit: 2410.0, marginPercent: 24.3, feeAmount: 1290.4, sales: 11, orders: 11, averageTicket: 899.9 },
    },
    evolutionByPeriod: {
      "7d": [
        { label: "Seg", revenue: 0, profit: 0, orders: 0 },
        { label: "Ter", revenue: 899.9, profit: 239.1, orders: 1 },
        { label: "Sex", revenue: 899.9, profit: 239.1, orders: 1 },
      ],
      "30d": [
        { label: "Sem 1", revenue: 899.9, profit: 239.1, orders: 1 },
        { label: "Sem 2", revenue: 0, profit: 0, orders: 0 },
        { label: "Sem 3", revenue: 899.9, profit: 245.0, orders: 1 },
        { label: "Sem 4", revenue: 1799.8, profit: 484.3, orders: 2 },
      ],
      "90d": [
        { label: "Jan", revenue: 2699.7, profit: 656.0, orders: 3 },
        { label: "Fev", revenue: 3599.6, profit: 892.0, orders: 4 },
        { label: "Mar", revenue: 3599.6, profit: 862.0, orders: 4 },
      ],
    },
    channelMix: [
      { id: "chair-ml", marketplace: "Mercado Livre", revenue: 5399.4, profit: 1315.1, marginPercent: 24.4, feePercent: 12.8 },
      { id: "chair-shopee", marketplace: "Shopee", revenue: 4499.5, profit: 1094.9, marginPercent: 24.3, feePercent: 13.1 },
    ],
    feeBreakdown: [
      { id: "chair-fee-1", label: "Taxa do marketplace", amount: 1290.4 },
      { id: "chair-fee-2", label: "Frete subsidiado", amount: 714.2 },
      { id: "chair-fee-3", label: "Impostos", amount: 533.7 },
    ],
    recentSales: [
      { id: "chair-sale-1", orderId: "PED-9322", marketplace: "Shopee", soldAt: "2026-03-18T14:24:00.000Z", revenue: 899.9, profit: 244.2 },
      { id: "chair-sale-2", orderId: "PED-9281", marketplace: "Mercado Livre", soldAt: "2026-03-12T10:16:00.000Z", revenue: 899.9, profit: 245.0 },
    ],
    recommendations: [
      "Segure campanhas agressivas so quando o frete nao estourar a margem alvo.",
      "Bundle com apoio lombar ou deskmat premium pode elevar ticket com boa aderencia.",
      "Shopee ainda pede ajuste de copy para converter melhor com menor custo de aquisicao.",
    ],
  },
  {
    id: "2",
    name: "Teclado Mecanico K500",
    sku: "TEC-K500",
    status: "Ativo",
    category: "Perifericos",
    supplier: "KeyLab Eletronicos",
    healthLabel: "Margem sob controle",
    summaryByPeriod: {
      "7d": { revenue: 599.8, profit: 158.7, marginPercent: 26.5, feeAmount: 89.1, sales: 2, orders: 2, averageTicket: 299.9 },
      "30d": { revenue: 1499.5, profit: 412.6, marginPercent: 27.5, feeAmount: 223.2, sales: 5, orders: 5, averageTicket: 299.9 },
      "90d": { revenue: 5098.3, profit: 1380.0, marginPercent: 27.1, feeAmount: 749.4, sales: 17, orders: 17, averageTicket: 299.9 },
    },
    evolutionByPeriod: {
      "7d": [
        { label: "Seg", revenue: 299.9, profit: 79.3, orders: 1 },
        { label: "Qui", revenue: 299.9, profit: 79.4, orders: 1 },
      ],
      "30d": [
        { label: "Sem 1", revenue: 299.9, profit: 84.1, orders: 1 },
        { label: "Sem 2", revenue: 299.9, profit: 82.2, orders: 1 },
        { label: "Sem 3", revenue: 299.9, profit: 83.3, orders: 1 },
        { label: "Sem 4", revenue: 599.8, profit: 163.0, orders: 2 },
      ],
      "90d": [
        { label: "Jan", revenue: 1499.5, profit: 405.0, orders: 5 },
        { label: "Fev", revenue: 1799.4, profit: 482.4, orders: 6 },
        { label: "Mar", revenue: 1799.4, profit: 492.6, orders: 6 },
      ],
    },
    channelMix: [
      { id: "keyboard-ml", marketplace: "Mercado Livre", revenue: 3598.8, profit: 972.2, marginPercent: 27.0, feePercent: 12.4 },
      { id: "keyboard-shopee", marketplace: "Shopee", revenue: 1499.5, profit: 407.8, marginPercent: 27.2, feePercent: 12.9 },
    ],
    feeBreakdown: [
      { id: "keyboard-fee-1", label: "Taxa do marketplace", amount: 749.4 },
      { id: "keyboard-fee-2", label: "Frete subsidiado", amount: 282.6 },
      { id: "keyboard-fee-3", label: "Impostos", amount: 391.8 },
    ],
    recentSales: [
      { id: "keyboard-sale-1", orderId: "PED-9318", marketplace: "Mercado Livre", soldAt: "2026-03-17T18:11:00.000Z", revenue: 299.9, profit: 81.9 },
      { id: "keyboard-sale-2", orderId: "PED-9275", marketplace: "Shopee", soldAt: "2026-03-11T13:42:00.000Z", revenue: 299.9, profit: 82.2 },
    ],
    recommendations: [
      "O produto tem margem saudavel para campanhas controladas em datas promocionais.",
      "Teste combos com apoio ergonomico ou mousepad XL para ganhar ticket medio.",
      "A copy do anuncio pode explorar home office alem do publico gamer.",
    ],
  },
  {
    id: "3",
    name: "Fone Bluetooth X200",
    sku: "FONE-X200",
    status: "Ativo",
    category: "Audio",
    supplier: "AudioMax Trading",
    healthLabel: "Boa conversao, ticket mais baixo",
    summaryByPeriod: {
      "7d": { revenue: 569.7, profit: 158.8, marginPercent: 27.9, feeAmount: 84.9, sales: 3, orders: 3, averageTicket: 189.9 },
      "30d": { revenue: 1329.3, profit: 364.4, marginPercent: 27.4, feeAmount: 197.5, sales: 7, orders: 7, averageTicket: 189.9 },
      "90d": { revenue: 3798.0, profit: 980.0, marginPercent: 25.8, feeAmount: 568.4, sales: 20, orders: 20, averageTicket: 189.9 },
    },
    evolutionByPeriod: {
      "7d": [
        { label: "Seg", revenue: 189.9, profit: 51.1, orders: 1 },
        { label: "Ter", revenue: 189.9, profit: 53.2, orders: 1 },
        { label: "Qui", revenue: 189.9, profit: 54.5, orders: 1 },
      ],
      "30d": [
        { label: "Sem 1", revenue: 379.8, profit: 103.4, orders: 2 },
        { label: "Sem 2", revenue: 189.9, profit: 52.1, orders: 1 },
        { label: "Sem 3", revenue: 379.8, profit: 104.5, orders: 2 },
        { label: "Sem 4", revenue: 379.8, profit: 104.4, orders: 2 },
      ],
      "90d": [
        { label: "Jan", revenue: 1139.4, profit: 297.0, orders: 6 },
        { label: "Fev", revenue: 1329.3, profit: 340.0, orders: 7 },
        { label: "Mar", revenue: 1329.3, profit: 343.0, orders: 7 },
      ],
    },
    channelMix: [
      { id: "headphone-ml", marketplace: "Mercado Livre", revenue: 2658.6, profit: 683.2, marginPercent: 25.7, feePercent: 12.9 },
      { id: "headphone-shopee", marketplace: "Shopee", revenue: 1139.4, profit: 296.8, marginPercent: 26.0, feePercent: 13.2 },
    ],
    feeBreakdown: [
      { id: "headphone-fee-1", label: "Taxa do marketplace", amount: 568.4 },
      { id: "headphone-fee-2", label: "Frete subsidiado", amount: 182.1 },
      { id: "headphone-fee-3", label: "Impostos", amount: 221.5 },
    ],
    recentSales: [
      { id: "headphone-sale-1", orderId: "PED-9331", marketplace: "Mercado Livre", soldAt: "2026-03-18T17:26:00.000Z", revenue: 189.9, profit: 54.5 },
      { id: "headphone-sale-2", orderId: "PED-9301", marketplace: "Mercado Livre", soldAt: "2026-03-15T09:08:00.000Z", revenue: 189.9, profit: 52.2 },
    ],
    recommendations: [
      "Use o item como porta de entrada para bundles de setup.",
      "Vale testar versoes com acessorios extras para levantar ticket.",
      "Monitore taxa por canal porque a margem cai rapido em oferta agressiva.",
    ],
  },
  {
    id: "4",
    name: "Mouse Gamer RGB",
    sku: "MOUSE-RGB-01",
    status: "Pausado",
    category: "Perifericos",
    supplier: "Pixel Gear Supply",
    healthLabel: "Produto pausado e margem sensivel",
    summaryByPeriod: {
      "7d": { revenue: 0, profit: 0, marginPercent: 0, feeAmount: 0, sales: 0, orders: 0, averageTicket: 129.9 },
      "30d": { revenue: 389.7, profit: 79.0, marginPercent: 20.3, feeAmount: 46.7, sales: 3, orders: 3, averageTicket: 129.9 },
      "90d": { revenue: 1299.0, profit: 260.0, marginPercent: 20.0, feeAmount: 154.4, sales: 10, orders: 10, averageTicket: 129.9 },
    },
    evolutionByPeriod: {
      "7d": [{ label: "Sem giro", revenue: 0, profit: 0, orders: 0 }],
      "30d": [
        { label: "Sem 1", revenue: 129.9, profit: 25.5, orders: 1 },
        { label: "Sem 2", revenue: 129.9, profit: 26.8, orders: 1 },
        { label: "Sem 4", revenue: 129.9, profit: 26.7, orders: 1 },
      ],
      "90d": [
        { label: "Jan", revenue: 389.7, profit: 81.1, orders: 3 },
        { label: "Fev", revenue: 519.6, profit: 103.8, orders: 4 },
        { label: "Mar", revenue: 389.7, profit: 75.1, orders: 3 },
      ],
    },
    channelMix: [
      { id: "mouse-ml", marketplace: "Mercado Livre", revenue: 779.4, profit: 156.2, marginPercent: 20.0, feePercent: 12.8 },
      { id: "mouse-shopee", marketplace: "Shopee", revenue: 519.6, profit: 103.8, marginPercent: 20.0, feePercent: 13.0 },
    ],
    feeBreakdown: [
      { id: "mouse-fee-1", label: "Taxa do marketplace", amount: 154.4 },
      { id: "mouse-fee-2", label: "Frete subsidiado", amount: 88.1 },
      { id: "mouse-fee-3", label: "Impostos", amount: 64.0 },
    ],
    recentSales: [
      { id: "mouse-sale-1", orderId: "PED-9208", marketplace: "Shopee", soldAt: "2026-03-07T16:40:00.000Z", revenue: 129.9, profit: 26.7 },
    ],
    recommendations: [
      "So reative se houver ganho de preco ou reducao de custo.",
      "Avalie substituir por um SKU adjacente com melhor cross-sell.",
      "Se mantiver no mix, trate o item como porta de entrada e nao motor de lucro.",
    ],
  },
];

const financeCenterByPeriod = {
  "7d": {
    summary: { inflow: 4250.5, outflow: 2860.2, netProfit: 1160.2, receivables: 1320.4, recurringExpenses: 1189.0 },
    cashFlow: [
      { id: "cash-7-1", label: "Seg", inflow: 420, outflow: 256, net: 164 },
      { id: "cash-7-2", label: "Ter", inflow: 610, outflow: 358, net: 252 },
      { id: "cash-7-3", label: "Qua", inflow: 530, outflow: 402, net: 128 },
      { id: "cash-7-4", label: "Qui", inflow: 780, outflow: 498, net: 282 },
      { id: "cash-7-5", label: "Sex", inflow: 690, outflow: 472, net: 218 },
      { id: "cash-7-6", label: "Sab", inflow: 920, outflow: 478, net: 442 },
      { id: "cash-7-7", label: "Dom", inflow: 300.5, outflow: 396.2, net: -95.7 },
    ],
    recurringExpenses: [
      { id: "rec-1", description: "ERP fiscal", amount: 249.0, category: "Software", nextCharge: "2026-03-25", status: "Programado" },
      { id: "rec-2", description: "Time de atendimento", amount: 590.0, category: "Operacao", nextCharge: "2026-03-28", status: "Programado" },
      { id: "rec-3", description: "Ads always-on", amount: 350.0, category: "Marketing", nextCharge: "2026-03-29", status: "Em uso" },
    ],
    receivables: [
      { id: "recv-1", marketplace: "Mercado Livre", amount: 820.4, expectedAt: "2026-03-21", status: "Previsto" },
      { id: "recv-2", marketplace: "Shopee", amount: 500.0, expectedAt: "2026-03-22", status: "Previsto" },
    ],
    feesByChannel: [
      { id: "fee-7-ml", channel: "Mercado Livre", feeAmount: 430.2, feePercent: 12.9, netMarginPercent: 27.1 },
      { id: "fee-7-shp", channel: "Shopee", feeAmount: 214.7, feePercent: 13.4, netMarginPercent: 26.2 },
    ],
    netProfitBridge: [
      { id: "bridge-7-1", label: "Receita bruta", amount: 4250.5, tone: "positive" },
      { id: "bridge-7-2", label: "Custos de produto", amount: -1710.9, tone: "negative" },
      { id: "bridge-7-3", label: "Taxas + frete", amount: -859.4, tone: "negative" },
      { id: "bridge-7-4", label: "Despesas recorrentes", amount: -520.0, tone: "negative" },
      { id: "bridge-7-5", label: "Lucro liquido", amount: 1160.2, tone: "positive" },
    ],
    insights: [
      "Mercado Livre concentra o maior volume de repasse previsto nos proximos dias.",
      "As despesas recorrentes ja consomem mais de um quarto do lucro semanal projetado.",
      "O frete segue como principal pressao variavel sobre o caixa da semana.",
    ],
  },
  "30d": {
    summary: { inflow: 12850.75, outflow: 9230.25, netProfit: 3420.5, receivables: 4520.2, recurringExpenses: 2980.0 },
    cashFlow: [
      { id: "cash-30-1", label: "Sem 1", inflow: 2860.0, outflow: 2110.4, net: 749.6 },
      { id: "cash-30-2", label: "Sem 2", inflow: 3310.2, outflow: 2360.1, net: 950.1 },
      { id: "cash-30-3", label: "Sem 3", inflow: 2980.5, outflow: 2215.2, net: 765.3 },
      { id: "cash-30-4", label: "Sem 4", inflow: 3700.05, outflow: 2544.55, net: 1155.5 },
    ],
    recurringExpenses: [
      { id: "rec-4", description: "ERP fiscal", amount: 249.0, category: "Software", nextCharge: "2026-03-25", status: "Programado" },
      { id: "rec-5", description: "Atendimento compartilhado", amount: 1180.0, category: "Operacao", nextCharge: "2026-03-28", status: "Programado" },
      { id: "rec-6", description: "Performance media", amount: 780.0, category: "Marketing", nextCharge: "2026-03-26", status: "Em uso" },
      { id: "rec-7", description: "Ferramentas de BI", amount: 771.0, category: "Software", nextCharge: "2026-03-30", status: "Em uso" },
    ],
    receivables: [
      { id: "recv-3", marketplace: "Mercado Livre", amount: 2620.2, expectedAt: "2026-03-21", status: "Previsto" },
      { id: "recv-4", marketplace: "Shopee", amount: 1320.0, expectedAt: "2026-03-22", status: "Previsto" },
      { id: "recv-5", marketplace: "Cartao corporativo", amount: 580.0, expectedAt: "2026-03-24", status: "Conciliação" },
    ],
    feesByChannel: [
      { id: "fee-30-ml", channel: "Mercado Livre", feeAmount: 1430.8, feePercent: 12.8, netMarginPercent: 27.5 },
      { id: "fee-30-shp", channel: "Shopee", feeAmount: 710.4, feePercent: 13.6, netMarginPercent: 26.1 },
    ],
    netProfitBridge: [
      { id: "bridge-30-1", label: "Receita bruta", amount: 12850.75, tone: "positive" },
      { id: "bridge-30-2", label: "Custos de produto", amount: -5290.1, tone: "negative" },
      { id: "bridge-30-3", label: "Taxas + frete", amount: -2141.2, tone: "negative" },
      { id: "bridge-30-4", label: "Despesas recorrentes", amount: -1999.0, tone: "negative" },
      { id: "bridge-30-5", label: "Lucro liquido", amount: 3420.5, tone: "positive" },
    ],
    insights: [
      "O lucro liquido fecha positivo, mas o custo fixo recorrente merece acompanhar escala de faturamento.",
      "Mercado Livre continua entregando melhor margem liquida entre os canais ativos.",
      "Ha repasses relevantes a receber, o que ajuda a sustentar o caixa curto.",
    ],
  },
  "90d": {
    summary: { inflow: 34210.9, outflow: 24970.6, netProfit: 9240.3, receivables: 6810.7, recurringExpenses: 8640.0 },
    cashFlow: [
      { id: "cash-90-1", label: "Jan", inflow: 9200.0, outflow: 6750.0, net: 2450.0 },
      { id: "cash-90-2", label: "Fev", inflow: 11100.0, outflow: 8090.0, net: 3010.0 },
      { id: "cash-90-3", label: "Mar", inflow: 13910.9, outflow: 10130.6, net: 3780.3 },
    ],
    recurringExpenses: [
      { id: "rec-8", description: "ERP fiscal", amount: 747.0, category: "Software", nextCharge: "2026-03-25", status: "Programado" },
      { id: "rec-9", description: "Time de operacao", amount: 3540.0, category: "Operacao", nextCharge: "2026-03-28", status: "Em uso" },
      { id: "rec-10", description: "Midia de performance", amount: 2340.0, category: "Marketing", nextCharge: "2026-03-26", status: "Em uso" },
      { id: "rec-11", description: "Ferramentas", amount: 2013.0, category: "Software", nextCharge: "2026-03-30", status: "Em uso" },
    ],
    receivables: [
      { id: "recv-6", marketplace: "Mercado Livre", amount: 4280.4, expectedAt: "2026-03-21", status: "Previsto" },
      { id: "recv-7", marketplace: "Shopee", amount: 1980.3, expectedAt: "2026-03-22", status: "Previsto" },
      { id: "recv-8", marketplace: "Gateway bancario", amount: 550.0, expectedAt: "2026-03-24", status: "Conciliação" },
    ],
    feesByChannel: [
      { id: "fee-90-ml", channel: "Mercado Livre", feeAmount: 3880.4, feePercent: 12.7, netMarginPercent: 27.4 },
      { id: "fee-90-shp", channel: "Shopee", feeAmount: 1710.3, feePercent: 13.5, netMarginPercent: 26.2 },
    ],
    netProfitBridge: [
      { id: "bridge-90-1", label: "Receita bruta", amount: 34210.9, tone: "positive" },
      { id: "bridge-90-2", label: "Custos de produto", amount: -14100.4, tone: "negative" },
      { id: "bridge-90-3", label: "Taxas + frete", amount: -5590.7, tone: "negative" },
      { id: "bridge-90-4", label: "Despesas recorrentes", amount: -5279.5, tone: "negative" },
      { id: "bridge-90-5", label: "Lucro liquido", amount: 9240.3, tone: "positive" },
    ],
    insights: [
      "O negocio roda com margem liquida consistente, mas a dependencia de dois canais segue alta.",
      "Os repasses previstos ajudam a dar folga de caixa para reposicao de estoque e campanhas.",
      "Marketing e operacao respondem pela maior fatia entre as despesas recorrentes do trimestre.",
    ],
  },
};

const calendarEvents = [
  { id: "cal-1", date: "2026-03-20", title: "Repasse Mercado Livre - Loja Principal", description: "Previsao de recebimento principal do ciclo atual.", type: "repasse", status: "upcoming", owner: "Financeiro", marketplace: "Mercado Livre" },
  { id: "cal-2", date: "2026-03-21", title: "Revisar campanha Desk Setup Weekend", description: "Checar ROAS, margem e produtos com maior giro.", type: "campanha", status: "upcoming", owner: "Growth", marketplace: "Todos" },
  { id: "cal-3", date: "2026-03-22", title: "Cobrar onboarding travado da Loja Atlas", description: "Seller ainda nao concluiu conexao principal.", type: "tarefa", status: "attention", owner: "Suporte", marketplace: "Mercado Livre" },
  { id: "cal-4", date: "2026-03-24", title: "Renovacao do ERP fiscal", description: "Vencimento recorrente da ferramenta fiscal.", type: "vencimento", status: "upcoming", owner: "Financeiro", marketplace: "Interno" },
  { id: "cal-5", date: "2026-03-26", title: "Revisar margens dos itens pausados", description: "Avaliar reativacao ou descontinuacao de SKUs com margem pressionada.", type: "lembrete", status: "upcoming", owner: "Catalogo", marketplace: "Todos" },
  { id: "cal-6", date: "2026-03-28", title: "Pagamento time de operacao", description: "Despesa recorrente vinculada ao suporte operacional.", type: "vencimento", status: "scheduled", owner: "Financeiro", marketplace: "Interno" },
];

const automationRulesSeed = [
  { id: "auto-1", name: "Alertar se margem cair abaixo de 22%", description: "Dispara aviso quando um produto relevante passa a operar abaixo da margem alvo.", triggerLabel: "Margem critica", actionLabel: "Criar alerta e destacar produto", scope: "Catalogo", status: "healthy", isEnabled: true, lastRunAt: "2026-03-19T14:26:00.000Z", nextRunAt: "2026-03-19T16:00:00.000Z", successRate: 98, impactNote: "Ja marcou Mouse Gamer RGB como item critico." },
  { id: "auto-2", name: "Avisar pedido atrasado ha mais de 24h", description: "Detecta fila pendente acima do tempo seguro e envia aviso para operacao.", triggerLabel: "Pedido atrasado", actionLabel: "Abrir alerta operacional", scope: "Pedidos", status: "healthy", isEnabled: true, lastRunAt: "2026-03-19T14:08:00.000Z", nextRunAt: "2026-03-19T15:30:00.000Z", successRate: 96, impactNote: "Fila pendente atual continua coberta por essa regra." },
  { id: "auto-3", name: "Marcar produto critico quando lucro desacelerar", description: "Compara tendencia de lucro do item lider para sinalizar perda de rentabilidade.", triggerLabel: "Queda de lucro", actionLabel: "Marcar produto e sugerir revisao", scope: "Produtos", status: "attention", isEnabled: true, lastRunAt: "2026-03-19T13:44:00.000Z", nextRunAt: "2026-03-19T17:00:00.000Z", successRate: 91, impactNote: "Apontou pressao recente em SKUs de menor margem." },
  { id: "auto-4", name: "Sinalizar token prestes a expirar", description: "Acompanha contas conectadas para antecipar risco de quebra na sincronizacao.", triggerLabel: "Token proximo do vencimento", actionLabel: "Criar tarefa de reconexao", scope: "Integracoes", status: "healthy", isEnabled: false, lastRunAt: "2026-03-18T18:00:00.000Z", nextRunAt: "2026-03-19T18:00:00.000Z", successRate: 100, impactNote: "Desligada no momento para revisao do fluxo de notificacao." },
];

const automationExecutions = [
  { id: "run-1", ruleName: "Alertar se margem cair abaixo de 22%", executedAt: "2026-03-19T14:26:00.000Z", result: "success", note: "Produto Mouse Gamer RGB sinalizado para revisao de margem." },
  { id: "run-2", ruleName: "Avisar pedido atrasado ha mais de 24h", executedAt: "2026-03-19T14:08:00.000Z", result: "success", note: "Pedido pendente em Shopee entrou no radar operacional." },
  { id: "run-3", ruleName: "Marcar produto critico quando lucro desacelerar", executedAt: "2026-03-19T13:44:00.000Z", result: "warning", note: "Comparacao parcial: faltam mais vendas para consolidar tendencia." },
];

const sellerIntegrationHub = {
  summary: [
    { id: "hub-sum-1", label: "Contas ativas", value: "3", tone: "success" },
    { id: "hub-sum-2", label: "Com risco de reconexao", value: "1", tone: "warning" },
    { id: "hub-sum-3", label: "Eventos em fila", value: "21", tone: "neutral" },
    { id: "hub-sum-4", label: "Ultima sincronizacao critica", value: "13 min", tone: "warning" },
  ],
  accounts: [
    { id: "hub-acc-1", name: "Loja Principal ML", marketplace: "Mercado Livre", status: "Saudavel", lastSyncAt: "2026-03-19T14:32:00.000Z", latency: "182 ms", queueBacklog: 4, tokenStatus: "Valido", tokenExpiresIn: "12 dias", errorCount: 0, reconnectRecommended: false, note: "Fluxo principal operando dentro do esperado." },
    { id: "hub-acc-2", name: "Loja Shopee 1", marketplace: "Shopee", status: "Monitorando", lastSyncAt: "2026-03-19T13:48:00.000Z", latency: "410 ms", queueBacklog: 9, tokenStatus: "Valido", tokenExpiresIn: "7 dias", errorCount: 2, reconnectRecommended: false, note: "A fila subiu, mas ainda sem impacto funcional critico." },
    { id: "hub-acc-3", name: "Loja Secundaria ML", marketplace: "Mercado Livre", status: "Acao necessaria", lastSyncAt: "2026-03-18T19:10:00.000Z", latency: "1,8 s", queueBacklog: 8, tokenStatus: "Expirando", tokenExpiresIn: "18 h", errorCount: 6, reconnectRecommended: true, note: "Essa conta pode quebrar a visibilidade da operacao se nao for reconectada." },
  ],
  syncEvents: [
    { id: "hub-evt-1", title: "Retentativa de sincronizacao disparada", source: "Loja Secundaria ML", createdAt: "2026-03-19T14:18:00.000Z", severity: "warning" },
    { id: "hub-evt-2", title: "Webhook processado sem atraso", source: "Loja Principal ML", createdAt: "2026-03-19T13:57:00.000Z", severity: "success" },
    { id: "hub-evt-3", title: "Fila de pedidos voltou ao baseline", source: "Shopee", createdAt: "2026-03-19T12:41:00.000Z", severity: "neutral" },
  ],
  actions: [
    { id: "hub-action-1", title: "Reconectar Loja Secundaria ML", description: "Token proximo do vencimento com fila acumulando eventos.", cta: "Abrir reconexao" },
    { id: "hub-action-2", title: "Revisar erros do webhook", description: "Monitorar payloads repetidos para evitar quebra silenciosa.", cta: "Abrir log" },
  ],
};

module.exports = {
  automationExecutions,
  automationRulesSeed,
  calendarEvents,
  financeCenterByPeriod,
  productDetails,
  sellerIntegrationHub,
};
