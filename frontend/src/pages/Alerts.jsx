import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import { getSellerAlerts } from "../services/api";
import { formatFeedbackDateTime } from "../utils/feedback";
import "./Alerts.css";

function Alerts() {
  const navigate = useNavigate();
  const { selectedPeriod, setSelectedPeriod } = useAnalyticsPeriod();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadAlerts({ keepContent = false } = {}) {
    try {
      setError("");

      if (keepContent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await getSellerAlerts(selectedPeriod);
      setPayload(response);
    } catch {
      setError("Nao foi possivel carregar os alertas agora.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAlerts({
      keepContent: Boolean(payload),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  async function handleRefresh() {
    await loadAlerts({ keepContent: true });
  }

  if (loading && !payload) {
    return <div className="screen-message">Carregando alertas...</div>;
  }

  return (
    <div className="alerts-page">
      <PageHeader
        tag="Prioridades"
        title="Central de alertas"
        description="Monitore riscos da operacao e receba direcionamentos praticos a partir do contexto real do sistema."
      >
        <div className="alerts-header-actions">
          <div className={`alerts-period-switcher ${refreshing ? "is-busy" : ""}`}>
            <button
              type="button"
              className={selectedPeriod === "7d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("7d")}
            >
              7 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "30d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("30d")}
            >
              30 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "90d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("90d")}
            >
              90 dias
            </button>
          </div>

          <button type="button" className="alerts-refresh-button" onClick={handleRefresh}>
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </PageHeader>

      <div className="alerts-page-subtitle">
        <span>Ultima leitura: {formatFeedbackDateTime(payload?.generatedAt)}</span>
        <span>{payload?.summary?.warningCount || 0} alerta(s) em prioridade alta</span>
      </div>

      {error ? <div className="alerts-inline-alert">{error}</div> : null}

      <div className="alerts-summary-grid">
        {(payload?.digest || []).map((card) => (
          <article key={card.id} className={`alerts-summary-card is-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="alerts-layout">
        <section className="panel alerts-feed-panel">
          <div className="alerts-panel-header">
            <div>
              <h2>Fila de alertas</h2>
              <p>Leituras operacionais organizadas por impacto e proxima acao recomendada.</p>
            </div>
            <span className="alerts-panel-chip">{payload?.items?.length || 0} itens</span>
          </div>

          {payload?.items?.length ? (
            <div className="alerts-feed-list">
              {payload.items.map((item) => (
                <article key={item.id} className={`alerts-feed-card is-${item.severityTone}`}>
                  <div className="alerts-feed-topline">
                    <div className="alerts-badge-row">
                      <span className={`alerts-badge is-${item.severityTone}`}>
                        {item.severityLabel}
                      </span>
                      <span className="alerts-badge is-neutral">{item.category}</span>
                    </div>
                    <span>{item.metric.label}</span>
                  </div>

                  <strong>{item.title}</strong>
                  <p>{item.description}</p>

                  <div className="alerts-metric-box">
                    <span>{item.metric.label}</span>
                    <strong>{item.metric.value}</strong>
                  </div>

                  <div className="alerts-recommendation">
                    <span>Proxima acao</span>
                    <p>{item.recommendation}</p>
                  </div>

                  <button
                    type="button"
                    className="alerts-action-button"
                    onClick={() => navigate(item.action.path)}
                  >
                    {item.action.label}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="alerts-empty-state">
              <strong>Nenhum alerta ativo</strong>
              <p>Quando surgir um ponto de atencao relevante, ele vai aparecer aqui.</p>
            </div>
          )}
        </section>

        <div className="alerts-side-column">
          <section className="panel alerts-side-panel">
            <div className="alerts-panel-header">
              <div>
                <h2>Acoes sugeridas</h2>
                <p>Atalhos para agir mais rapido no que mais pesa no momento.</p>
              </div>
            </div>

            <div className="alerts-side-list">
              {(payload?.quickActions || []).map((action) => (
                <article key={action.id} className="alerts-side-card">
                  <strong>{action.title}</strong>
                  <p>{action.description}</p>
                  <button
                    type="button"
                    className="alerts-text-button"
                    onClick={() => navigate(action.action.path)}
                  >
                    {action.action.label}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="panel alerts-side-panel">
            <div className="alerts-panel-header">
              <div>
                <h2>Insights rapidos</h2>
                <p>Sinais complementares para apoiar sua tomada de decisao.</p>
              </div>
            </div>

            <div className="alerts-insight-list">
              {(payload?.insights || []).map((insight, index) => (
                <div key={`${insight}-${index}`} className="alerts-insight-item">
                  <div className="alerts-insight-dot" />
                  <p>{insight}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Alerts;
