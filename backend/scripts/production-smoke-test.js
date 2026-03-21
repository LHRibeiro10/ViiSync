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

function buildHeaders(token, extraHeaders = {}) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

async function resolveSmokeSessionToken(baseUrl) {
  const explicitToken = String(process.env.SMOKE_BEARER_TOKEN || "").trim();
  if (explicitToken) {
    return explicitToken;
  }

  const email = String(process.env.SMOKE_EMAIL || "").trim();
  const password = String(process.env.SMOKE_PASSWORD || "").trim();

  if (!email || !password) {
    throw new Error(
      "Defina SMOKE_BEARER_TOKEN ou informe SMOKE_EMAIL e SMOKE_PASSWORD."
    );
  }

  const loginResult = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: false }),
  });

  assertCondition(
    loginResult.ok,
    `POST /auth/login falhou com status ${loginResult.status}`
  );

  const token = loginResult.payload?.session?.token;
  assertCondition(token, "Login do smoke nao retornou token de sessao.");

  return token;
}

async function checkMercadoLivreStatus(baseUrl, token, expectUsingLive) {
  const result = await requestJson(baseUrl, "/integrations/mercadolivre/status", {
    headers: buildHeaders(token),
  });
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

async function checkQuestions(baseUrl, token, expectedSource) {
  const result = await requestJson(baseUrl, "/integrations/mercadolivre/questions", {
    headers: buildHeaders(token),
  });
  assertCondition(
    result.ok,
    `GET /integrations/mercadolivre/questions falhou com status ${result.status}`
  );

  if (expectedSource) {
    assertCondition(
      result.payload?.meta?.source === expectedSource,
      `A origem das perguntas nao bate com o contrato esperado (meta.source esperado: ${expectedSource}).`
    );
  }

  console.log("OK  GET /integrations/mercadolivre/questions");
  return result.payload;
}

async function checkReply(baseUrl, token, questionsPayload) {
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
      headers: buildHeaders(token, { "Content-Type": "application/json" }),
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
  const expectedSource = String(process.env.EXPECT_SOURCE || "database").trim();
  const enableReplyTest = toBoolean(process.env.ENABLE_REPLY_TEST, false);

  await checkRoot(baseUrl);
  const token = await resolveSmokeSessionToken(baseUrl);
  await checkMercadoLivreStatus(baseUrl, token, expectUsingLive);
  const questionsPayload = await checkQuestions(baseUrl, token, expectedSource);

  if (enableReplyTest) {
    await checkReply(baseUrl, token, questionsPayload);
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
