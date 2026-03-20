import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import {
  getIntegrationsHub,
  getMercadoLivreAuthorizationStartUrl,
  getMercadoLivreIntegrationStatus,
} from "../services/api";
import { formatDateTime } from "../utils/presentation";
import "./IntegrationsHub.css";

function IntegrationsHub() {
  const [payload, setPayload] = useState(null);
  const [mercadoLivreStatus, setMercadoLivreStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadIntegrationHub() {
      try {
        setError("");
        setLoading(true);
        const [response, statusResponse] = await Promise.all([
          getIntegrationsHub(),
          getMercadoLivreIntegrationStatus().catch(() => null),
        ]);

        if (!isCancelled) {
          setPayload(response);
          setMercadoLivreStatus(statusResponse);
        }
      } catch (err) {
        if (!isCancelled) {
          setError("Nao foi possivel carregar o hub de integracoes.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadIntegrationHub();

    return () => {
      isCancelled = true;
    };
  }, []);

  function triggerMockAction(message) {
    setActionMessage(message);
    window.setTimeout(() => setActionMessage(""), 2200);
  }

  function handleMercadoLivreReconnect(accountName) {
    const authorizationStartUrl = getMercadoLivreAuthorizationStartUrl({ accountName });
    window.open(authorizationStartUrl, "_blank", "noopener,noreferrer");
    triggerMockAction("Fluxo OAuth do Mercado Livre aberto em nova aba.");
  }

  if (loading && !payload) {
    return <div className="screen-message">Carregando integracoes...</div>;
  }

  return (
    <div className="integrations-page">
      <PageHeader
        tag="Integracoes"
        title="Hub de integracoes"
        description="Status das contas, sincronizacoes, erros, tokens e proximas acoes para manter a operacao conectada."
      />

      {error ? <div className="integrations-inline-alert">{error}</div> : null}
      {actionMessage ? <div className="integrations-inline-success">{actionMessage}</div> : null}
      {mercadoLivreStatus?.usingLive ? (
        <div className="integrations-inline-success">
          Integracao Mercado Livre em modo live.
        </div>
      ) : mercadoLivreStatus ? (
        <div className="integrations-inline-alert">
          Mercado Livre em modo mock. Conecte via OAuth para usar API real.
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
            {(payload?.accounts || []).map((account) => (
              <article key={account.id} className="integrations-account-card">
                <div className="integrations-account-top">
                  <div>
                    <strong>{account.name}</strong>
                    <p>{account.marketplace}</p>
                  </div>
                  <span className={`integrations-badge is-${account.reconnectRecommended ? "warning" : "success"}`}>
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
                    onClick={() => {
                      const isMercadoLivre = String(account.marketplace || "")
                        .toLowerCase()
                        .includes("mercado livre");

                      if (isMercadoLivre) {
                        handleMercadoLivreReconnect(account.name);
                        return;
                      }

                      triggerMockAction(`Acao simulada para ${account.name}: revisar reconexao.`);
                    }}
                  >
                    {account.reconnectRecommended ? "Reconectar" : "Sincronizar"}
                  </button>
                  <button
                    type="button"
                    className="integrations-secondary-button"
                    onClick={() =>
                      triggerMockAction(`Abrindo log mockado da conta ${account.name}.`)
                    }
                  >
                    Ver logs
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="integrations-side-column">
          <section className="panel integrations-side-panel">
            <div className="integrations-panel-header">
              <div>
                <h2>Eventos recentes</h2>
                <p>Leituras operacionais do pipeline de integracao.</p>
              </div>
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
                    onClick={() => triggerMockAction(`${action.cta} mockado com sucesso.`)}
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
