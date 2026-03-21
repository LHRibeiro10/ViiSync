import { NavLink, Outlet } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import "./AuthLayout.css";

const authHighlights = [
  {
    title: "Operacao centralizada",
    description:
      "Vendas, margem, perguntas de marketplace e desempenho em um unico fluxo.",
  },
  {
    title: "Visao financeira acionavel",
    description:
      "Indicadores claros para decidir preco, custo, canal e prioridade operacional.",
  },
  {
    title: "Estrutura pronta para escalar",
    description:
      "As telas ja nascem separadas para seller, backoffice e integracoes futuras.",
  },
];

const authStats = [
  { label: "Tempo medio poupado", value: "6,4 h/sem" },
  { label: "Canais monitorados", value: "5 fontes" },
  { label: "Painel administrativo", value: "backoffice pronto" },
];

function AuthLayout() {
  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <div className="auth-hero-topline">
          <span className="auth-hero-pill">Acesso ViiSync</span>
          <span className="auth-hero-link">Ambiente seguro</span>
        </div>

        <div className="auth-hero-logo-box">
          <BrandLogo showText={false} large />
        </div>

        <div className="auth-hero-copy">
          <h1>Entre no ViiSync com uma experiencia de produto mais madura.</h1>
          <p>
            Essas telas ja separam claramente o fluxo publico de acesso do painel
            principal do seller e do backoffice administrativo.
          </p>
        </div>

        <div className="auth-hero-highlights">
          {authHighlights.map((highlight) => (
            <article key={highlight.title} className="auth-highlight-card">
              <strong>{highlight.title}</strong>
              <p>{highlight.description}</p>
            </article>
          ))}
        </div>

        <div className="auth-hero-stats">
          {authStats.map((stat) => (
            <div key={stat.label} className="auth-stat">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-switcher">
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `auth-switch-link ${isActive ? "is-active" : ""}`
            }
          >
            Entrar
          </NavLink>

          <NavLink
            to="/cadastro"
            className={({ isActive }) =>
              `auth-switch-link ${isActive ? "is-active" : ""}`
            }
          >
            Criar conta
          </NavLink>
        </div>

        <div className="auth-panel-body">
          <Outlet />
        </div>
      </section>
    </div>
  );
}

export default AuthLayout;
