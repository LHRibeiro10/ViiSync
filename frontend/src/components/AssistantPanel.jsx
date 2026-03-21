import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createAssistantConversation,
  getAssistantConversation,
  resetAssistantConversation,
  sendAssistantMessage,
} from "../services/api";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import "./AssistantPanel.css";

const STORAGE_KEY = "viisync-assistant-conversation";
const MIN_RESPONSE_WAIT_MS = 520;
const THINKING_STEPS = [
  "Lendo sua pergunta",
  "Analisando os dados operacionais",
  "Montando uma resposta objetiva",
];

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3 9.8 8.2 4.5 10.5l5.3 2.2L12 18l2.2-5.3 5.3-2.2-5.3-2.3Z"
        fill="currentColor"
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

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m4 20 16-8L4 4l2.6 8L20 12 6.6 12z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 3h6m-8 4h10m-8 4v6m4-6v6m-7 4h10a1 1 0 0 0 1-1V7H6v13a1 1 0 0 0 1 1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function createOptimisticMessage(role, content) {
  return {
    id: `temp-${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    meta: {},
  };
}

function sleep(delay) {
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

function chunkText(content) {
  const tokens = content.match(/(\S+\s*|\n+)/g) || [content];
  return tokens.map((token, index) => {
    if (index < tokens.length - 1 && !token.endsWith("\n") && !token.endsWith(" ")) {
      return `${token} `;
    }

    return token;
  });
}

function typingDelayForChunk(chunk) {
  if (chunk.includes("\n")) {
    return 70;
  }

  if (chunk.length <= 4) {
    return 16;
  }

  if (chunk.length <= 10) {
    return 24;
  }

  return 34;
}

function AssistantPanel({ currentPathname }) {
  const { selectedPeriod } = useAnalyticsPeriod();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [contextSummary, setContextSummary] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [thinkingStatus, setThinkingStatus] = useState(THINKING_STEPS[0]);
  const initializedRef = useRef(false);
  const messageViewportRef = useRef(null);
  const currentMessagesRef = useRef([]);
  const thinkingIntervalRef = useRef();
  const streamTokenRef = useRef(0);
  const refreshTokenRef = useRef(0);

  const initializeAssistant = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const storedConversationId = window.localStorage.getItem(STORAGE_KEY);

      if (storedConversationId) {
        try {
          const existingConversation = await getAssistantConversation(
            storedConversationId,
            currentPathname,
            selectedPeriod
          );
          syncPayloadMeta(existingConversation);
          applyMessages(existingConversation.messages || []);
          return existingConversation;
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }

      const newConversation = await createAssistantConversation(
        currentPathname,
        selectedPeriod
      );
      syncPayloadMeta(newConversation);
      applyMessages(newConversation.messages || []);
      return newConversation;
    } catch {
      setError("Nao foi possivel iniciar a assistente.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentPathname, selectedPeriod]);

  const refreshConversationContext = useCallback(async () => {
    const requestToken = refreshTokenRef.current + 1;
    refreshTokenRef.current = requestToken;

    try {
      if (!conversationId) {
        return;
      }

      const payload = await getAssistantConversation(
        conversationId,
        currentPathname,
        selectedPeriod
      );

      if (requestToken !== refreshTokenRef.current) {
        return;
      }

      syncPayloadMeta(payload);
      applyMessages(payload.messages || []);
    } catch (err) {
      if (requestToken !== refreshTokenRef.current) {
        return;
      }

      if (err?.status === 404) {
        window.localStorage.removeItem(STORAGE_KEY);
        setConversationId("");
        await initializeAssistant();
      }
    }
  }, [conversationId, currentPathname, initializeAssistant, selectedPeriod]);

  useEffect(() => {
    currentMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    initializeAssistant();
  }, [initializeAssistant]);

  useEffect(() => {
    if (!initializedRef.current || sending) {
      return;
    }

    refreshConversationContext();
  }, [currentPathname, refreshConversationContext, selectedPeriod, sending]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      if (messageViewportRef.current) {
        messageViewportRef.current.scrollTop = messageViewportRef.current.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isOpen, messages, sending]);

  useEffect(() => {
    return () => {
      stopThinkingLoop();
      streamTokenRef.current += 1;
    };
  }, []);

  const lastAssistantMessage = useMemo(() => {
    return [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && !message.meta?.isStreaming);
  }, [messages]);

  const activeSuggestions = useMemo(() => {
    if (lastAssistantMessage?.meta?.suggestions?.length) {
      return lastAssistantMessage.meta.suggestions;
    }

    return suggestions;
  }, [lastAssistantMessage, suggestions]);

  const hasUserMessages = messages.some((message) => message.role === "user");

  function syncPayloadMeta(payload) {
    setConversationId(payload.conversation.id);
    setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
    setContextSummary(payload.contextSummary || null);
    window.localStorage.setItem(STORAGE_KEY, payload.conversation.id);
  }

  function applyMessages(nextMessages) {
    currentMessagesRef.current = Array.isArray(nextMessages) ? nextMessages : [];

    startTransition(() => {
      setMessages(Array.isArray(nextMessages) ? nextMessages : []);
    });
  }

  async function ensureConversation() {
    if (conversationId) {
      return conversationId;
    }

    const payload = await createAssistantConversation(currentPathname, selectedPeriod);
    syncPayloadMeta(payload);
    applyMessages(payload.messages || []);
    return payload.conversation.id;
  }

  function startThinkingLoop() {
    stopThinkingLoop();
    setThinkingStatus(THINKING_STEPS[0]);

    let stepIndex = 0;
    thinkingIntervalRef.current = window.setInterval(() => {
      stepIndex = (stepIndex + 1) % THINKING_STEPS.length;
      setThinkingStatus(THINKING_STEPS[stepIndex]);
    }, 850);
  }

  function stopThinkingLoop() {
    window.clearInterval(thinkingIntervalRef.current);
  }

  async function animateAssistantReply(payload) {
    syncPayloadMeta(payload);

    const nextMessages = Array.isArray(payload.messages) ? payload.messages : [];
    const finalAssistantMessage =
      payload.assistantMessage || nextMessages[nextMessages.length - 1];

    if (!finalAssistantMessage || finalAssistantMessage.role !== "assistant") {
      applyMessages(nextMessages);
      return;
    }

    const baseMessages = nextMessages.slice(0, -1);
    const chunks = chunkText(finalAssistantMessage.content);
    const animationToken = streamTokenRef.current + 1;
    streamTokenRef.current = animationToken;

    let renderedContent = "";

    for (const chunk of chunks) {
      if (animationToken !== streamTokenRef.current) {
        return;
      }

      renderedContent += chunk;

      applyMessages([
        ...baseMessages,
        {
          ...finalAssistantMessage,
          content: renderedContent,
          meta: {
            ...finalAssistantMessage.meta,
            isStreaming: renderedContent.length < finalAssistantMessage.content.length,
          },
        },
      ]);

      await sleep(typingDelayForChunk(chunk));
    }

    if (animationToken === streamTokenRef.current) {
      applyMessages(nextMessages);
    }
  }

  async function handleSend(messageOverride) {
    const content = String(messageOverride ?? draft).trim();

    if (!content || sending) {
      return;
    }

    setError("");
    setDraft("");
    setSending(true);
    startThinkingLoop();

    const sendStartedAt = Date.now();
    const optimisticUserMessage = createOptimisticMessage("user", content);
    applyMessages([...currentMessagesRef.current, optimisticUserMessage]);

    try {
      const activeConversationId = await ensureConversation();
      const payload = await sendAssistantMessage(
        activeConversationId,
        content,
        currentPathname,
        selectedPeriod
      );

      const remainingDelay = Math.max(
        0,
        MIN_RESPONSE_WAIT_MS - (Date.now() - sendStartedAt)
      );

      if (remainingDelay > 0) {
        await sleep(remainingDelay);
      }

      await animateAssistantReply(payload);
    } catch {
      applyMessages(
        currentMessagesRef.current.filter(
          (message) => message.id !== optimisticUserMessage.id
        )
      );
      setDraft(content);
      setError("Nao foi possivel obter resposta da assistente.");
    } finally {
      stopThinkingLoop();
      setSending(false);
    }
  }

  async function handleResetConversation() {
    if (sending || loading) {
      return;
    }

    setError("");
    setDraft("");
    setSending(false);
    stopThinkingLoop();
    streamTokenRef.current += 1;

    try {
      const payload = conversationId
        ? await resetAssistantConversation(
            conversationId,
            currentPathname,
            selectedPeriod
          )
        : await createAssistantConversation(currentPathname, selectedPeriod);

      syncPayloadMeta(payload);
      applyMessages(payload.messages || []);
    } catch {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        const payload = await createAssistantConversation(currentPathname, selectedPeriod);
        syncPayloadMeta(payload);
        applyMessages(payload.messages || []);
      } catch {
        setError("Nao foi possivel limpar a conversa.");
      }
    }
  }

  function handleComposerSubmit(event) {
    event.preventDefault();
    handleSend();
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <button
        type="button"
        className={`assistant-trigger ${isOpen ? "is-open" : ""}`.trim()}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        aria-expanded={isOpen}
        aria-controls="viisync-assistant"
      >
        <SparkIcon />
        <span>Assistente</span>
      </button>

      <button
        type="button"
        className={`assistant-backdrop ${isOpen ? "is-visible" : ""}`.trim()}
        aria-label="Fechar assistente"
        onClick={() => setIsOpen(false)}
      />

      <aside
        id="viisync-assistant"
        className={`assistant-shell ${isOpen ? "is-open" : ""}`.trim()}
      >
        <section className="assistant-panel">
          <header className="assistant-header">
            <div className="assistant-header-copy">
              <div className="assistant-header-topline">
                <span className="assistant-eyebrow">Dados operacionais</span>
                <span className="assistant-view-pill">
                  {currentPathname === "/" ? "Dashboard" : currentPathname.replace("/", "")}
                </span>
                <span className="assistant-view-pill">
                  {selectedPeriod === "7d"
                    ? "7 dias"
                    : selectedPeriod === "90d"
                    ? "90 dias"
                    : "30 dias"}
                </span>
              </div>

              <h2>Assistente ViiSync</h2>
              <p>Respostas contextuais sobre vendas, margem, operacao e lucro.</p>
            </div>

            <div className="assistant-header-actions">
              <button
                type="button"
                className="assistant-icon-button"
                onClick={handleResetConversation}
                disabled={sending || loading}
                aria-label="Limpar conversa"
              >
                <TrashIcon />
              </button>

              <button
                type="button"
                className="assistant-icon-button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar assistente"
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          {contextSummary ? (
            <div className="assistant-summary-strip">
              <strong>{contextSummary.heading}</strong>
              <span>{contextSummary.subtitle}</span>
            </div>
          ) : null}

          <div className="assistant-messages" ref={messageViewportRef}>
            {loading ? (
              <div className="assistant-state assistant-state-loading">
                <div className="assistant-loading-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <strong>Preparando a assistente</strong>
                <p>Carregando o contexto do ViiSync.</p>
              </div>
            ) : null}

            {!loading
              ? messages.map((message) => (
                  <div
                    key={message.id}
                    className={`assistant-message assistant-message-${message.role}`}
                  >
                    <div className="assistant-message-bubble">
                      <span className="assistant-message-label">
                        {message.role === "assistant" ? "Assistente" : "Voce"}
                      </span>
                      <p className="assistant-message-content">{message.content}</p>
                    </div>
                  </div>
                ))
              : null}

            {!loading && !hasUserMessages ? (
              <div className="assistant-state assistant-state-empty">
                <strong>Comece com uma pergunta objetiva.</strong>
                <p>
                  Ex.: qual produto vendeu mais, como estao minhas margens ou onde
                  estou gastando mais.
                </p>
              </div>
            ) : null}

            {sending ? (
              <div className="assistant-message assistant-message-assistant">
                <div className="assistant-message-bubble assistant-thinking-bubble">
                  <span className="assistant-message-label">Assistente</span>

                  <div className="assistant-thinking-row">
                    <div className="assistant-loading-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>

                    <small>{thinkingStatus}</small>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="assistant-error-banner">
              <strong>Falha na resposta</strong>
              <p>{error}</p>
            </div>
          ) : null}

          {!loading && activeSuggestions.length ? (
            <div className="assistant-suggestions">
              {activeSuggestions.slice(0, hasUserMessages ? 3 : 4).map((question) => (
                <button
                  key={question}
                  type="button"
                  className="assistant-suggestion-chip"
                  onClick={() => handleSend(question)}
                  disabled={sending}
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}

          <form className="assistant-composer" onSubmit={handleComposerSubmit}>
            <label className="assistant-composer-field">
              <textarea
                rows={2}
                placeholder="Pergunte algo sobre vendas, margem, pedidos ou canais"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                disabled={loading || sending}
              />
            </label>

            <button
              type="submit"
              className="assistant-send-button"
              disabled={loading || sending || !draft.trim()}
              aria-label="Enviar mensagem"
            >
              <SendIcon />
            </button>
          </form>
        </section>
      </aside>
    </>
  );
}

export default AssistantPanel;
