import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { startSellerOnboardingGuide } from "../utils/sellerOnboardingGuide";
import "./SellerOnboardingGuide.css";

const STORAGE_KEY = "viisync-seller-onboarding";
const ONBOARDING_EVENT = "viisync:seller-onboarding-change";

const TOUR_STEPS = [
  {
    id: "dashboard",
    path: "/",
    section: "Dashboard",
    title: "Comece pela visao geral",
    description:
      "Aqui o seller entende faturamento, lucro, vendas e ticket medio antes de entrar nos detalhes operacionais.",
    highlights: [
      "Troque o periodo entre 7, 30 e 90 dias para comparar desempenho.",
      "Use os cards principais como leitura rapida do negocio.",
      "A assistente fica sempre disponivel para perguntas contextuais.",
    ],
  },
  {
    id: "orders",
    path: "/pedidos",
    section: "Pedidos",
    title: "Monitore a fila operacional",
    description:
      "A area de pedidos ajuda a enxergar atrasos, status e concentracao por canal sem depender de planilhas externas.",
    highlights: [
      "Pesquise por pedido, produto, canal ou status.",
      "Use os filtros para priorizar o que precisa de acao imediata.",
      "A ideia aqui e reduzir pedido parado e gargalo operacional.",
    ],
  },
  {
    id: "products",
    path: "/produtos",
    section: "Produtos",
    title: "Entenda quais itens sustentam o resultado",
    description:
      "Produtos mostra o mix do catalogo e ajuda a separar item rentavel de item que so gera volume.",
    highlights: [
      "Filtre por status para identificar produtos pausados ou ativos.",
      "Busque por nome ou SKU para ir direto ao item certo.",
      "Use isso como base para decidir reativacao, corte ou expansao de mix.",
    ],
  },
  {
    id: "finance",
    path: "/financeiro",
    section: "Financeiro",
    title: "Leia o caixa com mais clareza",
    description:
      "No centro financeiro o seller enxerga entradas, saidas, repasses previstos e pressao de taxas por canal.",
    highlights: [
      "O fluxo de caixa segue o mesmo recorte do dashboard.",
      "Despesas recorrentes e repasses ajudam na previsao operacional.",
      "Taxa por canal mostra onde a rentabilidade esta sendo comprimida.",
    ],
  },
  {
    id: "reports",
    path: "/relatorios",
    section: "Relatorios",
    title: "Exporte e consolide os numeros",
    description:
      "Relatorios serve para consolidar dados, gerar planilhas e aplicar ajustes como custos adicionais mensais.",
    highlights: [
      "A exportacao respeita o periodo selecionado.",
      "Os relatorios usam a mesma base do dashboard e financeiro.",
      "Custos adicionais permitem simular impacto no lucro final.",
    ],
  },
  {
    id: "questions",
    path: "/mercado-livre/perguntas",
    section: "Perguntas ML",
    title: "Centralize duvidas de clientes",
    description:
      "Essa area concentra perguntas do Mercado Livre, status de resposta e tratamento operacional da inbox.",
    highlights: [
      "Filtre nao respondidas para priorizar atendimento.",
      "Abra o detalhe para responder e acompanhar o historico.",
      "A estrutura ja esta pronta para API real no backend.",
    ],
  },
  {
    id: "settings",
    path: "/configuracoes",
    section: "Configuracoes",
    title: "Ajuste preferencias e integracoes",
    description:
      "Configuracoes concentra preferencias do workspace e serve como ponto de apoio para futuros ajustes de conta.",
    highlights: [
      "Tema, periodo padrao e preferencias ficam aqui.",
      "A area tambem pode virar base para integracoes e perfil da conta.",
      "Depois do tour, esse e o melhor lugar para fechamento de setup.",
    ],
  },
];

function readStoredState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

function dispatchOnboardingEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT));
}

function persistStoredState(nextState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  dispatchOnboardingEvent();
}

function resolveStepIndex(stepId) {
  const index = TOUR_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? index : 0;
}

function resolveModeFromStorage() {
  const storedState = readStoredState();

  if (!storedState?.status) {
    return {
      mode: "prompt",
      activeStepIndex: 0,
    };
  }

  if (storedState.status === "active") {
    return {
      mode: "tour",
      activeStepIndex: resolveStepIndex(storedState.stepId),
    };
  }

  return {
    mode: "hidden",
    activeStepIndex: 0,
  };
}

function SellerOnboardingGuide() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState("hidden");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    function syncFromStorage() {
      const nextState = resolveModeFromStorage();
      setMode(nextState.mode);
      setActiveStepIndex(nextState.activeStepIndex);
      setHasHydrated(true);
    }

    syncFromStorage();
    window.addEventListener(ONBOARDING_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener(ONBOARDING_EVENT, syncFromStorage);
    };
  }, []);

  const locationStepIndex =
    mode === "tour"
      ? TOUR_STEPS.findIndex((step) => step.path === location.pathname)
      : -1;
  const effectiveStepIndex = locationStepIndex >= 0 ? locationStepIndex : activeStepIndex;

  const currentStep = TOUR_STEPS[effectiveStepIndex] || TOUR_STEPS[0];
  const totalSteps = TOUR_STEPS.length;
  const progressPercent = ((effectiveStepIndex + 1) / totalSteps) * 100;

  const promptPreview = useMemo(() => {
    return TOUR_STEPS.slice(0, 4).map((step) => step.section);
  }, []);

  function handleDismissPrompt() {
    persistStoredState({ status: "dismissed" });
    setMode("hidden");
  }

  function handleStartTutorial() {
    startSellerOnboardingGuide();
    setMode("tour");
    setActiveStepIndex(0);

    if (location.pathname !== TOUR_STEPS[0].path) {
      navigate(TOUR_STEPS[0].path);
    }
  }

  function handleMoveToStep(nextIndex) {
    const boundedIndex = Math.max(0, Math.min(nextIndex, TOUR_STEPS.length - 1));
    const nextStep = TOUR_STEPS[boundedIndex];

    setActiveStepIndex(boundedIndex);
    persistStoredState({
      status: "active",
      stepId: nextStep.id,
    });

    if (location.pathname !== nextStep.path) {
      navigate(nextStep.path);
    }
  }

  function handleFinishTutorial() {
    persistStoredState({ status: "completed" });
    setMode("hidden");
  }

  function handleSkipTutorial() {
    persistStoredState({ status: "dismissed" });
    setMode("hidden");
  }

  if (!hasHydrated) {
    return null;
  }

  return (
    <>
      {mode === "prompt" ? (
        <div className="seller-onboarding-overlay" role="dialog" aria-modal="true">
          <div className="seller-onboarding-prompt">
            <span className="seller-onboarding-tag">Primeiro acesso</span>
            <h2>Gostaria de ver um tutorial de uso do sistema?</h2>
            <p>
              Posso te guiar pelas principais areas do ViiSync para voce entender
              rapidamente onde acompanhar operacao, lucro, relatorios e atendimento.
            </p>

            <div className="seller-onboarding-preview">
              {promptPreview.map((item) => (
                <span key={item} className="seller-onboarding-chip">
                  {item}
                </span>
              ))}
            </div>

            <div className="seller-onboarding-actions">
              <button
                type="button"
                className="seller-onboarding-primary"
                onClick={handleStartTutorial}
              >
                Sim, iniciar tutorial
              </button>
              <button
                type="button"
                className="seller-onboarding-secondary"
                onClick={handleDismissPrompt}
              >
                Nao agora
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "tour" ? (
        <aside className="seller-tour-card" aria-live="polite">
          <div className="seller-tour-topline">
            <span className="seller-tour-tag">Tutorial guiado</span>
            <button
              type="button"
              className="seller-tour-close"
              onClick={handleSkipTutorial}
            >
              Encerrar
            </button>
          </div>

          <div className="seller-tour-progress">
            <div
              className="seller-tour-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="seller-tour-copy">
            <span className="seller-tour-step">
              Etapa {effectiveStepIndex + 1} de {totalSteps} | {currentStep.section}
            </span>
            <h3>{currentStep.title}</h3>
            <p>{currentStep.description}</p>
          </div>

          <div className="seller-tour-highlights">
            {currentStep.highlights.map((highlight) => (
              <div key={highlight} className="seller-tour-highlight">
                {highlight}
              </div>
            ))}
          </div>

          <div className="seller-tour-actions">
            <button
              type="button"
              className="seller-tour-secondary"
              onClick={() => handleMoveToStep(activeStepIndex - 1)}
              disabled={effectiveStepIndex === 0}
            >
              Voltar
            </button>

            {effectiveStepIndex === totalSteps - 1 ? (
              <button
                type="button"
                className="seller-tour-primary"
                onClick={handleFinishTutorial}
              >
                Finalizar tutorial
              </button>
            ) : (
              <button
                type="button"
                className="seller-tour-primary"
                onClick={() => handleMoveToStep(effectiveStepIndex + 1)}
              >
                Proxima etapa
              </button>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}

export default SellerOnboardingGuide;
