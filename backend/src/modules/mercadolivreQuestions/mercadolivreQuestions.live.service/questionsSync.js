const { normalizeText, throwClientError } = require("./config");
const { mapQuestion } = require("./mappers");
const { requestWithAutoRefresh } = require("./oauth");
const { fetchItemsByIds } = require("./itemsSync");

async function pullQuestionsFromApi(accountTokenSource = {}) {
  const sellerId = normalizeText(accountTokenSource.sellerId);

  if (!sellerId) {
    throwClientError("Conta Mercado Livre sem sellerId para sincronizar perguntas.", 400);
  }

  const { payload, tokenState } = await requestWithAutoRefresh(
    `/questions/search?seller_id=${encodeURIComponent(sellerId)}&limit=50`,
    { ...accountTokenSource },
    {
      method: "GET",
    }
  );

  const questionsRaw = Array.isArray(payload?.questions) ? payload.questions : [];
  const itemIds = questionsRaw.map((question) => question?.item_id).filter(Boolean);

  const {
    itemsById,
    tokenState: tokenStateFromItems,
  } = await fetchItemsByIds(itemIds, {
    ...accountTokenSource,
    ...(tokenState ? { accessToken: tokenState.accessToken, refreshToken: tokenState.refreshToken } : {}),
  });

  const mappedItems = questionsRaw
    .map((question) => mapQuestion(question, itemsById.get(String(question?.item_id)) || {}))
    .filter((item) => item.id && item.itemId && item.questionText);

  return {
    items: mappedItems,
    meta: {
      source: "mercado-livre-api",
      total: mappedItems.length,
      lastSyncAt: new Date().toISOString(),
      tokenState: tokenStateFromItems || tokenState || null,
    },
  };
}

async function replyQuestion(questionId, answerText, accountTokenSource = {}) {
  const id = normalizeText(questionId);
  const text = normalizeText(answerText);

  if (!id || !text) {
    throwClientError("Pergunta ou resposta invalida.", 400);
  }

  const { tokenState } = await requestWithAutoRefresh(
    "/answers",
    { ...accountTokenSource },
    {
      method: "POST",
      body: {
        question_id: id,
        text,
      },
    }
  );

  return {
    sent: true,
    id,
    tokenState: tokenState || null,
  };
}

module.exports = {
  pullQuestionsFromApi,
  replyQuestion,
};
