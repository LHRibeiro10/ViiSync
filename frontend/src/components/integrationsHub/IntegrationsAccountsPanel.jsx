import { formatDateTime } from "../../utils/presentation";

function IntegrationsAccountsPanel({
  accountsWithSignals,
  actionLoading,
  onReconnect,
  onSyncAll,
  onDisconnect,
}) {
  return (
    <section className="panel integrations-accounts-panel">
      <div className="integrations-panel-header">
        <div>
          <h2>Contas conectadas</h2>
          <p>Visibilidade de seguranca, token e sincronizacao por conta conectada.</p>
        </div>
      </div>

      <div className="integrations-account-list">
        {accountsWithSignals.length ? (
          accountsWithSignals.map((account) => (
            <article
              key={account.id}
              className={`integrations-account-card is-${account.operationalSignals.tone}`}
            >
              <div className="integrations-account-top">
                <div>
                  <strong>{account.name}</strong>
                  <p>{account.marketplace}</p>
                </div>
                <span
                  className={`integrations-badge is-${
                    account.reconnectRecommended ? "warning" : "success"
                  }`}
                >
                  {account.status}
                </span>
              </div>

              <div className="integrations-account-signals">
                {account.operationalSignals.chips.map((chip) => (
                  <span
                    key={`${account.id}-${chip.id}`}
                    className={`integrations-account-signal is-${chip.tone}`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>

              <div className="integrations-account-grid">
                <div>
                  <span>Ultima sincronizacao</span>
                  <strong>{formatDateTime(account.lastSyncAt)}</strong>
                </div>
                <div>
                  <span>Status da sync</span>
                  <strong
                    className={`integrations-metric-value is-${
                      account.operationalSignals.flags.syncWithError
                        ? "critical"
                        : "neutral"
                    }`}
                  >
                    {account.syncStatusLabel || "Aguardando"}
                  </strong>
                </div>
                <div>
                  <span>Fila</span>
                  <strong
                    className={`integrations-metric-value is-${
                      account.operationalSignals.flags.queueHigh
                        ? "critical"
                        : account.operationalSignals.flags.queuePending
                          ? "attention"
                          : "neutral"
                    }`}
                  >
                    {account.queueBacklog} evento(s)
                  </strong>
                </div>
                <div>
                  <span>Token</span>
                  <strong
                    className={`integrations-metric-value is-${
                      account.operationalSignals.flags.reconnectRecommended ||
                      account.operationalSignals.flags.tokenExpired
                        ? "critical"
                        : account.operationalSignals.flags.tokenExpiringSoon
                          ? "attention"
                          : "neutral"
                    }`}
                  >
                    {account.tokenStatus}
                  </strong>
                </div>
              </div>

              <p className="integrations-account-note">{account.note}</p>
              <p className="integrations-account-next-step">
                <strong>Proximo passo:</strong> {account.operationalSignals.nextStep}
              </p>
              {account.syncLastError ? (
                <p className="integrations-account-error">
                  Ultimo erro: {account.syncLastError}
                </p>
              ) : null}

              <div className="integrations-account-actions">
                <button
                  type="button"
                  className="integrations-primary-button"
                  onClick={() => onReconnect(account.name)}
                  disabled={actionLoading}
                >
                  {account.reconnectRecommended ? "Reconectar" : "Reautorizar"}
                </button>
                <button
                  type="button"
                  className="integrations-secondary-button"
                  onClick={onSyncAll}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processando..." : "Sincronizar agora"}
                </button>
                <button
                  type="button"
                  className="integrations-text-button"
                  onClick={onDisconnect}
                  disabled={actionLoading}
                >
                  Desconectar conta
                </button>
              </div>
            </article>
          ))
        ) : (
          <article className="integrations-account-card">
            <div className="integrations-account-top">
              <div>
                <strong>Nenhuma conta conectada</strong>
                <p>Mercado Livre</p>
              </div>
              <span className="integrations-badge is-warning">Pendente</span>
            </div>

            <p>
              Conecte sua conta do Mercado Livre para sincronizar perguntas, pedidos,
              produtos e relatorios por canal.
            </p>

            <div className="integrations-account-actions">
              <button
                type="button"
                className="integrations-primary-button"
                onClick={() => onReconnect("Conta principal ML")}
                disabled={actionLoading}
              >
                Conectar conta Mercado Livre
              </button>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

export default IntegrationsAccountsPanel;
