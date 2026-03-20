import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminConsoleMock } from "../data/adminConsoleMock";
import { getAdminFeedbacks } from "../services/api";
import "./AdminOverview.css";

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusToneClass(value) {
  if (value === "healthy" || value === "success") {
    return "is-success";
  }

  if (value === "degraded" || value === "critical" || value === "danger") {
    return "is-danger";
  }

  return "is-warning";
}

function AdminOverview() {
  const [feedbackPayload, setFeedbackPayload] = useState(null);
  const [feedbackError, setFeedbackError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadFeedbackInbox() {
      try {
        setFeedbackError("");
        const response = await getAdminFeedbacks();

        if (!isCancelled) {
          setFeedbackPayload(response);
        }
      } catch (err) {
        if (!isCancelled) {
          setFeedbackError("Usando fila estatica enquanto a inbox nao responde.");
        }
      }
    }

    loadFeedbackInbox();

    return () => {
      isCancelled = true;
    };
  }, []);

  const summaryCards = useMemo(() => {
    return adminConsoleMock.summary.map((card) => {
      if (card.id !== "open-tickets") {
        return card;
      }

      if (!feedbackPayload?.meta) {
        return card;
      }

      return {
        ...card,
        value: String(feedbackPayload.meta.openCount),
        trend: `${feedbackPayload.meta.highPriorityCount} com prioridade alta`,
      };
    });
  }, [feedbackPayload]);

  const complaintFeed = useMemo(() => {
    if (feedbackPayload?.items?.length) {
      return feedbackPayload.items.slice(0, 4).map((item) => ({
        id: item.id,
        priorityLabel: item.priorityLabel,
        priorityTone: item.priorityTone,
        openedAt: item.createdAt,
        topic: item.subject,
        customer: item.submittedBy.company,
        channel: item.typeLabel,
        status: item.statusLabel,
      }));
    }

    return adminConsoleMock.complaints.map((complaint) => ({
      id: complaint.id,
      priorityLabel: complaint.priority,
      priorityTone: complaint.priority === "Alta" ? "danger" : "warning",
      openedAt: complaint.openedAt,
      topic: complaint.topic,
      customer: complaint.customer,
      channel: complaint.channel,
      status: complaint.status,
    }));
  }, [feedbackPayload]);

  return (
    <div className="admin-overview-page">
      <header className="admin-overview-hero">
        <div className="admin-overview-copy">
          <span className="admin-overview-tag">Operacao interna</span>
          <h1>Console administrativo do ViiSync</h1>
          <p>
            Painel separado do seller para acompanhar reclamacoes, erros,
            estabilidade, integracoes e eventos que exigem acao do time.
          </p>
        </div>

        <div className="admin-overview-hero-meta">
          <div className="admin-overview-chip">
            <span>Ambiente</span>
            <strong>{adminConsoleMock.environment}</strong>
          </div>
          <div className="admin-overview-chip">
            <span>Ultima atualizacao</span>
            <strong>{formatDateTime(adminConsoleMock.generatedAt)}</strong>
          </div>
        </div>
      </header>

      <section className="admin-summary-grid">
        {summaryCards.map((card) => (
          <article
            key={card.id}
            className={`admin-summary-card ${getStatusToneClass(card.tone)}`}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.trend}</p>
          </article>
        ))}
      </section>

      <div className="admin-overview-grid">
        <section className="admin-panel admin-panel-wide">
          <div className="admin-panel-header">
            <div>
              <h2>Saude dos servicos</h2>
              <p>Visao rapida dos componentes mais sensiveis do produto.</p>
            </div>
          </div>

          <div className="admin-service-grid">
            {adminConsoleMock.services.map((service) => (
              <article key={service.id} className="admin-service-card">
                <div className="admin-service-top">
                  <strong>{service.name}</strong>
                  <span className={`admin-status-badge ${getStatusToneClass(service.status)}`}>
                    {service.status === "healthy"
                      ? "Saudavel"
                      : service.status === "degraded"
                        ? "Degradado"
                        : "Atencao"}
                  </span>
                </div>
                <div className="admin-service-metrics">
                  <div>
                    <span>Latencia</span>
                    <strong>{service.latency}</strong>
                  </div>
                  <div>
                    <span>Uptime</span>
                    <strong>{service.uptime}</strong>
                  </div>
                </div>
                <p>{service.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Centro de acoes</h2>
              <p>Itens que pedem decisao imediata do time.</p>
            </div>
          </div>

          <div className="admin-action-list">
            {adminConsoleMock.actionItems.map((action) => (
              <article key={action.id} className="admin-action-card">
                <span className={`admin-status-badge ${getStatusToneClass(action.tone)}`}>
                  {action.due}
                </span>
                <strong>{action.title}</strong>
                <p>Responsavel: {action.owner}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Incidentes ativos</h2>
              <p>Fluxo do que esta afetando sellers agora.</p>
            </div>
          </div>

          <div className="admin-feed-list">
            {adminConsoleMock.incidents.map((incident) => (
              <article key={incident.id} className="admin-feed-card">
                <div className="admin-feed-topline">
                  <span className={`admin-status-badge ${getStatusToneClass(incident.severity)}`}>
                    {incident.status}
                  </span>
                  <small>{formatDateTime(incident.startedAt)}</small>
                </div>
                <strong>{incident.title}</strong>
                <p>{incident.impact}</p>
                <div className="admin-feed-meta">
                  <span>{incident.id}</span>
                  <span>{incident.owner}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Reclamacoes e suporte</h2>
              <p>Fila priorizada do que os usuarios estao sentindo dentro do produto.</p>
            </div>
            <Link to="/admin/reclamacoes" className="admin-panel-link">
              Abrir inbox
            </Link>
          </div>

          {feedbackError ? <div className="admin-inline-note">{feedbackError}</div> : null}

          <div className="admin-feed-list">
            {complaintFeed.map((complaint) => (
              <article key={complaint.id} className="admin-feed-card">
                <div className="admin-feed-topline">
                  <span
                    className={`admin-status-badge is-${complaint.priorityTone}`}
                  >
                    {complaint.priorityLabel}
                  </span>
                  <small>{formatDateTime(complaint.openedAt)}</small>
                </div>
                <strong>{complaint.topic}</strong>
                <p>{complaint.customer}</p>
                <div className="admin-feed-meta">
                  <span>{complaint.channel}</span>
                  <span>{complaint.status}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Erros recentes</h2>
              <p>Eventos que merecem tratativa tecnica.</p>
            </div>
          </div>

          <div className="admin-error-list">
            {adminConsoleMock.recentErrors.map((error) => (
              <article key={error.id} className="admin-error-card">
                <div className="admin-feed-topline">
                  <span
                    className={`admin-status-badge ${
                      error.level === "error" ? "is-danger" : "is-warning"
                    }`}
                  >
                    {error.count} ocorrencias
                  </span>
                  <small>{formatDateTime(error.lastSeenAt)}</small>
                </div>
                <strong>{error.source}</strong>
                <p>{error.note}</p>
                <div className="admin-feed-meta">
                  <span>{error.id}</span>
                  <span>{error.level}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Integracoes</h2>
              <p>Monitoramento operacional por conector.</p>
            </div>
          </div>

          <div className="admin-integration-list">
            {adminConsoleMock.integrations.map((integration) => (
              <article key={integration.id} className="admin-integration-card">
                <div className="admin-service-top">
                  <strong>{integration.name}</strong>
                  <span
                    className={`admin-status-badge ${getStatusToneClass(
                      integration.status
                    )}`}
                  >
                    {integration.status === "healthy" ? "Estavel" : "Atencao"}
                  </span>
                </div>
                <div className="admin-integration-metrics">
                  <span>{integration.accountsWithIssues} conta(s) com problema</span>
                  <span>{integration.queueBacklog} eventos na fila</span>
                </div>
                <p>{integration.note}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminOverview;
