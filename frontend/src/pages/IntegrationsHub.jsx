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
import IntegrationsStatusBanners from "../components/integrationsHub/IntegrationsStatusBanners";
import IntegrationsSummaryGrid from "../components/integrationsHub/IntegrationsSummaryGrid";
import IntegrationsCriticalStrip from "../components/integrationsHub/IntegrationsCriticalStrip";
import IntegrationsAccountsPanel from "../components/integrationsHub/IntegrationsAccountsPanel";
import IntegrationsEventsPanel from "../components/integrationsHub/IntegrationsEventsPanel";
import IntegrationsActionQueuePanel from "../components/integrationsHub/IntegrationsActionQueuePanel";
import {
  getAccountOperationalSignals,
  buildActionQueueItem,
  buildSyncEventItem,
} from "../utils/integrationsHubInsights";
import "./IntegrationsHub.css";

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

      <IntegrationsStatusBanners
        error={error}
        actionFeedback={actionFeedback}
        isMercadoLivreConnected={isMercadoLivreConnected}
        mercadoLivreStatus={mercadoLivreStatus}
        hasCriticalRisk={hasCriticalRisk}
        hasAttentionRisk={hasAttentionRisk}
        statusBannerTone={statusBannerTone}
        reauthorizationCount={reauthorizationCount}
        expiringSoonCount={expiringSoonCount}
        queuePendingCount={queuePendingCount}
      />

      <IntegrationsSummaryGrid summary={payload?.summary} />

      <IntegrationsCriticalStrip
        hasAccounts={accountsWithSignals.length > 0}
        hasCriticalRisk={hasCriticalRisk}
        hasAttentionRisk={hasAttentionRisk}
        reauthorizationCount={reauthorizationCount}
        expiringSoonCount={expiringSoonCount}
        queuePendingCount={queuePendingCount}
      />

      <div className="integrations-layout">
        <IntegrationsAccountsPanel
          accountsWithSignals={accountsWithSignals}
          actionLoading={actionLoading}
          onReconnect={handleMercadoLivreReconnect}
          onSyncAll={handleSyncAll}
          onDisconnect={handleDisconnect}
        />

        <div className="integrations-side-column">
          <IntegrationsEventsPanel
            syncEvents={syncEvents}
            actionLoading={actionLoading}
            onRefreshToken={handleRefreshToken}
          />

          <IntegrationsActionQueuePanel
            queueActions={queueActions}
            actionLoading={actionLoading}
            onActionFromQueue={handleActionFromQueue}
          />
        </div>
      </div>
    </div>
  );
}

export default IntegrationsHub;
