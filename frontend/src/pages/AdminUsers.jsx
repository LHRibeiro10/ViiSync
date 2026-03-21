import { useEffect, useMemo, useState } from "react";
import {
  getAdminUsers,
  toggleAdminUserBlock,
} from "../services/api";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatInteger,
} from "../utils/presentation";
import "./AdminUsers.css";

const SUBSCRIPTION_LABELS = {
  paid: "Pago",
  trial: "Trial",
  overdue: "Atrasado",
};

const ONBOARDING_LABELS = {
  done: "Concluido",
  in_progress: "Em andamento",
  blocked: "Travado",
};

const CHURN_LABELS = {
  low: "Baixo risco",
  medium: "Risco medio",
  high: "Alto risco",
};

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSubscriptionTone(status) {
  if (status === "paid") {
    return "success";
  }

  if (status === "trial") {
    return "neutral";
  }

  return "danger";
}

function getRiskTone(risk) {
  if (risk === "high") {
    return "danger";
  }

  if (risk === "medium") {
    return "warning";
  }

  return "success";
}

function getOnboardingTone(status) {
  if (status === "blocked") {
    return "danger";
  }

  if (status === "in_progress") {
    return "warning";
  }

  return "success";
}

function matchesFilters(user, filters) {
  if (filters.subscription !== "all" && user.subscriptionStatus !== filters.subscription) {
    return false;
  }

  if (filters.blockStatus === "blocked" && !user.isBlocked) {
    return false;
  }

  if (filters.blockStatus === "active" && user.isBlocked) {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const haystack = [
    user.name,
    user.company,
    user.email,
    user.plan,
    SUBSCRIPTION_LABELS[user.subscriptionStatus],
  ]
    .filter(Boolean)
    .map(normalizeText)
    .join(" ");

  return haystack.includes(normalizeText(filters.search));
}

function AdminUsers() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    subscription: "all",
    blockStatus: "all",
  });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
  const [blockReason, setBlockReason] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadUsers() {
      try {
        setError("");
        setLoading(true);
        const response = await getAdminUsers();

        if (!isCancelled) {
          setPayload(response);
        }
      } catch {
        if (!isCancelled) {
          setError("Nao foi possivel carregar a gestao de usuarios.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      isCancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!payload?.items?.length) {
      return [];
    }

    return payload.items.filter((user) => matchesFilters(user, filters));
  }, [payload, filters]);

  useEffect(() => {
    if (!filteredUsers.length) {
      setSelectedUserId("");
      return;
    }

    const selectedExists = filteredUsers.some((user) => user.id === selectedUserId);

    if (!selectedExists) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId]);

  const selectedUser = useMemo(() => {
    return filteredUsers.find((user) => user.id === selectedUserId) || null;
  }, [filteredUsers, selectedUserId]);

  function handleFilterChange(event) {
    const { name, value } = event.target;

    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  async function handleToggleBlock() {
    if (!selectedUser) {
      return;
    }

    try {
      setBusyUserId(selectedUser.id);
      setActionFeedback("");

      const response = await toggleAdminUserBlock(
        selectedUser.id,
        !selectedUser.isBlocked,
        selectedUser.isBlocked ? "" : blockReason
      );

      setPayload((currentPayload) => {
        if (!currentPayload) {
          return currentPayload;
        }

        return {
          ...currentPayload,
          summary: response.summary,
          items: currentPayload.items.map((user) =>
            user.id === response.item.id ? response.item : user
          ),
        };
      });

      setActionFeedback(
        selectedUser.isBlocked
          ? "Seller desbloqueado com sucesso."
          : "Seller bloqueado com sucesso."
      );
      setBlockReason("");
    } catch {
      setActionFeedback("Nao foi possivel atualizar o status desse seller.");
    } finally {
      setBusyUserId("");
    }
  }

  if (loading && !payload) {
    return <div className="screen-message">Carregando usuarios...</div>;
  }

  return (
    <div className="admin-users-page">
      <header className="admin-users-hero">
        <div>
          <span className="admin-users-tag">Gestao de contas</span>
          <h1>Usuarios e sellers</h1>
          <p>
            Acompanhe sellers pagantes, onboarding, risco de churn e bloqueio
            administrativo a partir de um unico painel.
          </p>
        </div>
      </header>

      {error ? <div className="admin-users-inline-alert">{error}</div> : null}

      <section className="admin-users-summary-grid">
        <article className="admin-users-summary-card">
          <span>Sellers pagantes</span>
          <strong>{formatInteger(payload?.summary?.paidCount || 0)}</strong>
        </article>
        <article className="admin-users-summary-card">
          <span>Usuarios bloqueados</span>
          <strong>{formatInteger(payload?.summary?.blockedCount || 0)}</strong>
        </article>
        <article className="admin-users-summary-card">
          <span>Onboarding travado</span>
          <strong>{formatInteger(payload?.summary?.onboardingBlockedCount || 0)}</strong>
        </article>
        <article className="admin-users-summary-card">
          <span>MRR total</span>
          <strong>{formatCurrency(payload?.summary?.mrrTotal || 0)}</strong>
        </article>
      </section>

      <section className="admin-users-filter-bar">
        <input
          type="search"
          name="search"
          value={filters.search}
          onChange={handleFilterChange}
          placeholder="Buscar por seller, empresa, email ou plano"
        />

        <select
          name="subscription"
          value={filters.subscription}
          onChange={handleFilterChange}
        >
          <option value="all">Todas as assinaturas</option>
          <option value="paid">Somente pagantes</option>
          <option value="trial">Somente trial</option>
        </select>

        <select
          name="blockStatus"
          value={filters.blockStatus}
          onChange={handleFilterChange}
        >
          <option value="all">Todos os status</option>
          <option value="active">Somente ativos</option>
          <option value="blocked">Somente bloqueados</option>
        </select>
      </section>

      <div className="admin-users-grid">
        <section className="admin-users-list-panel">
          <div className="admin-users-panel-header">
            <div>
              <h2>Fila de sellers</h2>
              <p>{formatInteger(filteredUsers.length)} conta(s) no filtro atual.</p>
            </div>
          </div>

          <div className="admin-users-list">
            {filteredUsers.length ? (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`admin-users-list-item ${
                    user.id === selectedUserId ? "is-selected" : ""
                  } ${user.isBlocked ? "is-blocked" : ""}`}
                  onClick={() => {
                    setSelectedUserId(user.id);
                    setActionFeedback("");
                    setBlockReason("");
                  }}
                >
                  <div className="admin-users-list-topline">
                    <strong>{user.company}</strong>
                    <span
                      className={`admin-users-badge is-${getSubscriptionTone(
                        user.subscriptionStatus
                      )}`}
                    >
                      {SUBSCRIPTION_LABELS[user.subscriptionStatus] ||
                        user.subscriptionStatus}
                    </span>
                  </div>

                  <p>{user.name}</p>

                  <div className="admin-users-badge-row">
                    <span
                      className={`admin-users-badge is-${getRiskTone(user.churnRisk)}`}
                    >
                      {CHURN_LABELS[user.churnRisk] || user.churnRisk}
                    </span>
                    <span
                      className={`admin-users-badge is-${getOnboardingTone(
                        user.onboardingStatus
                      )}`}
                    >
                      {ONBOARDING_LABELS[user.onboardingStatus] ||
                        user.onboardingStatus}
                    </span>
                    {user.isBlocked ? (
                      <span className="admin-users-badge is-danger">Bloqueado</span>
                    ) : null}
                  </div>

                  <div className="admin-users-list-meta">
                    <span>{user.plan}</span>
                    <span>{formatInteger(user.connectedAccounts)} conta(s)</span>
                    <span>{formatCurrency(user.mrr || 0)} MRR</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="admin-users-empty-state">
                <strong>Nenhum seller encontrado.</strong>
                <p>Revise os filtros e tente novamente.</p>
              </div>
            )}
          </div>
        </section>

        <section className="admin-users-detail-panel">
          {selectedUser ? (
            <>
              <div className="admin-users-detail-header">
                <div>
                  <h2>{selectedUser.company}</h2>
                  <p>{selectedUser.name}</p>
                </div>

                <span
                  className={`admin-users-badge is-${getSubscriptionTone(
                    selectedUser.subscriptionStatus
                  )}`}
                >
                  {SUBSCRIPTION_LABELS[selectedUser.subscriptionStatus] ||
                    selectedUser.subscriptionStatus}
                </span>
              </div>

              <div className="admin-users-detail-meta">
                <div>
                  <span>Email</span>
                  <strong>{selectedUser.email}</strong>
                </div>
                <div>
                  <span>Plano</span>
                  <strong>{selectedUser.plan}</strong>
                </div>
                <div>
                  <span>Pago desde</span>
                  <strong>{formatDate(selectedUser.paidSince)}</strong>
                </div>
                <div>
                  <span>Ultima atividade</span>
                  <strong>{formatDateTime(selectedUser.lastActiveAt)}</strong>
                </div>
                <div>
                  <span>Contas conectadas</span>
                  <strong>{formatInteger(selectedUser.connectedAccounts)}</strong>
                </div>
                <div>
                  <span>MRR</span>
                  <strong>{formatCurrency(selectedUser.mrr || 0)}</strong>
                </div>
              </div>

              <div className="admin-users-status-grid">
                <article className="admin-users-status-card">
                  <span>Onboarding</span>
                  <strong>{ONBOARDING_LABELS[selectedUser.onboardingStatus]}</strong>
                </article>
                <article className="admin-users-status-card">
                  <span>Risco de churn</span>
                  <strong>{CHURN_LABELS[selectedUser.churnRisk]}</strong>
                </article>
                <article className="admin-users-status-card">
                  <span>Status da conta</span>
                  <strong>{selectedUser.isBlocked ? "Bloqueada" : "Ativa"}</strong>
                </article>
              </div>

              {selectedUser.isBlocked ? (
                <div className="admin-users-inline-note is-danger">
                  Bloqueado em {formatDateTime(selectedUser.blockedAt)}.
                  {selectedUser.blockReason ? ` Motivo: ${selectedUser.blockReason}` : ""}
                </div>
              ) : (
                <div className="admin-users-inline-note">
                  Conta ativa. Se houver necessidade operacional, voce pode bloquear o seller
                  por este painel.
                </div>
              )}

              {!selectedUser.isBlocked ? (
                <label className="admin-users-note-field">
                  <span>Motivo do bloqueio</span>
                  <textarea
                    value={blockReason}
                    onChange={(event) => setBlockReason(event.target.value)}
                    placeholder="Descreva por que esse seller esta sendo bloqueado"
                  />
                </label>
              ) : null}

              {actionFeedback ? (
                <div className="admin-users-inline-note">{actionFeedback}</div>
              ) : null}

              <div className="admin-users-actions">
                <button
                  type="button"
                  className={selectedUser.isBlocked ? "is-secondary" : "is-danger"}
                  onClick={handleToggleBlock}
                  disabled={busyUserId === selectedUser.id}
                >
                  {busyUserId === selectedUser.id
                    ? "Salvando..."
                    : selectedUser.isBlocked
                      ? "Desbloquear seller"
                      : "Bloquear seller"}
                </button>
              </div>
            </>
          ) : (
            <div className="admin-users-empty-state">
              <strong>Selecione um seller.</strong>
              <p>Os detalhes da conta aparecem aqui para decisao administrativa.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminUsers;
