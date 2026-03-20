import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useOutlet } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import AssistantPanel from "./AssistantPanel";
import SellerOnboardingGuide from "./SellerOnboardingGuide";

const PAGE_TRANSITION_DURATION_MS = 220;
const PAGE_TRANSITION_EXIT_MS = 110;

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
  { to: "/configuracoes", label: "Configuracoes" },
];

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const outlet = useOutlet();
  const [displayedOutlet, setDisplayedOutlet] = useState(outlet);
  const [displayedPathname, setDisplayedPathname] = useState(location.pathname);
  const [transitionStage, setTransitionStage] = useState("is-entering");
  const pendingOutletRef = useRef(outlet);
  const pendingPathnameRef = useRef(location.pathname);

  useEffect(() => {
    pendingOutletRef.current = outlet;
    pendingPathnameRef.current = location.pathname;
  }, [location.pathname, outlet]);

  useEffect(() => {
    const enterTimeoutId = window.setTimeout(() => {
      setTransitionStage("");
    }, PAGE_TRANSITION_DURATION_MS);

    return () => {
      window.clearTimeout(enterTimeoutId);
    };
  }, []);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

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

  useEffect(() => {
    if (location.pathname === displayedPathname) {
      return undefined;
    }

    setTransitionStage("is-exiting");

    const exitTimeoutId = window.setTimeout(() => {
      setDisplayedOutlet(pendingOutletRef.current);
      setDisplayedPathname(pendingPathnameRef.current);
      setTransitionStage("is-entering");
    }, PAGE_TRANSITION_EXIT_MS);

    const enterTimeoutId = window.setTimeout(() => {
      setTransitionStage("");
    }, PAGE_TRANSITION_EXIT_MS + PAGE_TRANSITION_DURATION_MS);

    return () => {
      window.clearTimeout(exitTimeoutId);
      window.clearTimeout(enterTimeoutId);
    };
  }, [displayedOutlet, displayedPathname, location.pathname]);

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
                {primaryNavigationItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className="plan-card">
          <div className="plan-badge">Plano atual</div>
          <h3>Plano Fundador</h3>
          <p>1 conta ativa com foco em operacao, margem e acompanhamento centralizado.</p>
          <button>Fazer upgrade</button>
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
          style={{
            "--page-transition-duration": `${PAGE_TRANSITION_DURATION_MS}ms`,
            "--page-transition-exit-duration": `${PAGE_TRANSITION_EXIT_MS}ms`,
          }}
        >
          <div
            key={displayedPathname}
            className={`page-transition-view ${transitionStage}`.trim()}
          >
            {displayedOutlet}
          </div>
        </div>

        <SellerOnboardingGuide />
        <AssistantPanel currentPathname={location.pathname} />
      </main>
    </div>
  );
}

export default AppLayout;
