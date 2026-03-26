const prisma = require("../../lib/prisma");
const {
  syncMarketplaceDataByAccountId,
} = require("./mercadolivreQuestions.service");
const liveProvider = require("./mercadolivreQuestions.live.service");

const DEFAULT_INTERVAL_MS = 1000 * 60 * 30;
const DEFAULT_STARTUP_DELAY_MS = 1000 * 20;

let intervalHandle = null;
let startupHandle = null;
let cycleInProgress = false;

function normalizeFlag(value) {
  return String(value || "").trim().toLowerCase();
}

function parseDurationFromEnv(name, fallbackMs, minMs) {
  const parsed = Number(process.env[name]);

  if (!Number.isFinite(parsed) || parsed < minMs) {
    return fallbackMs;
  }

  return parsed;
}

function resolveAutoSyncRuntimeState() {
  const currentMode = normalizeFlag(liveProvider.mode());

  if (currentMode === "mock") {
    return {
      enabled: false,
      reason: "mock-mode",
    };
  }

  if (!liveProvider.hasLiveCredentials()) {
    return {
      enabled: false,
      reason: "missing-live-credentials",
    };
  }

  return {
    enabled: true,
    reason: null,
  };
}

async function fetchEligibleAccounts() {
  return prisma.marketplaceAccount.findMany({
    where: {
      autoSyncEnabled: true,
      isActive: true,
      integrationStatus: "connected",
      AND: [
        {
          sellerId: {
            not: null,
          },
        },
        {
          sellerId: {
            not: "",
          },
        },
        {
          OR: [
            {
              marketplace: {
                contains: "mercado livre",
                mode: "insensitive",
              },
            },
            {
              marketplace: {
                contains: "mercadolivre",
                mode: "insensitive",
              },
            },
          ],
        },
        {
          OR: [
            {
              AND: [
                { accessToken: { not: null } },
                { accessToken: { not: "" } },
              ],
            },
            {
              AND: [
                { refreshToken: { not: null } },
                { refreshToken: { not: "" } },
              ],
            },
          ],
        },
      ],
    },
    orderBy: {
      updatedAt: "asc",
    },
    select: {
      id: true,
    },
  });
}

async function runAutoSyncCycle(trigger = "interval") {
  const runtimeState = resolveAutoSyncRuntimeState();
  if (!runtimeState.enabled) {
    return {
      trigger,
      skipped: true,
      reason: runtimeState.reason,
    };
  }

  if (cycleInProgress) {
    return {
      trigger,
      skipped: true,
      reason: "cycle-in-progress",
    };
  }

  cycleInProgress = true;

  try {
    const accounts = await fetchEligibleAccounts();
    let syncedCount = 0;
    let failedCount = 0;
    let busyCount = 0;

    for (const account of accounts) {
      try {
        await syncMarketplaceDataByAccountId(account.id, {
          trigger: "auto",
          period: "30d",
        });
        syncedCount += 1;
      } catch (error) {
        if (error?.status === 409) {
          busyCount += 1;
          continue;
        }

        failedCount += 1;
        console.error(
          `[mercadolivre-auto-sync:${trigger}] Falha ao sincronizar conta ${account.id}`,
          error
        );
      }
    }

    return {
      trigger,
      skipped: false,
      syncedCount,
      failedCount,
      busyCount,
      totalAccounts: accounts.length,
    };
  } finally {
    cycleInProgress = false;
  }
}

function startMercadoLivreAutoSyncScheduler() {
  const disabled = ["1", "true", "yes", "on"].includes(
    normalizeFlag(process.env.MERCADOLIVRE_AUTO_SYNC_DISABLED)
  );

  if (disabled) {
    console.log("[mercadolivre-auto-sync] Scheduler desabilitado por ambiente.");
    return {
      enabled: false,
      intervalMs: null,
    };
  }

  const runtimeState = resolveAutoSyncRuntimeState();
  if (!runtimeState.enabled) {
    console.log(
      `[mercadolivre-auto-sync] Scheduler nao iniciado (${runtimeState.reason}).`
    );
    return {
      enabled: false,
      intervalMs: null,
    };
  }

  if (intervalHandle) {
    return {
      enabled: true,
      intervalMs: parseDurationFromEnv(
        "MERCADOLIVRE_AUTO_SYNC_INTERVAL_MS",
        DEFAULT_INTERVAL_MS,
        1000 * 60
      ),
    };
  }

  const intervalMs = parseDurationFromEnv(
    "MERCADOLIVRE_AUTO_SYNC_INTERVAL_MS",
    DEFAULT_INTERVAL_MS,
    1000 * 60
  );
  const startupDelayMs = parseDurationFromEnv(
    "MERCADOLIVRE_AUTO_SYNC_STARTUP_DELAY_MS",
    DEFAULT_STARTUP_DELAY_MS,
    1000
  );

  startupHandle = setTimeout(() => {
    runAutoSyncCycle("startup").catch((error) => {
      console.error("[mercadolivre-auto-sync:startup]", error);
    });
  }, startupDelayMs);

  intervalHandle = setInterval(() => {
    runAutoSyncCycle("interval").catch((error) => {
      console.error("[mercadolivre-auto-sync:interval]", error);
    });
  }, intervalMs);

  if (typeof intervalHandle.unref === "function") {
    intervalHandle.unref();
  }

  if (startupHandle && typeof startupHandle.unref === "function") {
    startupHandle.unref();
  }

  console.log(
    `[mercadolivre-auto-sync] Scheduler iniciado. Intervalo: ${Math.round(
      intervalMs / (1000 * 60)
    )} minuto(s).`
  );

  return {
    enabled: true,
    intervalMs,
  };
}

function stopMercadoLivreAutoSyncScheduler() {
  if (startupHandle) {
    clearTimeout(startupHandle);
    startupHandle = null;
  }

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  runAutoSyncCycle,
  startMercadoLivreAutoSyncScheduler,
  stopMercadoLivreAutoSyncScheduler,
};
