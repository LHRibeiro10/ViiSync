const { randomUUID } = require("crypto");

const {
  buildAssistantContext,
  buildReplyDecorations,
  createWelcomeMessage,
  detectRequestedPeriod,
  formatCurrency,
  formatPercent,
} = require("./assistantContext.service");
const { getPeriodLabel } = require("../../lib/period");
const {
  createConversationRepository,
} = require("./assistantConversation.repository");
const { createFallbackResponse } = require("./assistantFallback.provider");

const MAX_STORED_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 2000;

const { persistenceMode, repository } = createConversationRepository();

class AssistantNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssistantNotFoundError";
  }
}

class AssistantValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssistantValidationError";
  }
}

async function startConversation({
  currentView = "/",
  period = "30d",
  request = {},
} = {}) {
  const context = await buildAssistantContext({ currentView, period, request });
  const welcomeMessage = createAssistantMessage(
    createWelcomeMessage(context),
    {
      tone: "neutral",
      highlights: [
        {
          label: `Receita ${getPeriodLabel(context.period)}`,
          value: formatCurrency(context.summary.revenue),
        },
        {
          label: `Lucro ${getPeriodLabel(context.period)}`,
          value: formatCurrency(context.summary.profit),
        },
        {
          label: "Margem media",
          value: formatPercent(context.summary.averageMargin),
        },
      ],
      suggestions: context.quickQuestions.slice(0, 3),
      provider: "bootstrap",
      usedFallback: false,
    }
  );

  const conversation = await repository.createConversation({
    initialMessages: [welcomeMessage],
    meta: {
      currentView,
      period: context.period,
    },
  });

  return buildConversationPayload(conversation, context);
}

async function getConversationState(
  conversationId,
  { currentView = "/", period = "30d", request = {} } = {}
) {
  const conversation = await repository.getConversation(conversationId);

  if (!conversation) {
    throw new AssistantNotFoundError("Conversa nao encontrada.");
  }

  const resolvedView = currentView || conversation.meta?.currentView || "/";
  const resolvedPeriod = period || conversation.meta?.period || "30d";
  const context = await buildAssistantContext({
    currentView: resolvedView,
    period: resolvedPeriod,
    request,
  });

  return buildConversationPayload(conversation, context);
}

async function resetConversation(
  conversationId,
  { currentView = "/", period = "30d", request = {} } = {}
) {
  const context = await buildAssistantContext({ currentView, period, request });
  const welcomeMessage = createAssistantMessage(createWelcomeMessage(context), {
    tone: "neutral",
    highlights: [
      {
        label: `Receita ${getPeriodLabel(context.period)}`,
        value: formatCurrency(context.summary.revenue),
      },
      {
        label: `Lucro ${getPeriodLabel(context.period)}`,
        value: formatCurrency(context.summary.profit),
      },
      {
        label: "Margem media",
        value: formatPercent(context.summary.averageMargin),
      },
    ],
    suggestions: context.quickQuestions.slice(0, 3),
    provider: "bootstrap",
    usedFallback: false,
  });

  const conversation = await repository.resetConversation(conversationId, {
    initialMessages: [welcomeMessage],
    meta: {
      currentView,
      period: context.period,
    },
  });

  if (!conversation) {
    return startConversation({ currentView, period: context.period, request });
  }

  return buildConversationPayload(conversation, context);
}

async function replyToConversation(
  conversationId,
  { message, currentView = "/", period = "30d", request = {} } = {}
) {
  const trimmedMessage = String(message ?? "").trim();

  if (!trimmedMessage) {
    throw new AssistantValidationError("Informe uma mensagem para a assistente.");
  }

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    throw new AssistantValidationError(
      `A mensagem deve ter no maximo ${MAX_MESSAGE_LENGTH} caracteres.`
    );
  }

  const conversation = await repository.getConversation(conversationId);

  if (!conversation) {
    throw new AssistantNotFoundError("Conversa nao encontrada.");
  }

  const context = await buildAssistantContext({
    currentView,
    period: detectRequestedPeriod(trimmedMessage, period),
    request,
  });
  const userMessage = createConversationMessage("user", trimmedMessage, {
    currentView,
    period: context.period,
  });

  const providerResponse = await generateProviderReply({
    conversationHistory: [...conversation.messages, userMessage].slice(-MAX_STORED_MESSAGES),
    context,
    userMessage: trimmedMessage,
  });

  const assistantMessage = createAssistantMessage(providerResponse.content, {
    ...buildReplyDecorations(trimmedMessage, context),
    provider: providerResponse.meta.provider,
    usedFallback: providerResponse.meta.usedFallback,
    providerError: providerResponse.meta.providerError,
  });

  const savedConversation = await repository.saveConversation({
    ...conversation,
    meta: {
      ...conversation.meta,
      currentView,
      period: context.period,
    },
    providerState: {
      ...(conversation.providerState || {}),
      ...(providerResponse.providerState || {}),
    },
    messages: [...conversation.messages, userMessage, assistantMessage].slice(
      -MAX_STORED_MESSAGES
    ),
  });

  return {
    ...buildConversationPayload(savedConversation, context),
    userMessage,
    assistantMessage,
  };
}

async function generateProviderReply({ conversationHistory, context, userMessage }) {
  return createFallbackResponse({ userMessage, context, conversationHistory });
}

function buildConversationPayload(conversation, context) {
  return {
    conversation: {
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      persistenceMode,
      currentView: context.currentView,
      period: context.period,
    },
    messages: conversation.messages,
    suggestions: context.quickQuestions.slice(0, 6),
    insights: buildInsightCards(context),
    contextSummary: {
      heading: `${formatCurrency(context.summary.revenue)} em receita no recorte atual`,
      subtitle: `${formatCurrency(
        context.summary.profit
      )} de lucro e ${formatPercent(context.summary.averageMargin)} de margem media`,
      highlights: [
        {
          label: "Pedidos",
          value: String(context.summary.sales),
        },
        {
          label: "Ticket medio",
          value: formatCurrency(context.summary.averageTicket),
        },
        {
          label: "Pendentes",
          value: String(context.orders.pending),
        },
      ],
    },
  };
}

function buildInsightCards(context) {
  const alertCards = context.alerts.map((alert) => ({
    id: alert.id,
    title: alert.title,
    description: alert.description,
    tone: alert.severity === "warning" ? "warning" : "neutral",
  }));

  if (alertCards.length >= 2) {
    return alertCards.slice(0, 3);
  }

  const defaultCards = [
    {
      id: "revenue-leader",
      title: "Produto lider",
      description: context.products.topRevenueProducts[0]
        ? `${context.products.topRevenueProducts[0].name} puxa o faturamento recente.`
        : "Sem produto lider identificado.",
      tone: "positive",
    },
    {
      id: "channel-leader",
      title: "Canal mais rentavel",
      description: context.channels.strongestChannel
        ? `${context.channels.strongestChannel.name} segue com o melhor lucro consolidado.`
        : "Sem canal dominante identificado.",
      tone: "neutral",
    },
    {
      id: "weekly-pace",
      title: "Ritmo semanal",
      description: `A receita da ultima semana esta ${
        context.weeklySummary.revenuePaceVsMonth >= 0 ? "acima" : "abaixo"
      } da media mensal em ${formatPercent(
        Math.abs(context.weeklySummary.revenuePaceVsMonth)
      )}.`,
      tone: context.weeklySummary.revenuePaceVsMonth >= 0 ? "positive" : "warning",
    },
  ];

  return [...alertCards, ...defaultCards].slice(0, 3);
}

function createConversationMessage(role, content, meta = {}) {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    meta,
  };
}

function createAssistantMessage(content, meta = {}) {
  return createConversationMessage("assistant", content, meta);
}

module.exports = {
  AssistantNotFoundError,
  AssistantValidationError,
  getConversationState,
  replyToConversation,
  resetConversation,
  startConversation,
};
