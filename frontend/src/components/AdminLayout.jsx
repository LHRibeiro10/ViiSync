import { NavLink, Outlet } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import "./AdminLayout.css";

const adminSections = [
  { label: "Visao geral", to: "/admin", end: true, available: true },
  { label: "Reclamacoes", to: "/admin/reclamacoes", available: true },
  { label: "Observabilidade", to: "/admin/observabilidade", available: true },
  { label: "Usuarios", to: "/admin/usuarios", available: true },
  { label: "Integracoes", available: false },
];

function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-content">
          <div className="admin-sidebar-top">
            <span className="admin-sidebar-badge">Backoffice</span>
            <BrandLogo subtitle="Console administrativo" compact />
          </div>

          <nav className="admin-sidebar-nav">
            {adminSections.map((section) => (
              section.available ? (
                <NavLink
                  key={section.label}
                  to={section.to}
                  end={section.end}
                  className={({ isActive }) =>
                    `admin-sidebar-link ${isActive ? "is-active" : ""}`
                  }
                >
                  {section.label}
                </NavLink>
              ) : (
                <span key={section.label} className="admin-sidebar-link is-muted">
                  {section.label}
                  <small>em breve</small>
                </span>
              )
            ))}
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <span className="admin-sidebar-footnote">Acesso interno</span>
          <p>
            Ambiente separado para monitorar estabilidade, reclamacoes e eventos
            criticos do produto.
          </p>
          <NavLink to="/" className="admin-sidebar-return">
            Voltar ao painel do seller
          </NavLink>
        </div>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
