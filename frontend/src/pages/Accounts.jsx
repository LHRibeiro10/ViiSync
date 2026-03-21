import { useEffect, useState } from "react";
import { getAccounts } from "../services/api";
import "./Accounts.css";

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    async function loadAccounts() {
      try {
        const result = await getAccounts();
        setAccounts(result);
      } catch {
        setError("Não foi possível carregar as contas.");
      } finally {
        setLoading(false);
      }
    }

    loadAccounts();
  }, []);

  function handleAccountAction(message) {
    setActionMessage(message);
    setTimeout(() => setActionMessage(""), 2000);
  }

  if (loading) return <div className="screen-message">Carregando contas...</div>;
  if (error) return <div className="screen-message">{error}</div>;

  return (
    <div className="accounts-page">
      <div className="accounts-header">
        <div>
          <span className="tag">Integrações</span>
          <h1>Contas conectadas</h1>
          <p>Gerencie as contas vinculadas e acompanhe o status de sincronização.</p>
        </div>

        <button
          className="accounts-primary-button"
          onClick={() => setShowModal(true)}
        >
          Adicionar conta
        </button>
      </div>

      {actionMessage ? (
        <div className="accounts-feedback">{actionMessage}</div>
      ) : null}

      <div className="accounts-grid">
        {accounts.map((account) => (
          <div key={account.id} className="account-card">
            <div className="account-card-top">
              <div>
                <h2>{account.name}</h2>
                <p>{account.marketplace}</p>
              </div>

              <span
                className={`account-status ${
                  account.status === "Conectada" ? "connected" : "pending"
                }`}
              >
                {account.status}
              </span>
            </div>

            <div className="account-info">
              <div className="account-info-row">
                <span>Última sincronização</span>
                <strong>{account.lastSync}</strong>
              </div>

              <div className="account-info-row">
                <span>Pedidos sincronizados</span>
                <strong>{account.orders}</strong>
              </div>
            </div>

            <div className="account-actions">
              <button
                className="secondary"
                onClick={() =>
                  handleAccountAction(`Sincronização iniciada para ${account.name}`)
                }
              >
                Sincronizar
              </button>

              <button
                className="ghost"
                onClick={() =>
                  handleAccountAction(`Abrindo configurações de ${account.name}`)
                }
              >
                Configurar
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div
          className="accounts-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="accounts-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Adicionar conta</h2>
            <p>Escolha o marketplace que deseja conectar.</p>

            <div className="accounts-modal-actions">
              <button
                className="secondary"
                onClick={() => {
                  setShowModal(false);
                  handleAccountAction("Fluxo de conexão com Mercado Livre em breve.");
                }}
              >
                Mercado Livre
              </button>

              <button
                className="secondary"
                onClick={() => {
                  setShowModal(false);
                  handleAccountAction("Fluxo de conexão com Shopee em breve.");
                }}
              >
                Shopee
              </button>
            </div>

            <button
              className="ghost close-button"
              onClick={() => setShowModal(false)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Accounts;
