const {
  automationExecutions,
  automationRulesSeed,
  calendarEvents,
} = require("../../../data/mockSellerWorkspaceData");
const { ENABLE_WORKSPACE_DEMO_DATA, cloneData, createHttpError } = require("./shared");

let automationStore = cloneData(automationRulesSeed);

function getOperationalCalendar(filters = {}) {
  if (!ENABLE_WORKSPACE_DEMO_DATA) {
    return {
      meta: {
        total: 0,
        filteredTotal: 0,
        upcomingCount: 0,
        attentionCount: 0,
      },
      items: [],
    };
  }

  const type = String(filters.type ?? "all");
  const status = String(filters.status ?? "all");

  const items = calendarEvents.filter((event) => {
    if (type !== "all" && event.type !== type) {
      return false;
    }

    if (status !== "all" && event.status !== status) {
      return false;
    }

    return true;
  });

  return {
    meta: {
      total: calendarEvents.length,
      filteredTotal: items.length,
      upcomingCount: calendarEvents.filter((event) => event.status === "upcoming").length,
      attentionCount: calendarEvents.filter((event) => event.status === "attention").length,
    },
    items: cloneData(items),
  };
}

function buildAutomationSummary(items) {
  return {
    total: items.length,
    enabledCount: items.filter((item) => item.isEnabled).length,
    attentionCount: items.filter((item) => item.status === "attention").length,
    successRateAverage:
      items.length > 0
        ? Math.round(
            items.reduce((accumulator, item) => accumulator + item.successRate, 0) /
              items.length
          )
        : 0,
  };
}

function getAutomations() {
  if (!ENABLE_WORKSPACE_DEMO_DATA) {
    return {
      summary: {
        total: 0,
        enabledCount: 0,
        attentionCount: 0,
        successRateAverage: 0,
      },
      rules: [],
      executions: [],
    };
  }

  return {
    summary: buildAutomationSummary(automationStore),
    rules: cloneData(automationStore),
    executions: cloneData(automationExecutions),
  };
}

function toggleAutomationRule(ruleId, enabled) {
  if (!ENABLE_WORKSPACE_DEMO_DATA) {
    throw createHttpError(
      503,
      "As automacoes avancadas nao estao habilitadas neste ambiente."
    );
  }

  const index = automationStore.findIndex((item) => item.id === ruleId);

  if (index === -1) {
    throw createHttpError(404, "Regra de automacao nao encontrada.");
  }

  const currentRule = automationStore[index];
  const nextEnabled = typeof enabled === "boolean" ? enabled : !currentRule.isEnabled;

  automationStore[index] = {
    ...currentRule,
    isEnabled: nextEnabled,
    status: nextEnabled ? currentRule.status : "healthy",
  };

  return {
    rule: cloneData(automationStore[index]),
    summary: buildAutomationSummary(automationStore),
  };
}

module.exports = {
  getOperationalCalendar,
  getAutomations,
  toggleAutomationRule,
};
