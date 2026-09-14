import { formatDateTime } from "../../utils/presentation";

function IntegrationsStatusBanners({
  error,
  actionFeedback,
  isMercadoLivreConnected,
  mercadoLivreStatus,
  hasCriticalRisk,
  hasAttentionRisk,
  statusBannerTone,
  reauthorizationCount,
  expiringSoonCount,
  queuePendingCount,
}) {
  return (
    <>
      {error ? <div className="integrations-inline-alert">{error}</div> : null}
      {actionFeedback ? (
        <div
          className={
            actionFeedback.tone === "error"
              ? "integrations-inline-alert"
              : "integrations-inline-success"
          }
        >
          {actionFeedback.message}
        </div>
      ) : null}
      {isMercadoLivreConnected ? (
        <div className={`integrations-inline-${statusBannerTone}`}>
          {hasCriticalRisk
            ? `Conta conectada com risco operacional: ${reauthorizationCount} conta(s) pedem reautorizacao ou estao em estado critico.`
            : hasAttentionRisk
              ? `Conta conectada com monitoramento ativo: ${expiringSoonCount} token(s) expiram em breve e ${queuePendingCount} evento(s) aguardam processamento.`
              : "Conta Mercado Livre conectada e operacao sob controle."}{" "}
          Status da sincronizacao: {mercadoLivreStatus?.sync?.statusLabel || "Aguardando"}.
          {mercadoLivreStatus?.sync?.lastSyncedAt
            ? ` Ultima sincronizacao em ${formatDateTime(
                mercadoLivreStatus.sync.lastSyncedAt
              )}.`
            : " Sem registro recente de sincronizacao concluida."}
        </div>
      ) : mercadoLivreStatus ? (
        <div className="integrations-inline-alert">
          Conexao Mercado Livre pendente. Conecte via OAuth para sincronizar.
        </div>
      ) : null}
    </>
  );
}

export default IntegrationsStatusBanners;
