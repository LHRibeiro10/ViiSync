import { formatCurrency, formatDate, formatDateTime, formatInteger } from "../../utils/presentation";
import {
  SUBSCRIPTION_LABELS,
  ONBOARDING_LABELS,
  CHURN_LABELS,
  getSubscriptionTone,
} from "../../utils/adminUsersInsights";

function AdminUsersDetailPanel({
  selectedUser,
  blockReason,
  onBlockReasonChange,
  actionFeedback,
  busyUserId,
  onToggleBlock,
}) {
  if (!selectedUser) {
    return (
      <section className="admin-users-detail-panel">
        <div className="admin-users-empty-state">
          <strong>Selecione um seller.</strong>
          <p>Os detalhes da conta aparecem aqui para decisao administrativa.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-users-detail-panel">
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
            onChange={(event) => onBlockReasonChange(event.target.value)}
            placeholder="Descreva por que esse seller esta sendo bloqueado"
          />
        </label>
      ) : null}

      {actionFeedback ? <div className="admin-users-inline-note">{actionFeedback}</div> : null}

      <div className="admin-users-actions">
        <button
          type="button"
          className={selectedUser.isBlocked ? "is-secondary" : "is-danger"}
          onClick={onToggleBlock}
          disabled={busyUserId === selectedUser.id}
        >
          {busyUserId === selectedUser.id
            ? "Salvando..."
            : selectedUser.isBlocked
              ? "Desbloquear seller"
              : "Bloquear seller"}
        </button>
      </div>
    </section>
  );
}

export default AdminUsersDetailPanel;
