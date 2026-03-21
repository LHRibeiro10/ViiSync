import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import AssistantPanel from "./AssistantPanel";
import SellerOnboardingGuide from "./SellerOnboardingGuide";
import { useAuthSession } from "../contexts/useAuthSession";

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M18 6 6 18M6 6l12 12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

const primaryNavigationItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/pedidos", label: "Pedidos" },
  { to: "/produtos", label: "Produtos" },
  { to: "/financeiro", label: "Financeiro" },
  { to: "/mercado-livre/perguntas", label: "Perguntas ML" },
  { to: "/relatorios", label: "Relatorios" },
  { to: "/usuario", label: "Usuario" },
  { to: "/configuracoes", label: "Configuracoes" },
];

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const { user, clearSession } = useAuthSession();
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const visibleNavigationItems = useMemo(() => {
    if (!isAdmin) {
      return primaryNavigationItems;
    }

    return [...primaryNavigationItems, { to: "/admin", label: "Admin" }];
  }, [isAdmin]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 921px)");

    function handleChange(event) {
      if (event.matches) {
        setIsSidebarOpen(false);
      }
    }

    mediaQuery.addEventListener?.("change", handleChange);

    return () => {
      mediaQuery.removeEventListener?.("change", handleChange);
    };
  }, []);

  function handleSidebarNavigation() {
    setIsSidebarOpen(false);
  }

  async function handleLogout() {
    await clearSession();
    setIsSidebarOpen(false);
    navigate("/login", { replace: true });
  }

  return (
    <div className={`page ${isSidebarOpen ? "sidebar-open" : ""}`}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Fechar menu"
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside className="sidebar" id="app-sidebar">
        <div className="sidebar-body">
          <div className="sidebar-top">
            <div className="logo-box">
              <BrandLogo showText={false} large />
            </div>

            <button
              type="button"
              className="sidebar-close-button"
              aria-label="Fechar menu"
              onClick={() => setIsSidebarOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="sidebar-nav-stack">
            <div className="sidebar-nav-group">
              <span className="sidebar-section-label">Operacao</span>

              <nav className="menu">
                {visibleNavigationItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={handleSidebarNavigation}
                    className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="sidebar-session-actions">
              <button
                type="button"
                className="sidebar-logout-button"
                onClick={handleLogout}
              >
                Encerrar sessao
              </button>
            </div>
          </div>
        </div>

      </aside>

      <main className="content">
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-expanded={isSidebarOpen}
            aria-controls="app-sidebar"
            onClick={() => setIsSidebarOpen(true)}
          >
            <MenuIcon />
            <span>Menu</span>
          </button>
        </div>

        <div
          className="page-transition-shell"
        >
          <div key={location.pathname} className="page-transition-view">
            {outlet}
          </div>
        </div>

        <SellerOnboardingGuide />
        <AssistantPanel currentPathname={location.pathname} />
      </main>
    </div>
  );
}

export default AppLayout;
