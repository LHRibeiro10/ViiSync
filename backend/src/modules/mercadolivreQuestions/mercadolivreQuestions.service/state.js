const { randomUUID } = require("crypto");

const prisma = require("../../../lib/prisma");
const { createHttpError, normalizeText, ensureDate, cloneData } = require("./primitives");

const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const DEFAULT_SYNC_LOCK_STALE_MS = 1000 * 60 * 60;
const SYNC_ERROR_MAX_LENGTH = 500;

const SYNC_STATUS = Object.freeze({
  IDLE: "idle",
  SYNCING: "syncing",
  SUCCESS: "success",
  ERROR: "error",
});
const SYNC_STATUS_LABELS = Object.freeze({
  [SYNC_STATUS.IDLE]: "Aguardando",
  [SYNC_STATUS.SYNCING]: "Sincronizando",
  [SYNC_STATUS.SUCCESS]: "Sucesso",
  [SYNC_STATUS.ERROR]: "Erro",
});

// Estado mutavel em memoria, valido para o tempo de vida do processo.
// Estes sao os unicos donos das variaveis abaixo -- nenhum outro modulo deve
// declarar Maps equivalentes, ou o lock/cache/ring-buffer deixa de ser confiavel.
const webhookEvents = [];
const lastSyncByUserId = new Map();
const oauthStateStore = new Map();
const syncLocksByAccountId = new Map();

function normalizeSyncStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  return Object.values(SYNC_STATUS).includes(normalized)
    ? normalized
    : SYNC_STATUS.IDLE;
}

function getSyncStatusLabel(value) {
  const status = normalizeSyncStatus(value);
  return SYNC_STATUS_LABELS[status] || SYNC_STATUS_LABELS[SYNC_STATUS.IDLE];
}

function truncateSyncErrorMessage(message) {
  const normalized = normalizeText(message);

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, SYNC_ERROR_MAX_LENGTH);
}

function sanitizeSyncErrorMessage(error) {
  if (!error) {
    return null;
  }

  return truncateSyncErrorMessage(
    error?.message || "Falha ao sincronizar com o Mercado Livre."
  );
}

function resolveSyncLockStaleMs() {
  const parsed = Number(process.env.MERCADOLIVRE_SYNC_LOCK_STALE_MS);

  if (!Number.isFinite(parsed) || parsed < 1000 * 60) {
    return DEFAULT_SYNC_LOCK_STALE_MS;
  }

  return parsed;
}

function cleanupExpiredSyncLocks(nowMs = Date.now()) {
  const staleMs = resolveSyncLockStaleMs();

  for (const [accountId, startedAtMs] of syncLocksByAccountId.entries()) {
    if (!Number.isFinite(startedAtMs) || nowMs - startedAtMs >= staleMs) {
      syncLocksByAccountId.delete(accountId);
    }
  }
}

function acquireInMemorySyncLock(accountId) {
  const lockKey = normalizeText(accountId);

  if (!lockKey) {
    throw createHttpError(400, "Conta Mercado Livre invalida para sincronizacao.");
  }

  cleanupExpiredSyncLocks();

  if (syncLocksByAccountId.has(lockKey)) {
    throw createHttpError(
      409,
      "Ja existe uma sincronizacao em andamento para essa conta do Mercado Livre."
    );
  }

  syncLocksByAccountId.set(lockKey, Date.now());
  return lockKey;
}

function releaseInMemorySyncLock(lockKey) {
  const normalized = normalizeText(lockKey);
  if (!normalized) {
    return;
  }

  syncLocksByAccountId.delete(normalized);
}

async function beginAccountSyncLifecycle(accountId) {
  const now = new Date();
  const staleReference = new Date(now.getTime() - resolveSyncLockStaleMs());

  const updateResult = await prisma.marketplaceAccount.updateMany({
    where: {
      id: accountId,
      OR: [
        { syncStatus: { not: SYNC_STATUS.SYNCING } },
        { syncLastStartedAt: null },
        { syncLastStartedAt: { lte: staleReference } },
      ],
    },
    data: {
      syncStatus: SYNC_STATUS.SYNCING,
      syncLastStartedAt: now,
      syncLastError: null,
    },
  });

  if (!updateResult.count) {
    throw createHttpError(
      409,
      "Ja existe uma sincronizacao em andamento para essa conta do Mercado Livre."
    );
  }

  return now;
}

async function markAccountSyncSuccess(accountId, lastSyncAt = null) {
  const finishedAt = new Date();
  const parsedLastSyncAt = ensureDate(lastSyncAt, null);

  await prisma.marketplaceAccount.update({
    where: {
      id: accountId,
    },
    data: {
      syncStatus: SYNC_STATUS.SUCCESS,
      syncLastFinishedAt: finishedAt,
      syncLastError: null,
      ...(parsedLastSyncAt ? { lastSyncedAt: parsedLastSyncAt } : {}),
    },
  });
}

async function markAccountSyncError(accountId, error) {
  await prisma.marketplaceAccount.update({
    where: {
      id: accountId,
    },
    data: {
      syncStatus: SYNC_STATUS.ERROR,
      syncLastFinishedAt: new Date(),
      syncLastError: sanitizeSyncErrorMessage(error),
    },
  });
}

async function runAccountSyncWithLifecycle(accountId, syncTask, options = {}) {
  const lockKey = acquireInMemorySyncLock(accountId);
  let lifecycleStarted = false;

  try {
    await beginAccountSyncLifecycle(accountId);
    lifecycleStarted = true;

    const result = await syncTask();
    const resolvedLastSyncAt = options?.resolveLastSyncAt
      ? options.resolveLastSyncAt(result)
      : null;

    await markAccountSyncSuccess(accountId, resolvedLastSyncAt);
    return result;
  } catch (error) {
    if (lifecycleStarted) {
      try {
        await markAccountSyncError(accountId, error);
      } catch (statusError) {
        console.error("[mercadolivre-questions:sync-status:error]", statusError);
      }
    }

    throw error;
  } finally {
    releaseInMemorySyncLock(lockKey);
  }
}

function cleanupExpiredOAuthStates(now = Date.now()) {
  for (const [state, payload] of oauthStateStore.entries()) {
    if (!payload?.expiresAtMs || payload.expiresAtMs <= now) {
      oauthStateStore.delete(state);
    }
  }
}

function createOAuthStatePayload(userId, account = null) {
  const state = randomUUID();
  const createdAtMs = Date.now();
  const expiresAtMs = createdAtMs + OAUTH_STATE_TTL_MS;

  oauthStateStore.set(state, {
    userId: String(userId),
    accountId: account?.id || null,
    accountName: account?.accountName || null,
    createdAtMs,
    expiresAtMs,
  });

  cleanupExpiredOAuthStates(createdAtMs);

  return {
    state,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

function consumeOAuthStatePayload(state) {
  const key = normalizeText(state);

  if (!key) {
    return null;
  }

  cleanupExpiredOAuthStates();

  const payload = oauthStateStore.get(key) || null;

  if (!payload) {
    return null;
  }

  oauthStateStore.delete(key);
  return payload;
}

function rememberLastSync(userId, lastSyncAt) {
  if (!userId || !lastSyncAt) {
    return;
  }

  lastSyncByUserId.set(userId, String(lastSyncAt));
}

async function resolveLastSyncAt(userId, marketplaceAccountId) {
  if (!userId || !marketplaceAccountId) {
    return null;
  }

  const fromMemory = lastSyncByUserId.get(userId);
  if (fromMemory) {
    return fromMemory;
  }

  const latest = await prisma.mercadoLivreQuestion.findFirst({
    where: {
      userId,
      marketplaceAccountId,
    },
    orderBy: {
      lastSyncedAt: "desc",
    },
    select: {
      lastSyncedAt: true,
    },
  });

  if (!latest?.lastSyncedAt) {
    return null;
  }

  return latest.lastSyncedAt.toISOString();
}

function recordWebhookEvent(event) {
  webhookEvents.unshift(event);

  if (webhookEvents.length > 20) {
    webhookEvents.length = 20;
  }
}

function getRecentWebhookEvents(limit) {
  return cloneData(webhookEvents.slice(0, limit));
}

module.exports = {
  SYNC_STATUS,
  SYNC_STATUS_LABELS,
  normalizeSyncStatus,
  getSyncStatusLabel,
  runAccountSyncWithLifecycle,
  createOAuthStatePayload,
  consumeOAuthStatePayload,
  rememberLastSync,
  resolveLastSyncAt,
  recordWebhookEvent,
  getRecentWebhookEvents,
};
