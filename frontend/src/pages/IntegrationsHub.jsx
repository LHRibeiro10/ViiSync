import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  disconnectMercadoLivreIntegration,
  getIntegrationsHub,
  getMercadoLivreAuthorizationUrl,
  getMercadoLivreIntegrationStatus,
  refreshMercadoLivreIntegrationToken,
  syncMercadoLivreAll,
} from "../services/api";
import { formatDateTime } from "../utils/presentation";
import "./IntegrationsHub.css";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getAccountOperationalSignals(account) {
  const tokenStatus = normalizeText(account?.tokenStatus);
  const queueBacklog = Number(account?.queueBacklog || 0);
  const reconnectRecommended = Boolean(account?.reconnectRecommended);
  const tokenExpired = tokenStatus.includes("expirado");
  const tokenExpiringSoon = tokenStatus.includes("expira em breve");
  const syncStatus = normalizeText(account?.syncStatus);
  const syncWithError = syncStatus === "error" || Boolean(account?.syncLastError);
  const queueHigh = queueBacklog >= 5;
  const queuePending = queueBacklog > 0;

  let tone = "stable";
  if (reconnectRecommended || tokenExpired || syncWithError || queueHigh) {
    tone = "critical";
  } else if (tokenExpiringSoon || queuePending) {
    tone = "attention";
  }

  const chips = [];
  if (reconnectRecommended || tokenExpired) {
    chips.push({
      id: "reauthorize",
      label: "Reautorizacao necessaria",
      tone: "critical",
    });
  } else if (tokenExpiringSoon) {
    chips.push({
      id: "token-expiring",
      label: "Token expira em breve",
      tone: "attention",
    });
  }

  if (syncWithError) {
    chips.push({
      id: "sync-error",
      label: "Falha de sincronizacao",
      tone: "critical",
    });
  }

  if (queueHigh) {
    chips.push({
      id: "queue-high",
      label: `Fila alta: ${queueBacklog} evento(s)`,
      tone: "critical",
    });
  } else if (queuePending) {
    chips.push({
      id: "queue-pending",
      label: `Fila pendente: ${queueBacklog} evento(s)`,
      tone: "attention",
    });
  }

  if (!chips.length) {
    chips.push({
      id: "stable",
      label: "Operacao estavel",
      tone: "success",
    });
  }

  let nextStep = "Manter monitoramento diario da conta conectada.";
  if (reconnectRecommended || tokenExpired) {
    nextStep = "Reautorize via OAuth e valide o status como Conectado.";
  } else if (tokenExpiringSoon) {
    nextStep = "Renove o token preventivamente para evitar bloqueio da sincronizacao.";
  } else if (syncWithError) {
    nextStep = "Execute sincronizacao agora e valide o ultimo erro registrado.";
  } else if (queuePending) {
    nextStep = "Processe a fila manualmente para reduzir pendencias operacionais.";
  }

  return {
    tone,
    chips,
    nextStep,
    flags: {
      reconnectRecommended,
      tokenExpired,
      tokenExpiringSoon,
      queuePending,
      queueHigh,
      syncWithError,
    },
  };
}

function buildActionQueueItem(action) {
  const id = normalizeText(action?.id);
  const cta = String(action?.cta || "Executar");
  let priorityTone = "attention";
  let priorityLabel = "Prioridade media";
  let sortOrder = 2;
  let nextStep = `Executar "${cta}" e confirmar o status operacional apos a acao.`;
  let expectedResult = "Pendencia tratada e status atualizado.";
  let actionable = true;

  if (id.includes("reconnect") || id.includes("connect-first-account")) {
    priorityTone = "critical";
    priorityLabel = "Prioridade alta";
    sortOrder = 0;
    nextStep = "Concluir reautorizacao OAuth da conta e validar retorno da sincronizacao.";
    expectedResult = "Conta com credenciais validas e fila liberada para sincronizar.";
  } else if (id.includes("review-questions")) {
    priorityTone = "attention";
    priorityLabel = "Prioridade media";
    sortOrder = 1;
    nextStep = "Abrir Perguntas ML e responder pendencias mais antigas primeiro.";
    expectedResult = "SLA operacional preservado e queda de pendencias na inbox.";
  } else if (id.includes("all-good")) {
    priorityTone = "success";
    priorityLabel = "Prioridade baixa";
    sortOrder = 3;
    nextStep = "Nenhuma acao imediata. Mantenha monitoramento e sincronizacao de rotina.";
    expectedResult = "Operacao estavel sem pendencias criticas.";
    actionable = false;
  }

  return {
    ...action,
    priorityTone,
    priorityLabel,
    sortOrder,
    nextStep,
    expectedResult,
    actionable,
    ctaLabel: actionable ? cta : "Sem acao pendente",
  };
}

function buildSyncEventItem(event, accountsById) {
  const accountId = String(event?.id || "").replace(/^event-/, "");
  const account = accountsById.get(accountId);
  const signals = account ? getAccountOperationalSignals(account) : null;
  const tone = signals?.tone || "neutral";

  let statusCopy = "Sem alerta critico neste checkpoint.";
  let recommendation = "Mantenha monitoramento da integracao e da fila de eventos.";

  if (signals?.flags.reconnectRecommended || signals?.flags.tokenExpired) {
    statusCopy = "Credenciais em risco de bloqueio. Reautorizacao recomendada.";
    recommendation = "Execute reautorizacao OAuth para manter seguranca e continuidade da conta.";
  } else if (signals?.flags.tokenExpiringSoon) {
    statusCopy = "Token em janela de expiracao curta.";
    recommendation = "Renove o token preventivamente para evitar interrupcao.";
  } else if (signals?.flags.syncWithError) {
    statusCopy = "Ultima sincronizacao registrou falha.";
    recommendation = "Rodar nova sincronizacao e validar erro retornado pelo canal.";
  } else if (signals?.flags.queuePending) {
    statusCopy = `Fila com ${account.queueBacklog} evento(s) pendente(s).`;
    recommendation = "Processar backlog para manter visibilidade operacional em dia.";
  }

  return {
    ...event,
    tone,
    statusCopy,
    recommendation,
    syncStatusLabel: account?.syncStatusLabel || "Sem status registrado",
  };
}

function IntegrationsHub({ embedded = false }) {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [mercadoLivreStatus, setMercadoLivreStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const isMercadoLivreConnected = Boolean(mercadoLivreStatus?.usingLive);

  const loadIntegrationHub = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [response, statusResponse] = await Promise.all([
        getIntegrationsHub(),
        getMercadoLivreIntegrationStatus().catch(() => null),
      ]);

      setPayload(response);
      setMercadoLivreStatus(statusResponse);
    } catch (loadError) {
      setError(
        loadError?.message || "Nao foi possivel carregar o hub de integracoes."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrationHub();
  }, [loadIntegrationHub]);

  function showActionMessage(message, tone = "success") {
    setActionFeedback({
      message,
      tone,
    });
    window.setTimeout(() => setActionFeedback(null), 2600);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const connectedFlag = url.searchParams.get("ml");

    if (connectedFlag !== "connected") {
      return;
    }

    setActionFeedback({
      message: "Conta Mercado Livre conectada com sucesso. Atualizando status...",
      tone: "success",
    });
    window.setTimeout(() => setActionFeedback(null), 2600);
    loadIntegrationHub();
    url.searchParams.delete("ml");
    window.history.replaceState({}, "", url.toString());
  }, [loadIntegrationHub]);

  async function handleMercadoLivreReconnect(accountName) {
    try {
      const authorizationPayload = await getMercadoLivreAuthorizationUrl({
        accountName,
      });

      if (!authorizationPayload?.authorizationUrl) {
        throw new Error("Nao foi possivel obter a URL de autorizacao do Mercado Livre.");
      }

      window.open(authorizationPayload.authorizationUrl, "_blank", "noopener,noreferrer");
      showActionMessage(
        "Fluxo OAuth do Mercado Livre aberto. Conclua a autorizacao e atualize esta tela.",
        "success"
      );
    } catch (actionError) {
      showActionMessage(
        actionError.message || "Nao foi possivel iniciar a autorizacao do Mercado Livre.",
        "error"
      );
    }
  }

  async function runAction(task, successMessage) {
    try {
      setActionLoading(true);
      await task();
      showActionMessage(successMessage, "success");
      await loadIntegrationHub();
    } catch (actionError) {
      showActionMessage(
        actionError.message || "Nao foi possivel concluir a operacao.",
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSyncAll() {
    await runAction(
      () => syncMercadoLivreAll({}),
      "Sincronizacao completa do Mercado Livre concluida."
    );
  }

  async function handleRefreshToken() {
    await runAction(
      () => refreshMercadoLivreIntegrationToken(),
      "Token Mercado Livre renovado com sucesso."
    );
  }

  async function handleDisconnect() {
    await runAction(
      () => disconnectMercadoLivreIntegration(),
      "Conta Mercado Livre desconectada com sucesso."
    );
  }

  function handleActionFromQueue(action) {
    if (action?.actionable === false) {
      return;
    }

    const cta = String(action?.cta || "").toLowerCase();

    if (cta.includes("conectar") || cta.includes("reconectar")) {
      handleMercadoLivreReconnect("Conta Mercado Livre");
      return;
    }

    if (cta.includes("perguntas")) {
      navigate("/mercado-livre/perguntas");
      return;
    }

    handleSyncAll();
  }

  if (loading && !payload) {
    return <div className="screen-message">Carregando integracoes...</div>;
  }

  const accounts = payload?.accounts || [];
  const accountsWithSignals = accounts.map((account) => ({
    ...account,
    operationalSignals: getAccountOperationalSignals(account),
  }));
  const accountsById = new Map(accountsWithSignals.map((account) => [account.id, account]));
  const queueActions = (payload?.actions || [])
    .map((action) => buildActionQueueItem(action))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const syncEvents = (payload?.syncEvents || []).map((event) =>
    buildSyncEventItem(event, accountsById)
  );

  const reauthorizationCount = accountsWithSignals.filter(
    (account) =>
      account.operationalSignals.flags.reconnectRecommended ||
      account.operationalSignals.flags.tokenExpired
  ).length;
  const expiringSoonCount = accountsWithSignals.filter(
    (account) => account.operationalSignals.flags.tokenExpiringSoon
  ).length;
  const queuePendingCount = accountsWithSignals.reduce(
    (sum, account) =>
      sum +
      (account.operationalSignals.flags.queuePending
        ? Number(account.queueBacklog || 0)
        : 0),
    0
  );
  const criticalAccountCount = accountsWithSignals.filter(
    (account) => account.operationalSignals.tone === "critical"
  ).length;
  const hasCriticalRisk = reauthorizationCount > 0 || criticalAccountCount > 0;
  const hasAttentionRisk = !hasCriticalRisk && (expiringSoonCount > 0 || queuePendingCount > 0);
  const statusBannerTone = hasCriticalRisk
    ? "alert"
    : hasAttentionRisk
      ? "attention"
      : "success";

  return (
    <div className={`integrations-page ${embedded ? "is-embedded" : ""}`}>
      {embedded ? null : (
        <PageHeader
          tag="Integracoes"
          title="Hub de integracoes"
          description="Conecte e monitore sua conta Mercado Livre para manter sincronizacao operacional."
        />
      )}

      {error ? <div className="integrations-inline-alert">{error}</div> : null}
      {actionFeedback ? (
        <div
          className={
            actionFeedback.tone === "error"
              ? "integrations-inline-alert"
              : "integrations-inline-success"
          }
        >
          {actionFeedback.message}
        </div>
      ) : null}
      {isMercadoLivreConnected ? (
        <div className={`integrations-inline-${statusBannerTone}`}>
          {hasCriticalRisk
            ? `Conta conectada com risco operacional: ${reauthorizationCount} conta(s) pedem reautorizacao ou estao em estado critico.`
            : hasAttentionRisk
              ? `Conta conectada com monitoramento ativo: ${expiringSoonCount} token(s) expiram em breve e ${queuePendingCount} evento(s) aguardam processamento.`
              : "Conta Mercado Livre conectada e operacao sob controle."}{" "}
          Status da sincronizacao: {mercadoLivreStatus?.sync?.statusLabel || "Aguardando"}.
          {mercadoLivreStatus?.sync?.lastSyncedAt
            ? ` Ultima sincronizacao em ${formatDateTime(
                mercadoLivreStatus.sync.lastSyncedAt
              )}.`
            : " Sem registro recente de sincronizacao concluida."}
        </div>
      ) : mercadoLivreStatus ? (
        <div className="integrations-inline-alert">
          Conexao Mercado Livre pendente. Conecte via OAuth para sincronizar.
        </div>
      ) : null}

      <div className="integrations-summary-grid">
        {(payload?.summary || []).map((card) => (
          <article key={card.id} className={`integrations-summary-card is-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      {accountsWithSignals.length ? (
        <section
          className={`integrations-critical-strip is-${
            hasCriticalRisk ? "critical" : hasAttentionRisk ? "attention" : "stable"
          }`}
        >
          <div>
            <h3>Controle da conta conectada</h3>
            <p>
              Priorize riscos de autenticacao e pendencias de sincronizacao para manter
              seguranca e continuidade operacional.
            </p>
          </div>

          <div className="integrations-critical-chips">
            {hasCriticalRisk || hasAttentionRisk ? (
              <>
                <span className="integrations-critical-chip is-critical">
                  {reauthorizationCount} reautorizacao(oes) pendente(s)
                </span>
                <span className="integrations-critical-chip is-attention">
                  {expiringSoonCount} token(s) expiram em breve
                </span>
                <span className="integrations-critical-chip is-attention">
                  {queuePendingCount} evento(s) pendente(s) na fila
                </span>
              </>
            ) : (
              <span className="integrations-critical-chip is-success">
                Sem risco critico no momento
              </span>
            )}
          </div>
        </section>
      ) : null}

      <div className="integrations-layout">
        <section className="panel integrations-accounts-panel">
          <div className="integrations-panel-header">
            <div>
              <h2>Contas conectadas</h2>
              <p>Visibilidade de seguranca, token e sincronizacao por conta conectada.</p>
            </div>
          </div>

          <div className="integrations-account-list">
            {accountsWithSignals.length ? (
              accountsWithSignals.map((account) => (
                <article
                  key={account.id}
                  className={`integrations-account-card is-${account.operationalSignals.tone}`}
                >
                  <div className="integrations-account-top">
                    <div>
                      <strong>{account.name}</strong>
                      <p>{account.marketplace}</p>
                    </div>
                    <span
                      className={`integrations-badge is-${
                        account.reconnectRecommended ? "warning" : "success"
                      }`}
                    >
                      {account.status}
                    </span>
                  </div>

                  <div className="integrations-account-signals">
                    {account.operationalSignals.chips.map((chip) => (
                      <span
                        key={`${account.id}-${chip.id}`}
                        className={`integrations-account-signal is-${chip.tone}`}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>

                  <div className="integrations-account-grid">
                    <div>
                      <span>Ultima sincronizacao</span>
                      <strong>{formatDateTime(account.lastSyncAt)}</strong>
                    </div>
                    <div>
                      <span>Status da sync</span>
                      <strong
                        className={`integrations-metric-value is-${
                          account.operationalSignals.flags.syncWithError
                            ? "critical"
                            : "neutral"
                        }`}
                      >
                        {account.syncStatusLabel || "Aguardando"}
                      </strong>
                    </div>
                    <div>
                      <span>Fila</span>
                      <strong
                        className={`integrations-metric-value is-${
                          account.operationalSignals.flags.queueHigh
                            ? "critical"
                            : account.operationalSignals.flags.queuePending
                              ? "attention"
                              : "neutral"
                        }`}
                      >
                        {account.queueBacklog} evento(s)
                      </strong>
                    </div>
                    <div>
                      <span>Token</span>
                      <strong
                        className={`integrations-metric-value is-${
                          account.operationalSignals.flags.reconnectRecommended ||
                          account.operationalSignals.flags.tokenExpired
                            ? "critical"
                            : account.operationalSignals.flags.tokenExpiringSoon
                              ? "attention"
                              : "neutral"
                        }`}
                      >
                        {account.tokenStatus}
                      </strong>
                    </div>
                  </div>

                  <p className="integrations-account-note">{account.note}</p>
                  <p className="integrations-account-next-step">
                    <strong>Proximo passo:</strong> {account.operationalSignals.nextStep}
                  </p>
                  {account.syncLastError ? (
                    <p className="integrations-account-error">
                      Ultimo erro: {account.syncLastError}
                    </p>
                  ) : null}

                  <div className="integrations-account-actions">
                    <button
                      type="button"
                      className="integrations-primary-button"
                      onClick={() => handleMercadoLivreReconnect(account.name)}
                      disabled={actionLoading}
                    >
                      {account.reconnectRecommended ? "Reconectar" : "Reautorizar"}
                    </button>
                    <button
                      type="button"
                      className="integrations-secondary-button"
                      onClick={handleSyncAll}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Processando..." : "Sincronizar agora"}
                    </button>
                    <button
                      type="button"
                      className="integrations-text-button"
                      onClick={handleDisconnect}
                      disabled={actionLoading}
                    >
                      Desconectar conta
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <article className="integrations-account-card">
                <div className="integrations-account-top">
                  <div>
                    <strong>Nenhuma conta conectada</strong>
                    <p>Mercado Livre</p>
                  </div>
                  <span className="integrations-badge is-warning">Pendente</span>
                </div>

                <p>
                  Conecte sua conta do Mercado Livre para sincronizar perguntas, pedidos,
                  produtos e relatorios por canal.
                </p>

                <div className="integrations-account-actions">
                  <button
                    type="button"
                    className="integrations-primary-button"
                    onClick={() => handleMercadoLivreReconnect("Conta principal ML")}
                    disabled={actionLoading}
                  >
                    Conectar conta Mercado Livre
                  </button>
                </div>
              </article>
            )}
          </div>
        </section>

        <div className="integrations-side-column">
          <section className="panel integrations-side-panel">
            <div className="integrations-panel-header">
              <div>
                <h2>Eventos recentes</h2>
                <p>Registro recente de status com foco em seguranca e continuidade da sync.</p>
              </div>
              <button
                type="button"
                className="integrations-text-button"
                onClick={handleRefreshToken}
                disabled={actionLoading}
              >
                Renovar token
              </button>
            </div>

            <div className="integrations-side-list">
              {syncEvents.length ? (
                syncEvents.map((event) => (
                  <article
                    key={event.id}
                    className={`integrations-side-card integrations-event-card is-${event.tone}`}
                  >
                    <strong>{event.title}</strong>
                    <p>
                      {event.source} | Status: {event.syncStatusLabel}
                    </p>
                    <p className="integrations-event-copy">
                      <strong>Leitura:</strong> {event.statusCopy}
                    </p>
                    <p className="integrations-event-copy">
                      <strong>Acao recomendada:</strong> {event.recommendation}
                    </p>
                    <span>{formatDateTime(event.createdAt)}</span>
                  </article>
                ))
              ) : (
                <article className="integrations-side-card">
                  <strong>Nenhum evento recente</strong>
                  <p>Sem registros operacionais no recorte atual.</p>
                  <span>Atualize a integracao para gerar novo checkpoint.</span>
                </article>
              )}
            </div>
          </section>

          <section className="panel integrations-side-panel">
            <div className="integrations-panel-header">
              <div>
                <h2>Fila de acoes</h2>
                <p>Pendencias ordenadas por prioridade com o proximo passo esperado.</p>
              </div>
            </div>

            <div className="integrations-side-list">
              {queueActions.length ? (
                queueActions.map((action) => (
                  <article
                    key={action.id}
                    className={`integrations-side-card integrations-action-card is-${action.priorityTone}`}
                  >
                    <div className="integrations-action-head">
                      <strong>{action.title}</strong>
                      <span className={`integrations-action-priority is-${action.priorityTone}`}>
                        {action.priorityLabel}
                      </span>
                    </div>
                    <p>{action.description}</p>
                    <p className="integrations-action-copy">
                      <strong>Proximo passo:</strong> {action.nextStep}
                    </p>
                    <p className="integrations-action-copy">
                      <strong>Resultado esperado:</strong> {action.expectedResult}
                    </p>
                    <button
                      type="button"
                      className="integrations-text-button"
                      onClick={() => handleActionFromQueue(action)}
                      disabled={actionLoading || !action.actionable}
                    >
                      {action.ctaLabel}
                    </button>
                  </article>
                ))
              ) : (
                <article className="integrations-side-card">
                  <strong>Sem acoes pendentes</strong>
                  <p>Fila operacional vazia para este momento.</p>
                  <span>Mantenha monitoramento diario da conta conectada.</span>
                </article>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default IntegrationsHub;
