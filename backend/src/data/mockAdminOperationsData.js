const observabilityData = {
  summary: [
    { id: "obs-1", label: "Uptime 24h", value: "99,62%", tone: "success" },
    { id: "obs-2", label: "Latencia media", value: "286 ms", tone: "neutral" },
    { id: "obs-3", label: "Rotas em erro", value: "3", tone: "warning" },
    { id: "obs-4", label: "Jobs na fila", value: "29", tone: "warning" },
  ],
  services: [
    { id: "svc-1", name: "API Core", status: "healthy", latency: "182 ms", errorRate: "0,18%", note: "Sem degradacao material." },
    { id: "svc-2", name: "Assistente", status: "attention", latency: "740 ms", errorRate: "0,92%", note: "Pico de resposta acima do alvo." },
    { id: "svc-3", name: "Webhooks ML", status: "healthy", latency: "96 ms", errorRate: "0,11%", note: "Processamento dentro do SLA." },
    { id: "svc-4", name: "Sync de pedidos", status: "degraded", latency: "1,8 s", errorRate: "1,46%", note: "Conta secundaria segue concentrando falhas." },
  ],
  routeFailures: [
    { id: "route-1", route: "POST /assistant/conversations/:id/messages", failures: 43, latencyP95: "2,3 s", owner: "Plataforma" },
    { id: "route-2", route: "POST /webhooks/mercadolivre", failures: 18, latencyP95: "812 ms", owner: "Integracoes" },
    { id: "route-3", route: "GET /profit-report", failures: 11, latencyP95: "1,7 s", owner: "Dados" },
  ],
  webhookQueues: [
    { id: "wh-1", name: "Mercado Livre", backlog: 21, retryRate: "3,8%", oldestAge: "7 min" },
    { id: "wh-2", name: "Shopee", backlog: 9, retryRate: "1,2%", oldestAge: "4 min" },
  ],
  jobQueues: [
    { id: "job-1", name: "Sincronizacao de pedidos", pending: 14, workers: 3, status: "Atencao" },
    { id: "job-2", name: "Recalculo de margem", pending: 6, workers: 2, status: "Estavel" },
    { id: "job-3", name: "Exportacao de relatorios", pending: 9, workers: 1, status: "Atencao" },
  ],
  incidents: [
    { id: "obs-inc-1", title: "Conta ML secundaria acumulando retries", severity: "warning", openedAt: "2026-03-19T13:10:00.000Z" },
    { id: "obs-inc-2", title: "Assistente acima da latencia alvo", severity: "warning", openedAt: "2026-03-19T11:25:00.000Z" },
  ],
};

const adminUsersSeed = [
  { id: "usr-1", name: "Luiz Henrique", company: "ViiSync Seller", email: "luiz@email.com", plan: "Plano Fundador", subscriptionStatus: "paid", paidSince: "2026-01-10", onboardingStatus: "done", churnRisk: "low", connectedAccounts: 3, lastActiveAt: "2026-03-19T14:40:00.000Z", mrr: 197.0, isBlocked: false },
  { id: "usr-2", name: "Ana Paula", company: "Loja Atlas", email: "ana@atlas.com", plan: "Growth", subscriptionStatus: "paid", paidSince: "2026-02-01", onboardingStatus: "blocked", churnRisk: "medium", connectedAccounts: 1, lastActiveAt: "2026-03-19T12:02:00.000Z", mrr: 297.0, isBlocked: false },
  { id: "usr-3", name: "Camila Rocha", company: "Casa Prime Seller", email: "camila@casaprime.com", plan: "Growth", subscriptionStatus: "paid", paidSince: "2026-02-15", onboardingStatus: "in_progress", churnRisk: "high", connectedAccounts: 2, lastActiveAt: "2026-03-18T16:11:00.000Z", mrr: 297.0, isBlocked: false },
  { id: "usr-4", name: "Bruno Tavares", company: "Setup Fast", email: "bruno@setupfast.com", plan: "Trial", subscriptionStatus: "trial", paidSince: null, onboardingStatus: "done", churnRisk: "medium", connectedAccounts: 1, lastActiveAt: "2026-03-18T11:42:00.000Z", mrr: 0, isBlocked: false },
  { id: "usr-5", name: "Patricia Lima", company: "Mercado Full BR", email: "patricia@fullbr.com", plan: "Scale", subscriptionStatus: "paid", paidSince: "2025-12-03", onboardingStatus: "done", churnRisk: "low", connectedAccounts: 4, lastActiveAt: "2026-03-19T13:15:00.000Z", mrr: 497.0, isBlocked: true, blockedAt: "2026-03-17T09:20:00.000Z", blockReason: "Bloqueio administrativo temporario por disputa financeira em revisao." },
];

const auditTrail = [
  { id: "audit-1", actor: "Patricia Lima", actorRole: "seller", action: "Tentou reconectar conta Mercado Livre", target: "Loja Full ML", severity: "warning", createdAt: "2026-03-19T14:34:00.000Z" },
  { id: "audit-2", actor: "Equipe Plataforma", actorRole: "admin", action: "Mudou status do ticket FDB-1201 para Em analise", target: "Inbox de feedbacks", severity: "neutral", createdAt: "2026-03-19T13:04:00.000Z" },
  { id: "audit-3", actor: "Automacao", actorRole: "system", action: "Marcou produto com margem critica", target: "Mouse Gamer RGB", severity: "warning", createdAt: "2026-03-19T12:54:00.000Z" },
  { id: "audit-4", actor: "Integracoes", actorRole: "admin", action: "Reprocessou fila de webhooks Mercado Livre", target: "Webhook queue", severity: "success", createdAt: "2026-03-19T12:08:00.000Z" },
  { id: "audit-5", actor: "Luiz Henrique", actorRole: "seller", action: "Exportou relatorio consolidado", target: "Profit report", severity: "neutral", createdAt: "2026-03-19T11:44:00.000Z" },
];

const adminIntegrationPanel = {
  summary: [
    { id: "int-sum-1", label: "Contas com falha", value: "8", tone: "warning" },
    { id: "int-sum-2", label: "Tokens expirando", value: "5", tone: "warning" },
    { id: "int-sum-3", label: "Reconciliações atrasadas", value: "3", tone: "danger" },
    { id: "int-sum-4", label: "Marketplaces monitorados", value: "3", tone: "neutral" },
  ],
  marketplaces: [
    { id: "mk-1", name: "Mercado Livre", healthyAccounts: 14, accountsWithIssues: 6, tokenExpiring: 4, reconciliationLag: "18 min", incidentCount: 2, status: "warning", note: "Principal foco do backlog atual." },
    { id: "mk-2", name: "Shopee", healthyAccounts: 9, accountsWithIssues: 2, tokenExpiring: 1, reconciliationLag: "7 min", incidentCount: 0, status: "success", note: "Operacao relativamente estavel." },
    { id: "mk-3", name: "Assistente IA", healthyAccounts: 0, accountsWithIssues: 0, tokenExpiring: 0, reconciliationLag: "n/a", incidentCount: 1, status: "warning", note: "Sem dependencia OAuth, mas com latencia acima da meta." },
  ],
  expiringTokens: [
    { id: "tok-1", accountName: "Loja Secundaria ML", marketplace: "Mercado Livre", expiresIn: "18 h", owner: "Loja Atlas" },
    { id: "tok-2", accountName: "Casa Prime ML", marketplace: "Mercado Livre", expiresIn: "1 dia", owner: "Casa Prime Seller" },
    { id: "tok-3", accountName: "Shopee Atlas", marketplace: "Shopee", expiresIn: "2 dias", owner: "Loja Atlas" },
  ],
  reconciliationQueue: [
    { id: "recq-1", name: "Pedidos pendentes de reconciliacao", backlog: 11, owner: "Integracoes", severity: "warning" },
    { id: "recq-2", name: "Eventos financeiros aguardando conciliar", backlog: 7, owner: "Financeiro", severity: "warning" },
    { id: "recq-3", name: "Reprocessamentos de webhook", backlog: 3, owner: "Plataforma", severity: "neutral" },
  ],
  incidents: [
    { id: "adm-int-1", title: "Token vencendo em lote de contas ML", severity: "warning", createdAt: "2026-03-19T13:18:00.000Z" },
    { id: "adm-int-2", title: "Fila Shopee voltou ao baseline", severity: "success", createdAt: "2026-03-19T10:04:00.000Z" },
  ],
};

module.exports = {
  adminIntegrationPanel,
  adminUsersSeed,
  auditTrail,
  observabilityData,
};
