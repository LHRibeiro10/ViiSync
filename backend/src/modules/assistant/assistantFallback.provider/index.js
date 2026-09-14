const { buildReplyDecorations } = require("../assistantContext.service");
const { analyzeMessage } = require("./analysis");
const { buildReplyByAnalysis } = require("./dispatcher");

function createFallbackResponse({ userMessage, context, conversationHistory = [] }) {
  const analysis = analyzeMessage(userMessage, context, conversationHistory);
  const reply = buildReplyByAnalysis(analysis, context);
  const decorations = buildReplyDecorations(userMessage, context);

  return {
    content: reply,
    meta: {
      ...decorations,
      provider: "mocked-context",
      usedFallback: false,
    },
    providerState: {},
  };
}

module.exports = {
  createFallbackResponse,
};
