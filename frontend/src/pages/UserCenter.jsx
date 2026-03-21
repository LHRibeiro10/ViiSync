import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import FeedbackCenter from "./FeedbackCenter";
import IntegrationsHub from "./IntegrationsHub";
import "./UserCenter.css";

const TAB_ITEMS = [
  {
    id: "integracoes",
    label: "Integracoes",
    title: "Conexao de marketplace",
    description:
      "Conecte e acompanhe sua conta Mercado Livre para manter dados sincronizados no sistema.",
  },
  {
    id: "feedback",
    label: "Feedback",
    title: "Chamados com o time",
    description:
      "Abra chamados de melhoria, reclamacao e suporte e acompanhe resposta e previsao do admin.",
  },
];

function resolveTab(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return TAB_ITEMS.some((item) => item.id === normalized) ? normalized : "integracoes";
}

function UserCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get("tab"));
  const activeTabItem = useMemo(
    () => TAB_ITEMS.find((item) => item.id === activeTab) || TAB_ITEMS[0],
    [activeTab]
  );

  function handleTabChange(nextTab) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", resolveTab(nextTab));
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="user-center-page">
      <PageHeader
        tag="Conta do seller"
        title="Area do usuario"
        description="Centralize conexao de integracoes e chamados de feedback em um unico lugar."
      />

      <section className="user-center-tabs">
        <div className="user-center-tab-list">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`user-center-tab-button ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="user-center-tab-copy">
          <h2>{activeTabItem.title}</h2>
          <p>{activeTabItem.description}</p>
        </div>
      </section>

      <section className="user-center-content">
        {activeTab === "feedback" ? (
          <FeedbackCenter embedded />
        ) : (
          <IntegrationsHub embedded />
        )}
      </section>
    </div>
  );
}

export default UserCenter;
