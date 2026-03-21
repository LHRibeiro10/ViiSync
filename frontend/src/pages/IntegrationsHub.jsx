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

function IntegrationsHub({ embedded = false }) {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [mercadoLivreStatus, setMercadoLivreStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

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
      {mercadoLivreStatus?.usingLive ? (
        <div className="integrations-inline-success">
          Integracao Mercado Livre em modo live.
        </div>
      ) : mercadoLivreStatus ? (
        <div className="integrations-inline-alert">
          Conta Mercado Livre sem credencial live ativa. Conecte via OAuth para sincronizar.
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

      <div className="integrations-layout">
        <section className="panel integrations-accounts-panel">
          <div className="integrations-panel-header">
            <div>
              <h2>Contas conectadas</h2>
              <p>Visibilidade operacional das contas que mantem o produto alimentado.</p>
            </div>
          </div>

          <div className="integrations-account-list">
            {(payload?.accounts || []).length ? (
              (payload?.accounts || []).map((account) => (
                <article key={account.id} className="integrations-account-card">
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

                  <div className="integrations-account-grid">
                    <div>
                      <span>Ultima sync</span>
                      <strong>{formatDateTime(account.lastSyncAt)}</strong>
                    </div>
                    <div>
                      <span>Latencia</span>
                      <strong>{account.latency}</strong>
                    </div>
                    <div>
                      <span>Fila</span>
                      <strong>{account.queueBacklog} evento(s)</strong>
                    </div>
                    <div>
                      <span>Token</span>
                      <strong>{account.tokenStatus}</strong>
                    </div>
                  </div>

                  <p>{account.note}</p>

                  <div className="integrations-account-actions">
                    <button
                      type="button"
                      className="integrations-primary-button"
                      onClick={() => handleMercadoLivreReconnect(account.name)}
                      disabled={actionLoading}
                    >
                      {account.reconnectRecommended ? "Reconectar" : "Renovar autorizacao"}
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
                <p>Leituras operacionais do pipeline de integracao.</p>
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
              {(payload?.syncEvents || []).map((event) => (
                <article key={event.id} className="integrations-side-card">
                  <strong>{event.title}</strong>
                  <p>{event.source}</p>
                  <span>{formatDateTime(event.createdAt)}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="panel integrations-side-panel">
            <div className="integrations-panel-header">
              <div>
                <h2>Fila de acoes</h2>
                <p>Pontos que merecem decisao do seller agora.</p>
              </div>
            </div>

            <div className="integrations-side-list">
              {(payload?.actions || []).map((action) => (
                <article key={action.id} className="integrations-side-card">
                  <strong>{action.title}</strong>
                  <p>{action.description}</p>
                  <button
                    type="button"
                    className="integrations-text-button"
                    onClick={() => handleActionFromQueue(action)}
                    disabled={actionLoading}
                  >
                    {action.cta}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default IntegrationsHub;
