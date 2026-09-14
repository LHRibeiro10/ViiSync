function DashboardStatusBanners({ error, integrationFeedback, mercadoLivreStatus }) {
  return (
    <>
      {error ? <div className="dashboard-inline-error">{error}</div> : null}
      {integrationFeedback ? (
        <div
          className={
            integrationFeedback.tone === "error"
              ? "dashboard-inline-error"
              : "dashboard-inline-success"
          }
        >
          {integrationFeedback.message}
        </div>
      ) : null}
      {mercadoLivreStatus?.sync ? (
        <div className="dashboard-sync-status">
          <strong>Status da sincronizacao:</strong>{" "}
          {mercadoLivreStatus.sync.statusLabel || "Aguardando"}
          {mercadoLivreStatus.sync.lastSyncedAt
            ? ` | Ultima sincronizacao em ${new Intl.DateTimeFormat("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(mercadoLivreStatus.sync.lastSyncedAt))}`
            : ""}
        </div>
      ) : null}
    </>
  );
}

export default DashboardStatusBanners;
