function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return String(value).toLowerCase() === "true";
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json().catch(() => null);
  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
}

async function checkRoot(baseUrl) {
  const result = await requestJson(baseUrl, "/");
  assertCondition(result.ok, `GET / falhou com status ${result.status}`);
  console.log("OK  GET /");
}

async function checkMercadoLivreStatus(baseUrl, expectUsingLive) {
  const result = await requestJson(baseUrl, "/integrations/mercadolivre/status");
  assertCondition(
    result.ok,
    `GET /integrations/mercadolivre/status falhou com status ${result.status}`
  );

  if (expectUsingLive) {
    assertCondition(
      result.payload && result.payload.usingLive === true,
      "Status nao esta usando modo live. Execute OAuth ou configure token."
    );
  }

  console.log("OK  GET /integrations/mercadolivre/status");
}

async function checkQuestions(baseUrl, expectRealSource) {
  const result = await requestJson(baseUrl, "/integrations/mercadolivre/questions");
  assertCondition(
    result.ok,
    `GET /integrations/mercadolivre/questions falhou com status ${result.status}`
  );

  if (expectRealSource) {
    assertCondition(
      result.payload?.meta?.source === "mercado-livre-api",
      "A origem das perguntas nao indica API real (meta.source esperado: mercado-livre-api)."
    );
  }

  console.log("OK  GET /integrations/mercadolivre/questions");
  return result.payload;
}

async function checkReply(baseUrl, questionsPayload) {
  const explicitQuestionId = String(process.env.MERCADOLIVRE_TEST_QUESTION_ID || "").trim();
  const fallbackQuestion =
    questionsPayload?.items?.find((item) => !item.isAnswered) || null;
  const questionId = explicitQuestionId || fallbackQuestion?.id || null;

  assertCondition(
    questionId,
    "Nao foi encontrada pergunta em aberto para teste de resposta. Defina MERCADOLIVRE_TEST_QUESTION_ID."
  );

  const result = await requestJson(
    baseUrl,
    `/integrations/mercadolivre/questions/${questionId}/reply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Resposta automatica de smoke test ${new Date().toISOString()}`,
      }),
    }
  );

  assertCondition(
    result.status === 201,
    `POST /integrations/mercadolivre/questions/:id/reply retornou ${result.status}`
  );

  console.log(`OK  POST /integrations/mercadolivre/questions/${questionId}/reply`);
}

async function main() {
  const baseUrl = normalizeBaseUrl(
    process.env.DEPLOY_API_BASE_URL || process.env.API_BASE_URL
  );

  assertCondition(
    baseUrl,
    "Defina DEPLOY_API_BASE_URL com a URL publica do backend no Railway."
  );

  const expectUsingLive = toBoolean(process.env.EXPECT_USING_LIVE, true);
  const expectRealSource = toBoolean(process.env.EXPECT_REAL_SOURCE, true);
  const enableReplyTest = toBoolean(process.env.ENABLE_REPLY_TEST, false);

  await checkRoot(baseUrl);
  await checkMercadoLivreStatus(baseUrl, expectUsingLive);
  const questionsPayload = await checkQuestions(baseUrl, expectRealSource);

  if (enableReplyTest) {
    await checkReply(baseUrl, questionsPayload);
  } else {
    console.log(
      "SKIP POST /integrations/mercadolivre/questions/:id/reply (defina ENABLE_REPLY_TEST=true para executar)"
    );
  }

  console.log("Smoke test de deploy concluido.");
}

main().catch((error) => {
  console.error("Smoke test falhou:", error.message);
  process.exit(1);
});
