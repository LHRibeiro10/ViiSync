import { NavLink, Outlet } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import "./AuthLayout.css";

const authHighlights = [
  {
    title: "Operacao unificada",
    description:
      "Pedidos, produtos, atendimento e indicadores em um unico ambiente de gestao.",
  },
  {
    title: "Visao financeira clara",
    description:
      "Acompanhe receita, custos e margem com foco em decisao e previsibilidade.",
  },
  {
    title: "Estrutura profissional",
    description:
      "Fluxos organizados para seller e administracao, com base preparada para evolucao.",
  },
];

const authStats = [
  { label: "Ambiente seguro", value: "Acesso protegido" },
  { label: "Visao operacional", value: "Gestao centralizada" },
  { label: "Controle de contas", value: "Governanca ativa" },
];

function AuthLayout() {
  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <div className="auth-hero-topline">
          <span className="auth-hero-pill">Plataforma ViiSync</span>
          <span className="auth-hero-link">Acesso corporativo</span>
        </div>

        <div className="auth-hero-logo-box">
          <BrandLogo showText={false} large />
        </div>

        <div className="auth-hero-copy">
          <h1>Gestao profissional para sellers em um unico painel.</h1>
          <p>
            Acesse sua conta para acompanhar operacao, desempenho e indicadores
            essenciais com consistencia e seguranca.
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
