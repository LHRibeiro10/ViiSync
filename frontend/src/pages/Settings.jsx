import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSettings } from "../services/api";
import PageHeader from "../components/PageHeader";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import { useAuthSession } from "../contexts/useAuthSession";
import { useTheme } from "../contexts/useTheme";
import { startSellerOnboardingGuide } from "../utils/sellerOnboardingGuide";
import "./Settings.css";

const NOTIFICATIONS_STORAGE_KEY = "viisync-notifications-enabled";

function resolveStoredNotifications() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) !== "false";
}

function formatRole(role) {
  const normalized = String(role || "").toUpperCase();

  if (normalized === "ADMIN") {
    return "Administrador";
  }

  if (normalized === "SUPPORT") {
    return "Suporte";
  }

  return "Seller";
}

function formatStatus(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "ACTIVE") {
    return "Ativa";
  }

  if (normalized === "SUSPENDED") {
    return "Suspensa";
  }

  return "Pendente";
}

function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, clearSession } = useAuthSession();
  const { selectedPeriod, setSelectedPeriod } = useAnalyticsPeriod();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    resolveStoredNotifications
  );

  useEffect(() => {
    async function loadSettings() {
      try {
        const result = await getSettings();
        setData(result);
      } catch {
        setError("Nao foi possivel carregar as configuracoes.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      notificationsEnabled ? "true" : "false"
    );
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!feedbackMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setFeedbackMessage(""), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [feedbackMessage]);

  const roleLabel = useMemo(() => formatRole(user?.role), [user?.role]);
  const statusLabel = useMemo(() => formatStatus(user?.status), [user?.status]);
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";

  function handleRestartTutorial() {
    startSellerOnboardingGuide();
    navigate("/");
  }

  async function handleLogout() {
    await clearSession();
    navigate("/login", { replace: true });
  }

  if (loading) return <div className="screen-message">Carregando configuracoes...</div>;
  if (error) return <div className="screen-message">{error}</div>;
  if (!data) return <div className="screen-message">Dados invalidos.</div>;

  return (
    <div className="settings-page">
      <PageHeader
        tag="Conta"
        title="Configuracoes"
        description="Gerencie preferencias reais da sua conta e acesse rapidamente integracoes e chamados."
      />

      {feedbackMessage ? <div className="settings-success">{feedbackMessage}</div> : null}

      <div className="settings-grid">
        <section className="settings-card">
          <h2>Perfil da conta</h2>

          <div className="settings-info-row">
            <span>Nome</span>
            <strong>{data.profile.name}</strong>
          </div>

          <div className="settings-info-row">
            <span>E-mail</span>
            <strong>{data.profile.email}</strong>
          </div>

          <div className="settings-info-row">
            <span>Empresa</span>
            <strong>{data.profile.company}</strong>
          </div>
        </section>

        <section className="settings-card">
          <h2>Preferencias</h2>

          <div className="settings-field">
            <label>Tema</label>
            <select
              value={theme}
              onChange={(event) => {
                setTheme(event.target.value);
                setFeedbackMessage("Tema atualizado.");
              }}
            >
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </div>

          <div className="settings-field">
            <label>Periodo padrao de analise</label>
            <select
              value={selectedPeriod}
              onChange={(event) => {
                setSelectedPeriod(event.target.value);
                setFeedbackMessage("Periodo padrao atualizado.");
              }}
            >
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="90d">90 dias</option>
            </select>
          </div>

          <div className="settings-field">
            <label>Notificacoes no navegador</label>
            <select
              value={notificationsEnabled ? "enabled" : "disabled"}
              onChange={(event) => {
                const enabled = event.target.value === "enabled";
                setNotificationsEnabled(enabled);
                setFeedbackMessage(
                  enabled ? "Notificacoes ativadas." : "Notificacoes desativadas."
                );
              }}
            >
              <option value="enabled">Ativadas</option>
              <option value="disabled">Desativadas</option>
            </select>
          </div>
        </section>

        <section className="settings-card">
          <h2>Seguranca e acesso</h2>

          <div className="settings-info-row">
            <span>Perfil</span>
            <strong>{roleLabel}</strong>
          </div>

          <div className="settings-info-row">
            <span>Status da conta</span>
            <strong>{statusLabel}</strong>
          </div>

          <div className="settings-info-row">
            <span>Ultima troca de senha</span>
            <strong>{data.security.lastPasswordChange || "Nao informado"}</strong>
          </div>

          <div className="settings-info-row">
            <span>2FA</span>
            <strong>{data.security.twoFactor}</strong>
          </div>

          <div className="settings-actions">
            <button className="secondary" type="button" onClick={handleLogout}>
              Sair da conta
            </button>
          </div>
        </section>

        <section className="settings-card">
          <h2>Area do usuario</h2>
          <p className="settings-muted">
            Central de operacao para conectar o Mercado Livre e abrir chamados com o
            time de suporte/produto.
          </p>

          <div className="settings-actions">
            <Link to="/usuario?tab=integracoes" className="settings-inline-link">
              Abrir integracoes
            </Link>
            <Link to="/usuario?tab=feedback" className="settings-inline-link">
              Abrir feedback
            </Link>
          </div>

          {isAdmin ? (
            <div className="settings-actions settings-actions-single">
              <Link to="/admin/reclamacoes" className="settings-inline-link">
                Abrir inbox admin
              </Link>
            </div>
          ) : null}
        </section>

        <section className="settings-card">
          <h2>Ajuda inicial</h2>
          <p className="settings-muted">
            Reinicie o tutorial guiado caso queira rever os passos principais do ViiSync.
          </p>

          <div className="settings-actions settings-actions-single">
            <button className="primary" type="button" onClick={handleRestartTutorial}>
              Ver tutorial novamente
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
