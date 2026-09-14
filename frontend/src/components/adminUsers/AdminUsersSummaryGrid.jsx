import { formatCurrency, formatInteger } from "../../utils/presentation";

function AdminUsersSummaryGrid({ summary }) {
  return (
    <section className="admin-users-summary-grid">
      <article className="admin-users-summary-card">
        <span>Sellers pagantes</span>
        <strong>{formatInteger(summary?.paidCount || 0)}</strong>
      </article>
      <article className="admin-users-summary-card">
        <span>Usuarios bloqueados</span>
        <strong>{formatInteger(summary?.blockedCount || 0)}</strong>
      </article>
      <article className="admin-users-summary-card">
        <span>Onboarding travado</span>
        <strong>{formatInteger(summary?.onboardingBlockedCount || 0)}</strong>
      </article>
      <article className="admin-users-summary-card">
        <span>MRR total</span>
        <strong>{formatCurrency(summary?.mrrTotal || 0)}</strong>
      </article>
    </section>
  );
}

export default AdminUsersSummaryGrid;
