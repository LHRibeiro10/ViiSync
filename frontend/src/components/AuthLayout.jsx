import { NavLink, Outlet, useLocation } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import "./AuthLayout.css";

const authHeroContentByMode = {
  login: {
    pill: "Plataforma ViiSync",
    tagline: "Acesso corporativo",
    title: "Gestão profissional para sellers que querem escala.",
    description:
      "Centralize operação, financeiro e desempenho em um único painel, com leitura rápida e decisões mais seguras.",
  },
  register: {
    pill: "Novo ambiente",
    tagline: "Cadastro rápido",
    title: "Crie sua conta e comece com a base certa.",
    description:
      "Ative seu ambiente em minutos, conecte canais e organize sua operação desde o primeiro dia.",
  },
  forgot: {
    pill: "Recuperação de acesso",
    tagline: "Solicitação segura",
    title: "Recupere seu acesso com segurança.",
    description:
      "Informe seu e-mail e enviaremos um link de redefinição em uma página separada.",
  },
  reset: {
    pill: "Redefinição de senha",
    tagline: "Segurança da conta",
    title: "Defina uma nova senha para sua conta.",
    description:
      "Use uma senha forte para retomar o acesso com proteção e controle.",
  },
};

function resolveAuthMode(pathname) {
  const normalizedPathname = String(pathname || "").toLowerCase();

  if (normalizedPathname.startsWith("/cadastro")) {
    return "register";
  }

  if (normalizedPathname.startsWith("/forgot-password")) {
    return "forgot";
  }

  if (normalizedPathname.startsWith("/reset-password")) {
    return "reset";
  }

  if (normalizedPathname.startsWith("/redefinir-senha")) {
    return "reset";
  }

  return "login";
}

function AuthLayout() {
  const location = useLocation();
  const authMode = resolveAuthMode(location.pathname);
  const heroContent = authHeroContentByMode[authMode] || authHeroContentByMode.login;
  const shouldSwapSides = authMode === "register";

  return (
    <div
      className={`auth-shell ${shouldSwapSides ? "is-register-mode" : ""} auth-mode-${authMode}`}
    >
      <section className="auth-hero">
        <div className="auth-hero-topline">
          <span className="auth-hero-pill">{heroContent.pill}</span>
          <span className="auth-hero-link">{heroContent.tagline}</span>
        </div>

        <div className="auth-hero-logo">
          <BrandLogo showText={false} large />
        </div>

        <div className="auth-hero-copy">
          <h1>{heroContent.title}</h1>
          <p>{heroContent.description}</p>
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
            Cadastrar
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
