function IntegrationsCriticalStrip({
  hasAccounts,
  hasCriticalRisk,
  hasAttentionRisk,
  reauthorizationCount,
  expiringSoonCount,
  queuePendingCount,
}) {
  if (!hasAccounts) {
    return null;
  }

  return (
    <section
      className={`integrations-critical-strip is-${
        hasCriticalRisk ? "critical" : hasAttentionRisk ? "attention" : "stable"
      }`}
    >
      <div>
        <h3>Controle da conta conectada</h3>
        <p>
          Priorize riscos de autenticacao e pendencias de sincronizacao para manter
          seguranca e continuidade operacional.
        </p>
      </div>

      <div className="integrations-critical-chips">
        {hasCriticalRisk || hasAttentionRisk ? (
          <>
            <span className="integrations-critical-chip is-critical">
              {reauthorizationCount} reautorizacao(oes) pendente(s)
            </span>
            <span className="integrations-critical-chip is-attention">
              {expiringSoonCount} token(s) expiram em breve
            </span>
            <span className="integrations-critical-chip is-attention">
              {queuePendingCount} evento(s) pendente(s) na fila
            </span>
          </>
        ) : (
          <span className="integrations-critical-chip is-success">
            Sem risco critico no momento
          </span>
        )}
      </div>
    </section>
  );
}

export default IntegrationsCriticalStrip;
