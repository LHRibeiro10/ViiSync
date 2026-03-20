import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSettings } from "../services/api";
import PageHeader from "../components/PageHeader";
import { startSellerOnboardingGuide } from "../components/SellerOnboardingGuide";
import { useTheme } from "../contexts/ThemeContext";
import "./Settings.css";

function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [selectedTheme, setSelectedTheme] = useState(theme);

  useEffect(() => {
    async function loadSettings() {
      try {
        const result = await getSettings();
        setData(result);
      } catch (err) {
        setError("Nao foi possivel carregar as configuracoes.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  async function handleSave() {
    try {
      setSaving(true);
      setSavedMessage("");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSavedMessage("Alteracoes salvas com sucesso.");
    } finally {
      setSaving(false);
    }
  }

  function handleRestartTutorial() {
    startSellerOnboardingGuide();
    navigate("/");
  }

  if (loading) return <div className="screen-message">Carregando configuracoes...</div>;
  if (error) return <div className="screen-message">{error}</div>;
  if (!data) return <div className="screen-message">Dados invalidos.</div>;

  return (
    <div className="settings-page">
      <PageHeader
        tag="Conta"
        title="Configuracoes"
        description="Gerencie dados da conta, preferencias e seguranca."
      >
        <button onClick={handleSave}>
          {saving ? "Salvando..." : "Salvar alteracoes"}
        </button>
      </PageHeader>

      {savedMessage ? <div className="settings-success">{savedMessage}</div> : null}

      <div className="settings-grid">
        <section className="settings-card">
          <h2>Perfil</h2>

          <div className="settings-field">
            <label>Nome</label>
            <input type="text" defaultValue={data.profile.name} />
          </div>

          <div className="settings-field">
            <label>E-mail</label>
            <input type="email" defaultValue={data.profile.email} />
          </div>

          <div className="settings-field">
            <label>Empresa</label>
            <input type="text" defaultValue={data.profile.company} />
          </div>
        </section>

        <section className="settings-card">
          <h2>Preferencias</h2>

          <div className="settings-field">
            <label>Tema</label>
            <select
              value={selectedTheme}
              onChange={(event) => {
                const nextTheme = event.target.value;
                setSelectedTheme(nextTheme);
                setTheme(nextTheme);
              }}
            >
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </div>

          <div className="settings-field">
            <label>Periodo padrao</label>
            <select defaultValue={data.preferences.periodDefault}>
              <option>7 dias</option>
              <option>30 dias</option>
              <option>90 dias</option>
            </select>
          </div>

          <div className="settings-field">
            <label>Notificacoes</label>
            <select defaultValue={data.preferences.notifications}>
              <option>Ativadas</option>
              <option>Desativadas</option>
            </select>
          </div>
        </section>

        <section className="settings-card">
          <h2>Seguranca</h2>

          <div className="settings-info-row">
            <span>Ultima troca de senha</span>
            <strong>{data.security.lastPasswordChange}</strong>
          </div>

          <div className="settings-info-row">
            <span>2FA</span>
            <strong>{data.security.twoFactor}</strong>
          </div>

          <div className="settings-actions">
            <button className="primary">Alterar senha</button>
            <button className="secondary">Ativar 2FA</button>
          </div>
        </section>

        <section className="settings-card">
          <h2>Ajuda inicial</h2>
          <p className="settings-muted">
            Se quiser rever a exploracao guiada do ViiSync, reinicie o tutorial e
            o sistema vai voltar ao passo inicial do onboarding.
          </p>

          <div className="settings-actions settings-actions-single">
            <button className="primary" onClick={handleRestartTutorial}>
              Ver tutorial novamente
            </button>
          </div>
        </section>

        <section className="settings-card">
          <h2>Integracoes futuras</h2>
          <p className="settings-muted">
            Aqui vamos centralizar configuracoes de Mercado Livre, Shopee, emissao
            de notas e billing.
          </p>

          <Link to="/integracoes" className="settings-inline-link">
            Abrir hub de integracoes
          </Link>

          <div className="settings-placeholder">
            <div>
              <strong>Mercado Livre</strong>
              <p>Em breve</p>
            </div>
          </div>

          <div className="settings-placeholder">
            <div>
              <strong>Shopee</strong>
              <p>Em breve</p>
            </div>
          </div>

          <div className="settings-placeholder">
            <div>
              <strong>Emissao fiscal</strong>
              <p>Em breve</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
