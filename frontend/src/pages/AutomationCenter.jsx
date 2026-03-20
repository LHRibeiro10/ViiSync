import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { getAutomations, toggleAutomationRule } from "../services/api";
import { formatDateTime, formatInteger } from "../utils/presentation";
import "./AutomationCenter.css";

function AutomationCenter() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyRuleId, setBusyRuleId] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadAutomations() {
      try {
        setError("");
        setLoading(true);
        const response = await getAutomations();

        if (!isCancelled) {
          setPayload(response);
        }
      } catch (err) {
        if (!isCancelled) {
          setError("Nao foi possivel carregar as automacoes.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadAutomations();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleToggle(rule) {
    try {
      setBusyRuleId(rule.id);
      setError("");
      const response = await toggleAutomationRule(rule.id, !rule.isEnabled);

      setPayload((currentValue) => ({
        ...currentValue,
        rules: currentValue.rules.map((item) => {
          return item.id === response.rule.id ? response.rule : item;
        }),
        summary: response.summary,
      }));
    } catch (err) {
      setError(err.message || "Nao foi possivel atualizar a regra.");
    } finally {
      setBusyRuleId("");
    }
  }

  if (loading && !payload) {
    return <div className="screen-message">Carregando automacoes...</div>;
  }

  const summary = payload?.summary || {};

  return (
    <div className="automation-page">
      <PageHeader
        tag="Regras"
        title="Central de automacoes"
        description="Regras operacionais para alertar margem critica, pedido atrasado, produto sensivel e risco de integracao."
      />

      {error ? <div className="automation-inline-alert">{error}</div> : null}

      <div className="automation-summary-grid">
        <article className="automation-summary-card">
          <span>Regras totais</span>
          <strong>{formatInteger(summary.total || 0)}</strong>
        </article>
        <article className="automation-summary-card">
          <span>Ativas</span>
          <strong>{formatInteger(summary.enabledCount || 0)}</strong>
        </article>
        <article className="automation-summary-card">
          <span>Em atencao</span>
          <strong>{formatInteger(summary.attentionCount || 0)}</strong>
        </article>
        <article className="automation-summary-card">
          <span>Taxa media de sucesso</span>
          <strong>{formatInteger(summary.successRateAverage || 0)}%</strong>
        </article>
      </div>

      <div className="automation-layout">
        <section className="panel automation-rules-panel">
          <div className="automation-panel-header">
            <div>
              <h2>Regras</h2>
              <p>Ative ou pause as regras que devem operar sobre o negocio.</p>
            </div>
          </div>

          <div className="automation-rule-list">
            {(payload?.rules || []).map((rule) => (
              <article key={rule.id} className={`automation-rule-card is-${rule.status}`}>
                <div className="automation-rule-top">
                  <div>
                    <strong>{rule.name}</strong>
                    <p>{rule.description}</p>
                  </div>
                  <button
                    type="button"
                    className={`automation-toggle ${rule.isEnabled ? "is-enabled" : ""}`}
                    onClick={() => handleToggle(rule)}
                    disabled={busyRuleId === rule.id}
                  >
                    {busyRuleId === rule.id
                      ? "Salvando..."
                      : rule.isEnabled
                        ? "Ativa"
                        : "Pausada"}
                  </button>
                </div>

                <div className="automation-rule-meta">
                  <span>{rule.scope}</span>
                  <span>{rule.triggerLabel}</span>
                  <span>{rule.actionLabel}</span>
                  <span>Sucesso {rule.successRate}%</span>
                </div>

                <div className="automation-rule-footnote">
                  <span>Ultima execucao: {formatDateTime(rule.lastRunAt)}</span>
                  <span>Proxima: {formatDateTime(rule.nextRunAt)}</span>
                </div>
                <p className="automation-rule-impact">{rule.impactNote}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel automation-executions-panel">
          <div className="automation-panel-header">
            <div>
              <h2>Execucoes recentes</h2>
              <p>Ultimas leituras disparadas pelas regras operacionais.</p>
            </div>
          </div>

          <div className="automation-execution-list">
            {(payload?.executions || []).map((execution) => (
              <article key={execution.id} className="automation-execution-card">
                <strong>{execution.ruleName}</strong>
                <span>{formatDateTime(execution.executedAt)}</span>
                <p>{execution.note}</p>
                <div className={`automation-execution-badge is-${execution.result}`}>
                  {execution.result}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AutomationCenter;
