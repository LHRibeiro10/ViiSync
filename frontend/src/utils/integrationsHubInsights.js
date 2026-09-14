function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getAccountOperationalSignals(account) {
  const tokenStatus = normalizeText(account?.tokenStatus);
  const queueBacklog = Number(account?.queueBacklog || 0);
  const reconnectRecommended = Boolean(account?.reconnectRecommended);
  const tokenExpired = tokenStatus.includes("expirado");
  const tokenExpiringSoon = tokenStatus.includes("expira em breve");
  const syncStatus = normalizeText(account?.syncStatus);
  const syncWithError = syncStatus === "error" || Boolean(account?.syncLastError);
  const queueHigh = queueBacklog >= 5;
  const queuePending = queueBacklog > 0;

  let tone = "stable";
  if (reconnectRecommended || tokenExpired || syncWithError || queueHigh) {
    tone = "critical";
  } else if (tokenExpiringSoon || queuePending) {
    tone = "attention";
  }

  const chips = [];
  if (reconnectRecommended || tokenExpired) {
    chips.push({
      id: "reauthorize",
      label: "Reautorizacao necessaria",
      tone: "critical",
    });
  } else if (tokenExpiringSoon) {
    chips.push({
      id: "token-expiring",
      label: "Token expira em breve",
      tone: "attention",
    });
  }

  if (syncWithError) {
    chips.push({
      id: "sync-error",
      label: "Falha de sincronizacao",
      tone: "critical",
    });
  }

  if (queueHigh) {
    chips.push({
      id: "queue-high",
      label: `Fila alta: ${queueBacklog} evento(s)`,
      tone: "critical",
    });
  } else if (queuePending) {
    chips.push({
      id: "queue-pending",
      label: `Fila pendente: ${queueBacklog} evento(s)`,
      tone: "attention",
    });
  }

  if (!chips.length) {
    chips.push({
      id: "stable",
      label: "Operacao estavel",
      tone: "success",
    });
  }

  let nextStep = "Manter monitoramento diario da conta conectada.";
  if (reconnectRecommended || tokenExpired) {
    nextStep = "Reautorize via OAuth e valide o status como Conectado.";
  } else if (tokenExpiringSoon) {
    nextStep = "Renove o token preventivamente para evitar bloqueio da sincronizacao.";
  } else if (syncWithError) {
    nextStep = "Execute sincronizacao agora e valide o ultimo erro registrado.";
  } else if (queuePending) {
    nextStep = "Processe a fila manualmente para reduzir pendencias operacionais.";
  }

  return {
    tone,
    chips,
    nextStep,
    flags: {
      reconnectRecommended,
      tokenExpired,
      tokenExpiringSoon,
      queuePending,
      queueHigh,
      syncWithError,
    },
  };
}

function buildActionQueueItem(action) {
  const id = normalizeText(action?.id);
  const cta = String(action?.cta || "Executar");
  let priorityTone = "attention";
  let priorityLabel = "Prioridade media";
  let sortOrder = 2;
  let nextStep = `Executar "${cta}" e confirmar o status operacional apos a acao.`;
  let expectedResult = "Pendencia tratada e status atualizado.";
  let actionable = true;

  if (id.includes("reconnect") || id.includes("connect-first-account")) {
    priorityTone = "critical";
    priorityLabel = "Prioridade alta";
    sortOrder = 0;
    nextStep = "Concluir reautorizacao OAuth da conta e validar retorno da sincronizacao.";
    expectedResult = "Conta com credenciais validas e fila liberada para sincronizar.";
  } else if (id.includes("review-questions")) {
    priorityTone = "attention";
    priorityLabel = "Prioridade media";
    sortOrder = 1;
    nextStep = "Abrir Perguntas ML e responder pendencias mais antigas primeiro.";
    expectedResult = "SLA operacional preservado e queda de pendencias na inbox.";
  } else if (id.includes("all-good")) {
    priorityTone = "success";
    priorityLabel = "Prioridade baixa";
    sortOrder = 3;
    nextStep = "Nenhuma acao imediata. Mantenha monitoramento e sincronizacao de rotina.";
    expectedResult = "Operacao estavel sem pendencias criticas.";
    actionable = false;
  }

  return {
    ...action,
    priorityTone,
    priorityLabel,
    sortOrder,
    nextStep,
    expectedResult,
    actionable,
    ctaLabel: actionable ? cta : "Sem acao pendente",
  };
}

function buildSyncEventItem(event, accountsById) {
  const accountId = String(event?.id || "").replace(/^event-/, "");
  const account = accountsById.get(accountId);
  const signals = account ? getAccountOperationalSignals(account) : null;
  const tone = signals?.tone || "neutral";

  let statusCopy = "Sem alerta critico neste checkpoint.";
  let recommendation = "Mantenha monitoramento da integracao e da fila de eventos.";

  if (signals?.flags.reconnectRecommended || signals?.flags.tokenExpired) {
    statusCopy = "Credenciais em risco de bloqueio. Reautorizacao recomendada.";
    recommendation = "Execute reautorizacao OAuth para manter seguranca e continuidade da conta.";
  } else if (signals?.flags.tokenExpiringSoon) {
    statusCopy = "Token em janela de expiracao curta.";
    recommendation = "Renove o token preventivamente para evitar interrupcao.";
  } else if (signals?.flags.syncWithError) {
    statusCopy = "Ultima sincronizacao registrou falha.";
    recommendation = "Rodar nova sincronizacao e validar erro retornado pelo canal.";
  } else if (signals?.flags.queuePending) {
    statusCopy = `Fila com ${account.queueBacklog} evento(s) pendente(s).`;
    recommendation = "Processar backlog para manter visibilidade operacional em dia.";
  }

  return {
    ...event,
    tone,
    statusCopy,
    recommendation,
    syncStatusLabel: account?.syncStatusLabel || "Sem status registrado",
  };
}

export { getAccountOperationalSignals, buildActionQueueItem, buildSyncEventItem };
