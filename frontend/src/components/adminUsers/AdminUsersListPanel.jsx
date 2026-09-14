import { formatCurrency, formatInteger } from "../../utils/presentation";
import {
  SUBSCRIPTION_LABELS,
  CHURN_LABELS,
  ONBOARDING_LABELS,
  getSubscriptionTone,
  getRiskTone,
  getOnboardingTone,
} from "../../utils/adminUsersInsights";

function AdminUsersListPanel({ filteredUsers, selectedUserId, onSelectUser }) {
  return (
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
              onClick={() => onSelectUser(user.id)}
            >
              <div className="admin-users-list-topline">
                <strong>{user.company}</strong>
                <span
                  className={`admin-users-badge is-${getSubscriptionTone(
                    user.subscriptionStatus
                  )}`}
                >
                  {SUBSCRIPTION_LABELS[user.subscriptionStatus] || user.subscriptionStatus}
                </span>
              </div>

              <p>{user.name}</p>

              <div className="admin-users-badge-row">
                <span className={`admin-users-badge is-${getRiskTone(user.churnRisk)}`}>
                  {CHURN_LABELS[user.churnRisk] || user.churnRisk}
                </span>
                <span
                  className={`admin-users-badge is-${getOnboardingTone(
                    user.onboardingStatus
                  )}`}
                >
                  {ONBOARDING_LABELS[user.onboardingStatus] || user.onboardingStatus}
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
  );
}

export default AdminUsersListPanel;
