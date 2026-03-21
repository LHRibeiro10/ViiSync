import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAdminFeedbacks,
  getAdminIntegrationPanel,
  getAdminObservability,
  getAdminUsers,
} from "../services/api";
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
  const [observabilityPayload, setObservabilityPayload] = useState(null);
  const [usersPayload, setUsersPayload] = useState(null);
  const [integrationPayload, setIntegrationPayload] = useState(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [overviewError, setOverviewError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(new Date().toISOString());

  useEffect(() => {
    let isCancelled = false;

    async function loadOverview() {
      try {
        setFeedbackError("");
        setOverviewError("");

        const [feedbackResponse, observabilityResponse, usersResponse, integrationsResponse] =
          await Promise.all([
            getAdminFeedbacks().catch(() => null),
            getAdminObservability().catch(() => null),
            getAdminUsers().catch(() => null),
            getAdminIntegrationPanel().catch(() => null),
          ]);

        if (isCancelled) {
          return;
        }

        if (feedbackResponse) {
          setFeedbackPayload(feedbackResponse);
        } else {
          setFeedbackError("Nao foi possivel carregar a fila de reclamacoes agora.");
        }

        if (observabilityResponse) {
          setObservabilityPayload(observabilityResponse);
        }

        if (usersResponse) {
          setUsersPayload(usersResponse);
        }

        if (integrationsResponse) {
          setIntegrationPayload(integrationsResponse);
        }

        if (!observabilityResponse && !usersResponse && !integrationsResponse) {
          setOverviewError("Nao foi possivel carregar os indicadores administrativos.");
        }

        setGeneratedAt(new Date().toISOString());
      } catch {
        if (!isCancelled) {
          setOverviewError("Nao foi possivel carregar o resumo administrativo.");
        }
      }
    }

    loadOverview();

    return () => {
      isCancelled = true;
    };
  }, []);

  const summaryCards = useMemo(() => {
    const openTickets = feedbackPayload?.meta?.openCount || 0;
    const activeUsers = usersPayload?.summary?.total || 0;
    const suspendedUsers = usersPayload?.summary?.blockedCount || 0;
    const integrationIssues =
      integrationPayload?.marketplaces?.reduce(
        (sum, item) => sum + Number(item.accountsWithIssues || 0),
        0
      ) || 0;

    return [
      {
        id: "open-tickets",
        label: "Tickets abertos",
        value: String(openTickets),
        trend: `${feedbackPayload?.meta?.highPriorityCount || 0} com prioridade alta`,
        tone: openTickets > 0 ? "warning" : "success",
      },
      {
        id: "active-users",
        label: "Usuarios monitorados",
        value: String(activeUsers),
        trend: `${suspendedUsers} conta(s) suspensa(s)`,
        tone: suspendedUsers > 0 ? "warning" : "success",
      },
      {
        id: "integration-issues",
        label: "Pendencias de integracao",
        value: String(integrationIssues),
        trend: `${integrationPayload?.summary?.find((item) => item.id === "integration-expiring-tokens")?.value || 0} token(s) expirando`,
        tone: integrationIssues > 0 ? "warning" : "success",
      },
      {
        id: "active-sessions",
        label: "Sessoes ativas",
        value:
          observabilityPayload?.summary?.find((item) => item.id === "obs-active-sessions")
            ?.value || "0",
        trend: "Leitura operacional em tempo real",
        tone: "neutral",
      },
    ];
  }, [feedbackPayload, integrationPayload, observabilityPayload, usersPayload]);

  const complaintFeed = useMemo(() => {
    return (feedbackPayload?.items || []).slice(0, 4).map((item) => ({
      id: item.id,
      priorityLabel: item.priorityLabel,
      priorityTone: item.priorityTone,
      openedAt: item.createdAt,
      topic: item.subject,
      customer: item.submittedBy.company,
      channel: item.typeLabel,
      status: item.statusLabel,
    }));
  }, [feedbackPayload]);

  const services = observabilityPayload?.services || [];
  const actionItems = [
    {
      id: "action-feedback",
      due: "Agora",
      title: `${feedbackPayload?.meta?.highPriorityCount || 0} ticket(s) de alta prioridade`,
      owner: "Suporte",
      tone: (feedbackPayload?.meta?.highPriorityCount || 0) > 0 ? "warning" : "success",
    },
    {
      id: "action-blocked-users",
      due: "Hoje",
      title: `${usersPayload?.summary?.blockedCount || 0} conta(s) suspensa(s)`,
      owner: "Risco",
      tone: (usersPayload?.summary?.blockedCount || 0) > 0 ? "warning" : "success",
    },
    {
      id: "action-integrations",
      due: "Hoje",
      title: `${integrationPayload?.summary?.find((item) => item.id === "integration-issues")?.value || 0} pendencia(s) em integracoes`,
      owner: "Integracoes",
      tone:
        Number(
          integrationPayload?.summary?.find((item) => item.id === "integration-issues")
            ?.value || 0
        ) > 0
          ? "warning"
          : "success",
    },
  ];

  const incidents = observabilityPayload?.incidents || [];
  const recentErrors = observabilityPayload?.routeFailures || [];
  const integrations = integrationPayload?.marketplaces || [];

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
            <strong>{import.meta.env.MODE || "production"}</strong>
          </div>
          <div className="admin-overview-chip">
            <span>Ultima atualizacao</span>
            <strong>{formatDateTime(generatedAt)}</strong>
          </div>
        </div>
      </header>

      {overviewError ? <div className="admin-inline-note">{overviewError}</div> : null}

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
            {services.map((service) => (
              <article key={service.id} className="admin-service-card">
                <div className="admin-service-top">
                  <strong>{service.name}</strong>
                  <span className={`admin-status-badge ${getStatusToneClass("success")}`}>
                    Estavel
                  </span>
                </div>
                <div className="admin-service-metrics">
                  <div>
                    <span>Latencia</span>
                    <strong>{service.latency}</strong>
                  </div>
                  <div>
                    <span>Erro</span>
                    <strong>{service.errorRate}</strong>
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
            {actionItems.map((action) => (
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
            {incidents.map((incident) => (
              <article key={incident.id} className="admin-feed-card">
                <div className="admin-feed-topline">
                  <span className={`admin-status-badge ${getStatusToneClass(incident.severity)}`}>
                    {incident.severity === "warning" ? "Atencao" : "Estavel"}
                  </span>
                  <small>{formatDateTime(incident.openedAt)}</small>
                </div>
                <strong>{incident.title}</strong>
                <p>Monitorado pelo time interno</p>
                <div className="admin-feed-meta">
                  <span>{incident.id}</span>
                  <span>Operacao interna</span>
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
            {recentErrors.map((item) => (
              <article key={item.id} className="admin-error-card">
                <div className="admin-feed-topline">
                  <span className="admin-status-badge is-warning">
                    {item.failures} ocorrencias
                  </span>
                  <small>{item.latencyP95}</small>
                </div>
                <strong>{item.route}</strong>
                <p>Owner: {item.owner}</p>
                <div className="admin-feed-meta">
                  <span>{item.id}</span>
                  <span>route-monitor</span>
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
            {integrations.map((integration) => (
              <article key={integration.id} className="admin-integration-card">
                <div className="admin-service-top">
                  <strong>{integration.name}</strong>
                  <span
                    className={`admin-status-badge ${getStatusToneClass(
                      integration.status
                    )}`}
                  >
                    {integration.status === "success" ? "Estavel" : "Atencao"}
                  </span>
                </div>
                <div className="admin-integration-metrics">
                  <span>{integration.accountsWithIssues} conta(s) com problema</span>
                  <span>{integration.tokenExpiring} token(s) expirando</span>
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