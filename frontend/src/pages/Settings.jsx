import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSettings } from "../services/api";
import PageHeader from "../components/PageHeader";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import { useAuthSession } from "../contexts/useAuthSession";
import { useTheme } from "../contexts/useTheme";
import { startSellerOnboardingGuide } from "../utils/sellerOnboardingGuide";
import { PRESET_PERIOD_KEYS } from "../utils/period";
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

function getTwoFactorMeta(twoFactorValue) {
  const normalized = String(twoFactorValue || "").trim().toLowerCase();

  if (normalized.includes("ativado") || normalized.includes("enabled")) {
    return {
      label: "Ativado",
      tone: "positive",
      guidance: "Protecao reforcada para acesso da conta.",
    };
  }

  return {
    label: twoFactorValue || "Desativado",
    tone: "warning",
    guidance: "Ative 2FA quando o recurso estiver disponivel para elevar seguranca.",
  };
}

function getSecurityStatusTone(statusLabel) {
  if (statusLabel === "Ativa") {
    return "positive";
  }

  if (statusLabel === "Suspensa") {
    return "danger";
  }

  return "warning";
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
  const selectedPresetPeriod = PRESET_PERIOD_KEYS.includes(selectedPeriod)
    ? selectedPeriod
    : "30d";
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const twoFactorMeta = getTwoFactorMeta(data?.security?.twoFactor);
  const hasPasswordHistory = Boolean(data?.security?.lastPasswordChange);
  const hasLastAccess = Boolean(data?.security?.lastAccess);
  const lastPasswordChangeLabel = hasPasswordHistory
    ? data.security.lastPasswordChange
    : "Nao informado";
  const lastAccessLabel = hasLastAccess
    ? data.security.lastAccess
    : "Nao disponivel nesta versao";
  const securityHighlightTone =
    twoFactorMeta.tone === "positive" ? "positive" : "warning";
  const accountStatusTone = getSecurityStatusTone(statusLabel);
  const securityOperationalItems = useMemo(
    () => [
      {
        id: "password",
        title: "Alteracao de senha",
        tone: hasPasswordHistory ? "positive" : "warning",
        badge: hasPasswordHistory ? "Atualizada" : "Sem registro",
        value: hasPasswordHistory
          ? `Ultima troca em ${lastPasswordChangeLabel}`
          : "Nenhuma troca de senha registrada",
        guidance: hasPasswordHistory
          ? "Fluxo de alteracao direta de senha sera disponibilizado nesta area em evolucao futura."
          : "Quando o fluxo estiver ativo, atualize a senha para reforcar seguranca da conta.",
      },
      {
        id: "two-factor",
        title: "Verificacao em duas etapas",
        tone: twoFactorMeta.tone,
        badge: twoFactorMeta.label,
        value:
          twoFactorMeta.tone === "positive"
            ? "Camada adicional ativa para login"
            : "Recurso ainda nao habilitado nesta conta",
        guidance: twoFactorMeta.guidance,
      },
      {
        id: "last-access",
        title: "Ultimo acesso confirmado",
        tone: hasLastAccess ? "positive" : "neutral",
        badge: hasLastAccess ? "Registrado" : "Em preparo",
        value: lastAccessLabel,
        guidance: hasLastAccess
          ? "Use este dado para auditar acessos recentes."
          : "Historico de ultimo login com detalhes de origem sera exibido aqui em breve.",
      },
      {
        id: "sessions",
        title: "Sessoes e dispositivos",
        tone: "neutral",
        badge: "Planejado",
        value: "Gestao de sessoes indisponivel nesta versao",
        guidance:
          "Em versoes futuras, sera possivel revisar dispositivos ativos e encerrar sessoes remotamente.",
      },
    ],
    [
      hasLastAccess,
      hasPasswordHistory,
      lastAccessLabel,
      lastPasswordChangeLabel,
      twoFactorMeta.guidance,
      twoFactorMeta.label,
      twoFactorMeta.tone,
    ]
  );

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
        description="Central de conta para manter acesso seguro, preferencias estaveis e operacao com previsibilidade."
      />

      {feedbackMessage ? <div className="settings-success">{feedbackMessage}</div> : null}

      <div className="settings-grid">
        <section className="settings-card">
          <h2>Perfil da conta</h2>
          <p className="settings-muted">
            Informacoes principais da conta responsavel pela operacao no ViiSync.
          </p>

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
          <p className="settings-muted">
            Defina comportamentos padrao para manter sua rotina mais previsivel no dia a dia.
          </p>

          <div className="settings-field">
            <label>Tema</label>
            <select
              value={theme}
              onChange={(event) => {
                setTheme(event.target.value);
                setFeedbackMessage("Tema aplicado com sucesso.");
              }}
            >
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </div>

          <div className="settings-field">
            <label>Periodo padrao de analise</label>
            <select
              value={selectedPresetPeriod}
              onChange={(event) => {
                setSelectedPeriod(event.target.value);
                setFeedbackMessage("Periodo padrao definido.");
              }}
            >
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="90d">90 dias</option>
              <option value="1y">1 ano</option>
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
                  enabled
                    ? "Notificacoes no navegador ativadas."
                    : "Notificacoes no navegador desativadas."
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
          <p className="settings-muted">
            Acompanhe postura de seguranca e disponibilidade dos controles de acesso.
          </p>

          <div className={`settings-security-highlight is-${securityHighlightTone}`}>
            <strong>
              {securityHighlightTone === "positive"
                ? "Conta com camada adicional de protecao ativa"
                : "Conta com pontos de seguranca a evoluir"}
            </strong>
            <p>{twoFactorMeta.guidance}</p>
          </div>

          <div className="settings-info-row">
            <span>Perfil</span>
            <strong>{roleLabel}</strong>
          </div>

          <div className="settings-info-row">
            <span>Status da conta</span>
            <strong className={`settings-value-${accountStatusTone}`}>{statusLabel}</strong>
          </div>

          <div className="settings-security-grid">
            {securityOperationalItems.map((item) => (
              <article key={item.id} className={`settings-security-item is-${item.tone}`}>
                <div className="settings-security-item-head">
                  <h3>{item.title}</h3>
                  <span className={`settings-status-badge is-${item.tone}`}>
                    {item.badge}
                  </span>
                </div>
                <strong className="settings-security-item-value">{item.value}</strong>
                <p>{item.guidance}</p>
              </article>
            ))}
          </div>

          <div className="settings-actions">
            <button className="secondary is-muted" type="button" disabled>
              Alterar senha (em breve)
            </button>
            <button className="secondary" type="button" onClick={handleLogout}>
              Encerrar sessao atual
            </button>
          </div>
        </section>

        <section className="settings-card">
          <h2>Area do usuario</h2>
          <p className="settings-muted">
            Atalhos rapidos para as rotinas que exigem resposta operacional.
          </p>

          <div className="settings-shortcuts-grid">
            <Link to="/usuario?tab=integracoes" className="settings-shortcut-card">
              <span className="settings-shortcut-tag">Conta conectada</span>
              <strong>Integracoes</strong>
              <p>Monitore token, sincronizacao pendente e eventos recentes.</p>
              <span className="settings-shortcut-step">
                Proximo passo: revisar pendencias antes da proxima sincronizacao.
              </span>
            </Link>
            <Link to="/usuario?tab=feedback" className="settings-shortcut-card">
              <span className="settings-shortcut-tag">Canal oficial</span>
              <strong>Feedback oficial</strong>
              <p>Reporte bugs, sugestoes e acompanhe retorno do time.</p>
              <span className="settings-shortcut-step">
                Proximo passo: registrar contexto objetivo para acelerar analise.
              </span>
            </Link>
          </div>

          {isAdmin ? (
            <div className="settings-shortcuts-grid settings-shortcuts-grid-single">
              <Link to="/admin/reclamacoes" className="settings-shortcut-card">
                <span className="settings-shortcut-tag">Operacao admin</span>
                <strong>Inbox admin</strong>
                <p>Acompanhe demandas abertas por sellers e priorize retornos.</p>
                <span className="settings-shortcut-step">
                  Proximo passo: tratar itens criticos com maior impacto operacional.
                </span>
              </Link>
            </div>
          ) : null}
        </section>

        <section className="settings-card">
          <h2>Ajuda inicial</h2>
          <p className="settings-muted">
            Reative o guia de onboarding para revisar fluxos-chave com novos operadores.
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
