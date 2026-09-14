const prisma = require("../../../lib/prisma");
const liveProvider = require("../mercadolivreQuestions.live.service");
const {
  MercadoLivreQuestionNotFoundError,
  MercadoLivreQuestionValidationError,
  normalizeText,
  ensureDate,
  ensureIsoDate,
} = require("./primitives");
const {
  resolveViewerUser,
  resolveMercadoLivreAccount,
  buildAccountTokenSource,
  canUseLiveProvider,
  ensureLiveAccountToken,
} = require("./shared");
const { rememberLastSync, resolveLastSyncAt, runAccountSyncWithLifecycle } = require("./state");
const {
  emptyQuestionsPayload,
  buildQuestionsPayload,
  buildQuestionDetail,
} = require("./questionsPresentation");

function mapQuestionRowToEntity(row) {
  if (!row) {
    return null;
  }

  return {
    databaseId: row.id,
    id: row.externalQuestionId,
    itemId: row.itemId || "",
    itemTitle: row.itemTitle || `Anuncio ${row.itemId || ""}`,
    questionText: row.questionText || "",
    answerText: row.answerText || null,
    createdAt: ensureIsoDate(row.createdAtMl, ensureIsoDate(row.createdAt, new Date().toISOString())),
    answeredAt: ensureIsoDate(row.answeredAtMl, null),
    buyerNickname: row.buyerNickname || "Comprador",
    thumbnail: row.thumbnail || null,
    sku: row.sku || null,
    status: row.status || (row.answerText ? "answered" : "unanswered"),
    dismissedAt: ensureIsoDate(row.dismissedAt, null),
  };
}

async function listStoredQuestionRows(userId, marketplaceAccountId) {
  if (!userId || !marketplaceAccountId) {
    return [];
  }

  return prisma.mercadoLivreQuestion.findMany({
    where: {
      userId,
      marketplaceAccountId,
    },
    orderBy: {
      createdAtMl: "desc",
    },
  });
}

async function findStoredQuestionRowByExternalId(
  userId,
  marketplaceAccountId,
  externalQuestionId
) {
  if (!userId || !marketplaceAccountId || !externalQuestionId) {
    return null;
  }

  return prisma.mercadoLivreQuestion.findUnique({
    where: {
      marketplaceAccountId_externalQuestionId: {
        marketplaceAccountId,
        externalQuestionId: String(externalQuestionId),
      },
    },
  });
}

function toQuestionUpsertData(question, syncTimestamp) {
  const externalQuestionId = String(question.id || "").trim();
  if (!externalQuestionId) {
    return null;
  }

  const createdAtMl = ensureDate(question.createdAt, new Date());
  const answeredAtMl = ensureDate(question.answeredAt, null);
  const answerText = question.answerText ? String(question.answerText).trim() : null;
  const isAnswered = Boolean(answerText && answeredAtMl);

  return {
    externalQuestionId,
    itemId: String(question.itemId || "").trim(),
    itemTitle: question.itemTitle ? String(question.itemTitle).trim() : null,
    questionText: String(question.questionText || "").trim(),
    answerText,
    buyerNickname: question.buyerNickname ? String(question.buyerNickname).trim() : null,
    thumbnail: question.thumbnail ? String(question.thumbnail).trim() : null,
    sku: question.sku ? String(question.sku).trim() : null,
    status: isAnswered ? "answered" : "unanswered",
    createdAtMl,
    answeredAtMl,
    lastSyncedAt: syncTimestamp,
    rawPayload: question,
  };
}

async function persistRemoteQuestions(userId, marketplaceAccountId, remoteQuestions, lastSyncAt) {
  const syncTimestamp = ensureDate(lastSyncAt, new Date()) || new Date();

  for (const remoteQuestion of remoteQuestions) {
    const payload = toQuestionUpsertData(remoteQuestion, syncTimestamp);
    if (!payload) {
      continue;
    }

    await prisma.mercadoLivreQuestion.upsert({
      where: {
        marketplaceAccountId_externalQuestionId: {
          marketplaceAccountId,
          externalQuestionId: payload.externalQuestionId,
        },
      },
      create: {
        userId,
        marketplaceAccountId,
        externalQuestionId: payload.externalQuestionId,
        itemId: payload.itemId,
        itemTitle: payload.itemTitle,
        questionText: payload.questionText,
        answerText: payload.answerText,
        buyerNickname: payload.buyerNickname,
        thumbnail: payload.thumbnail,
        sku: payload.sku,
        status: payload.status,
        createdAtMl: payload.createdAtMl,
        answeredAtMl: payload.answeredAtMl,
        lastSyncedAt: payload.lastSyncedAt,
        rawPayload: payload.rawPayload,
      },
      update: {
        itemId: payload.itemId,
        itemTitle: payload.itemTitle,
        questionText: payload.questionText,
        answerText: payload.answerText,
        buyerNickname: payload.buyerNickname,
        thumbnail: payload.thumbnail,
        sku: payload.sku,
        status: payload.status,
        createdAtMl: payload.createdAtMl,
        answeredAtMl: payload.answeredAtMl,
        lastSyncedAt: payload.lastSyncedAt,
        rawPayload: payload.rawPayload,
      },
    });
  }

  rememberLastSync(userId, syncTimestamp.toISOString());
}

async function pullAndPersistQuestions(user, account) {
  if (!user?.id) {
    return { synced: false, imported: 0, lastSyncAt: null };
  }

  if (!account?.id) {
    return { synced: false, imported: 0, lastSyncAt: null };
  }

  const accountWithFreshToken = await ensureLiveAccountToken(account);
  const usingLive = await canUseLiveProvider(accountWithFreshToken);
  if (!usingLive) {
    return {
      synced: false,
      imported: 0,
      lastSyncAt: await resolveLastSyncAt(user.id, account.id),
    };
  }

  const remotePayload = await liveProvider.pullQuestionsFromApi(
    buildAccountTokenSource(accountWithFreshToken)
  );
  const remoteQuestions = Array.isArray(remotePayload?.items) ? remotePayload.items : [];
  const syncTimestamp = ensureIsoDate(remotePayload?.meta?.lastSyncAt, new Date().toISOString());
  const tokenState = remotePayload?.meta?.tokenState || null;

  await persistRemoteQuestions(user.id, account.id, remoteQuestions, syncTimestamp);
  await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      lastSyncedAt: ensureDate(syncTimestamp, new Date()) || new Date(),
      integrationStatus: "connected",
      ...(tokenState
        ? {
            accessToken: tokenState.accessToken || undefined,
            refreshToken: tokenState.refreshToken || undefined,
            tokenType: tokenState.tokenType || undefined,
            scope: tokenState.scope || undefined,
            tokenExpiresAt: ensureDate(tokenState.expiresAt, null) || undefined,
          }
        : {}),
    },
  });

  return {
    synced: true,
    imported: remoteQuestions.length,
    lastSyncAt: syncTimestamp,
  };
}

async function buildQuestionsPayloadForUser(user, account, filters = {}) {
  if (!user?.id || !account?.id) {
    return emptyQuestionsPayload(filters, null);
  }

  const rows = await listStoredQuestionRows(user.id, account.id);
  const questions = rows.map(mapQuestionRowToEntity).filter(Boolean);
  const lastSyncAt = await resolveLastSyncAt(user.id, account.id);

  return buildQuestionsPayload(questions, filters, lastSyncAt);
}

async function listQuestions(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    return emptyQuestionsPayload(filters, null);
  }

  const payloadFromDb = await buildQuestionsPayloadForUser(user, account, filters);

  if (payloadFromDb.meta.total > 0) {
    return payloadFromDb;
  }

  try {
    const syncResult = await runAccountSyncWithLifecycle(
      account.id,
      async () => pullAndPersistQuestions(user, account),
      {
        resolveLastSyncAt: (result) => result?.lastSyncAt || null,
      }
    );
    if (syncResult.synced) {
      return buildQuestionsPayloadForUser(user, account, filters);
    }
  } catch (error) {
    // Mantem fallback de listagem pelo banco quando o sync inicial nao for possivel.
  }

  return payloadFromDb;
}

async function getQuestionById(questionId, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  const row = await findStoredQuestionRowByExternalId(user.id, account.id, questionId);

  if (!row || row.dismissedAt) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  return {
    question: buildQuestionDetail(mapQuestionRowToEntity(row)),
    meta: {
      lastSyncAt: await resolveLastSyncAt(user.id, account.id),
      source: "database",
    },
  };
}

async function replyQuestion(questionId, answerText, request = {}) {
  const trimmedAnswer = String(answerText ?? "").trim();

  if (!trimmedAnswer) {
    throw new MercadoLivreQuestionValidationError("Informe a resposta da pergunta.");
  }

  if (trimmedAnswer.length < 8) {
    throw new MercadoLivreQuestionValidationError(
      "A resposta deve ter pelo menos 8 caracteres."
    );
  }

  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    throw new MercadoLivreQuestionValidationError(
      "Nenhuma conta do Mercado Livre encontrada para responder essa pergunta."
    );
  }

  const existingRow = await findStoredQuestionRowByExternalId(user.id, account.id, questionId);

  if (existingRow?.answerText && existingRow?.answeredAtMl) {
    throw new MercadoLivreQuestionValidationError("Essa pergunta ja foi respondida.");
  }

  const accountWithFreshToken = await ensureLiveAccountToken(account);
  const canReplyInLive = await canUseLiveProvider(accountWithFreshToken);

  if (!canReplyInLive) {
    throw new MercadoLivreQuestionValidationError(
      "Nao foi possivel responder na API do Mercado Livre porque nao ha credenciais live ativas."
    );
  }

  const replyResult = await liveProvider.replyQuestion(
    questionId,
    trimmedAnswer,
    buildAccountTokenSource(accountWithFreshToken)
  );
  const tokenState = replyResult?.tokenState || null;

  const syncedAt = new Date();

  if (existingRow) {
    await prisma.mercadoLivreQuestion.update({
      where: {
        id: existingRow.id,
      },
      data: {
        answerText: trimmedAnswer,
        answeredAtMl: syncedAt,
        status: "answered",
        dismissedAt: null,
        lastSyncedAt: syncedAt,
      },
    });
  } else {
    await prisma.mercadoLivreQuestion.create({
      data: {
        userId: user.id,
        marketplaceAccountId: account.id,
        externalQuestionId: String(questionId),
        itemId: "",
        itemTitle: null,
        questionText: "",
        answerText: trimmedAnswer,
        buyerNickname: null,
        thumbnail: null,
        sku: null,
        status: "answered",
        createdAtMl: syncedAt,
        answeredAtMl: syncedAt,
        lastSyncedAt: syncedAt,
      },
    });
  }

  rememberLastSync(user.id, syncedAt.toISOString());
  await prisma.marketplaceAccount.update({
    where: {
      id: account.id,
    },
    data: {
      lastSyncedAt: syncedAt,
      integrationStatus: "connected",
      ...(tokenState
        ? {
            accessToken: tokenState.accessToken || undefined,
            refreshToken: tokenState.refreshToken || undefined,
            tokenType: tokenState.tokenType || undefined,
            scope: tokenState.scope || undefined,
            tokenExpiresAt: ensureDate(tokenState.expiresAt, null) || undefined,
          }
        : {}),
    },
  });

  const updatedRow = await findStoredQuestionRowByExternalId(user.id, account.id, questionId);

  return {
    message: "Resposta enviada com sucesso para o Mercado Livre.",
    question: updatedRow
      ? buildQuestionDetail(mapQuestionRowToEntity(updatedRow))
      : null,
    meta: {
      lastSyncAt: await resolveLastSyncAt(user.id, account.id),
    },
  };
}

async function dismissQuestion(questionId, filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  const row = await findStoredQuestionRowByExternalId(user.id, account.id, questionId);
  if (!row) {
    throw new MercadoLivreQuestionNotFoundError("Pergunta nao encontrada.");
  }

  if (row.dismissedAt) {
    return {
      ...(await buildQuestionsPayloadForUser(user, account, filters)),
      message: "Essa pergunta ja foi removida da lista.",
    };
  }

  if (!row.answerText || !row.answeredAtMl) {
    throw new MercadoLivreQuestionValidationError(
      "So e possivel excluir da lista perguntas ja respondidas."
    );
  }

  await prisma.mercadoLivreQuestion.update({
    where: {
      id: row.id,
    },
    data: {
      dismissedAt: new Date(),
    },
  });

  return {
    ...(await buildQuestionsPayloadForUser(user, account, filters)),
    message: "Pergunta removida da lista visivel.",
  };
}

async function dismissAnsweredQuestions(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    return emptyQuestionsPayload(filters, null);
  }

  const dismissedAt = new Date();
  const result = await prisma.mercadoLivreQuestion.updateMany({
    where: {
      userId: user.id,
      marketplaceAccountId: account.id,
      dismissedAt: null,
      OR: [{ status: "answered" }, { answeredAtMl: { not: null } }],
    },
    data: {
      dismissedAt,
    },
  });

  if (!result.count) {
    return {
      ...(await buildQuestionsPayloadForUser(user, account, filters)),
      message: "Nenhuma pergunta respondida para remover neste recorte.",
    };
  }

  return {
    ...(await buildQuestionsPayloadForUser(user, account, filters)),
    message: `${result.count} pergunta(s) respondida(s) removida(s) da lista.`,
  };
}

async function refreshQuestions(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    return {
      ...emptyQuestionsPayload(filters, null),
      message: "Nenhuma conta do Mercado Livre encontrada.",
    };
  }

  const syncResult = await runAccountSyncWithLifecycle(
    account.id,
    async () => pullAndPersistQuestions(user, account),
    {
      resolveLastSyncAt: (result) => result?.lastSyncAt || null,
    }
  );

  return {
    ...(await buildQuestionsPayloadForUser(user, account, filters)),
    message: syncResult.synced
      ? "Perguntas atualizadas a partir da API do Mercado Livre."
      : "Sem credenciais live ativas. Exibindo dados salvos no banco.",
  };
}

async function syncQuestions(filters = {}, request = {}) {
  const user = await resolveViewerUser(request);

  const account = await resolveMercadoLivreAccount(user.id);
  if (!account) {
    return {
      ...emptyQuestionsPayload(filters, null),
      message: "Nenhuma conta do Mercado Livre encontrada.",
    };
  }

  const syncResult = await runAccountSyncWithLifecycle(
    account.id,
    async () => pullAndPersistQuestions(user, account),
    {
      resolveLastSyncAt: (result) => result?.lastSyncAt || null,
    }
  );

  return {
    ...(await buildQuestionsPayloadForUser(user, account, filters)),
    message: syncResult.synced
      ? "Sincronizacao concluida com a API do Mercado Livre."
      : "Sem credenciais live ativas. Nao foi possivel sincronizar com a API.",
  };
}

module.exports = {
  listQuestions,
  getQuestionById,
  replyQuestion,
  dismissQuestion,
  dismissAnsweredQuestions,
  refreshQuestions,
  syncQuestions,
  pullAndPersistQuestions,
};
