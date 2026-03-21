import { useEffect, useState } from "react";
import { getAdminObservability } from "../services/api";
import { formatDateTime } from "../utils/presentation";
import "./AdminObservability.css";

function AdminObservability() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadObservability() {
      try {
        setError("");
        setLoading(true);
        const response = await getAdminObservability();

        if (!isCancelled) {
          setPayload(response);
        }
      } catch {
        if (!isCancelled) {
          setError("Nao foi possivel carregar a observabilidade.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadObservability();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (loading && !payload) {
    return <div className="screen-message">Carregando observabilidade...</div>;
  }

  return (
    <div className="admin-observability-page">
      <header className="admin-observability-hero">
        <div>
          <span className="admin-observability-tag">Plataforma</span>
          <h1>Observabilidade</h1>
          <p>Erros, rotas com falha, latencia, webhooks, jobs e estabilidade operacional.</p>
        </div>
      </header>

      {error ? <div className="admin-observability-inline-alert">{error}</div> : null}

      <section className="admin-observability-summary-grid">
        {(payload?.summary || []).map((card) => (
          <article key={card.id} className={`admin-observability-summary-card is-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <div className="admin-observability-grid">
        <section className="admin-observability-panel">
          <div className="admin-observability-panel-header">
            <div>
              <h2>Saude dos servicos</h2>
              <p>Visao rapida dos componentes mais sensiveis do sistema.</p>
            </div>
          </div>

          <div className="admin-observability-service-grid">
            {(payload?.services || []).map((service) => (
              <article key={service.id} className="admin-observability-card">
                <strong>{service.name}</strong>
                <span>{service.latency} · erro {service.errorRate}</span>
                <p>{service.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-observability-panel">
          <div className="admin-observability-panel-header">
            <div>
              <h2>Rotas com falha</h2>
              <p>Endpoints que mais estao pedindo acao do time.</p>
            </div>
          </div>

          <div className="admin-observability-list">
            {(payload?.routeFailures || []).map((route) => (
              <article key={route.id} className="admin-observability-list-item">
                <strong>{route.route}</strong>
                <p>{route.failures} falhas · p95 {route.latencyP95}</p>
                <span>{route.owner}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-observability-panel">
          <div className="admin-observability-panel-header">
            <div>
              <h2>Webhooks</h2>
              <p>Backlog, retries e idade do item mais antigo.</p>
            </div>
          </div>

          <div className="admin-observability-list">
            {(payload?.webhookQueues || []).map((item) => (
              <article key={item.id} className="admin-observability-list-item">
                <strong>{item.name}</strong>
                <p>{item.backlog} eventos · retry {item.retryRate}</p>
                <span>{item.oldestAge}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-observability-panel">
          <div className="admin-observability-panel-header">
            <div>
              <h2>Jobs</h2>
              <p>Filas assincronas e capacidade atual de processamento.</p>
            </div>
          </div>

          <div className="admin-observability-list">
            {(payload?.jobQueues || []).map((item) => (
              <article key={item.id} className="admin-observability-list-item">
                <strong>{item.name}</strong>
                <p>{item.pending} pendente(s) · {item.workers} worker(s)</p>
                <span>{item.status}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-observability-panel admin-observability-panel-wide">
          <div className="admin-observability-panel-header">
            <div>
              <h2>Incidentes monitorados</h2>
              <p>Itens que seguem abertos ou acompanhados pelo time interno.</p>
            </div>
          </div>

          <div className="admin-observability-list">
            {(payload?.incidents || []).map((item) => (
              <article key={item.id} className="admin-observability-list-item">
                <strong>{item.title}</strong>
                <p>{item.severity}</p>
                <span>{formatDateTime(item.openedAt)}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminObservability;
