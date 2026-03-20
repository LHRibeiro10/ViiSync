import { useEffect, useMemo, useState } from "react";
import { getAdminFeedbacks, updateAdminFeedbackStatus } from "../services/api";
import {
  feedbackPriorityOptions,
  feedbackStatusOptions,
  feedbackTypeOptions,
  formatFeedbackDateTime,
  formatFeedbackRelativeTime,
} from "../utils/feedback";
import "./AdminFeedbackInbox.css";

function AdminFeedbackInbox() {
  const [payload, setPayload] = useState(null);
  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
    priority: "all",
    search: "",
  });
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadInbox() {
      try {
        setError("");
        setLoading(true);
        const response = await getAdminFeedbacks(filters);

        if (isCancelled) {
          return;
        }

        setPayload(response);
        setSelectedId((currentValue) => {
          if (response.items.some((item) => item.id === currentValue)) {
            return currentValue;
          }

          return response.items[0]?.id || "";
        });
      } catch (err) {
        if (!isCancelled) {
          setError("Nao foi possivel carregar a inbox administrativa.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadInbox();

    return () => {
      isCancelled = true;
    };
  }, [filters]);

  const selectedItem = useMemo(() => {
    return payload?.items?.find((item) => item.id === selectedId) || null;
  }, [payload, selectedId]);

  const summaryCards = useMemo(() => {
    return [
      {
        id: "admin-feedback-open",
        label: "Tickets abertos",
        value: payload?.meta?.openCount || 0,
      },
      {
        id: "admin-feedback-new",
        label: "Novos",
        value: payload?.meta?.newCount || 0,
      },
      {
        id: "admin-feedback-high",
        label: "Prioridade alta",
        value: payload?.meta?.highPriorityCount || 0,
      },
      {
        id: "admin-feedback-resolved",
        label: "Resolvidos",
        value: payload?.meta?.resolvedCount || 0,
      },
    ];
  }, [payload]);

  async function handleStatusChange(nextStatus) {
    if (!selectedItem || selectedItem.status === nextStatus) {
      return;
    }

    try {
      setUpdating(true);
      setError("");

      const response = await updateAdminFeedbackStatus(
        selectedItem.id,
        nextStatus,
        statusNote
      );

      setPayload((currentValue) => {
        if (!currentValue) {
          return currentValue;
        }

        return {
          ...currentValue,
          items: currentValue.items.map((item) => {
            return item.id === response.item.id ? response.item : item;
          }),
          meta: {
            ...currentValue.meta,
            ...response.meta,
          },
        };
      });
      setStatusNote("");
    } catch (err) {
      setError(err.message || "Nao foi possivel atualizar o status do ticket.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="admin-feedback-page">
      <header className="admin-feedback-hero">
        <div>
          <span className="admin-feedback-tag">Suporte interno</span>
          <h1>Inbox de feedbacks e reclamacoes</h1>
          <p>
            Centralize bugs, ideias e reclamacoes vindas do seller em uma fila pronta
            para triagem, resposta e priorizacao.
          </p>
        </div>

        <div className="admin-feedback-hero-meta">
          <span>{payload?.meta?.filteredTotal || 0} item(ns) visiveis</span>
          <span>Ultimo envio: {formatFeedbackDateTime(payload?.meta?.latestAt)}</span>
        </div>
      </header>

      <section className="admin-feedback-summary-grid">
        {summaryCards.map((card) => (
          <article key={card.id} className="admin-feedback-summary-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-feedback-filter-bar">
        <input
          type="search"
          value={filters.search}
          placeholder="Buscar por assunto, empresa ou conteudo"
          onChange={(event) =>
            setFilters((currentValue) => ({
              ...currentValue,
              search: event.target.value,
            }))
          }
        />

        <select
          value={filters.status}
          onChange={(event) =>
            setFilters((currentValue) => ({
              ...currentValue,
              status: event.target.value,
            }))
          }
        >
          {feedbackStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(event) =>
            setFilters((currentValue) => ({
              ...currentValue,
              type: event.target.value,
            }))
          }
        >
          <option value="all">Todos os tipos</option>
          {feedbackTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={filters.priority}
          onChange={(event) =>
            setFilters((currentValue) => ({
              ...currentValue,
              priority: event.target.value,
            }))
          }
        >
          {feedbackPriorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      {error ? <div className="admin-feedback-inline-alert">{error}</div> : null}

      <div className="admin-feedback-grid">
        <section className="admin-feedback-list-panel">
          {loading ? (
            <div className="admin-feedback-empty-state">
              <strong>Carregando inbox...</strong>
            </div>
          ) : payload?.items?.length ? (
            <div className="admin-feedback-list">
              {payload.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-feedback-list-item ${
                    selectedId === item.id ? "is-selected" : ""
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="admin-feedback-list-topline">
                    <div className="admin-feedback-badge-row">
                      <span className={`admin-feedback-badge is-${item.priorityTone}`}>
                        {item.priorityLabel}
                      </span>
                      <span className={`admin-feedback-badge is-${item.statusTone}`}>
                        {item.statusLabel}
                      </span>
                    </div>
                    <small>{formatFeedbackRelativeTime(item.createdAt)}</small>
                  </div>

                  <strong>{item.subject}</strong>
                  <p>{item.message}</p>

                  <div className="admin-feedback-list-meta">
                    <span>{item.submittedBy.company}</span>
                    <span>{item.typeLabel}</span>
                    <span>{item.areaLabel}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="admin-feedback-empty-state">
              <strong>Nenhum ticket encontrado</strong>
              <p>Altere os filtros ou aguarde novos envios vindos do seller.</p>
            </div>
          )}
        </section>

        <section className="admin-feedback-detail-panel">
          {selectedItem ? (
            <>
              <div className="admin-feedback-detail-header">
                <div className="admin-feedback-badge-row">
                  <span className={`admin-feedback-badge is-${selectedItem.priorityTone}`}>
                    {selectedItem.priorityLabel}
                  </span>
                  <span className={`admin-feedback-badge is-${selectedItem.statusTone}`}>
                    {selectedItem.statusLabel}
                  </span>
                </div>
                <span>{selectedItem.id}</span>
              </div>

              <h2>{selectedItem.subject}</h2>
              <p className="admin-feedback-detail-copy">{selectedItem.message}</p>

              <div className="admin-feedback-detail-meta">
                <div>
                  <span>Empresa</span>
                  <strong>{selectedItem.submittedBy.company}</strong>
                </div>
                <div>
                  <span>Contato</span>
                  <strong>{selectedItem.submittedBy.name}</strong>
                </div>
                <div>
                  <span>Area</span>
                  <strong>{selectedItem.areaLabel}</strong>
                </div>
                <div>
                  <span>Abertura</span>
                  <strong>{formatFeedbackDateTime(selectedItem.createdAt)}</strong>
                </div>
              </div>

              <div className="admin-feedback-status-actions">
                {feedbackStatusOptions
                  .filter((option) => option.value !== "all")
                  .map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={selectedItem.status === option.value ? "is-active" : ""}
                      disabled={updating}
                      onClick={() => handleStatusChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
              </div>

              <label className="admin-feedback-note-field">
                <span>Nota interna</span>
                <textarea
                  value={statusNote}
                  placeholder="Opcional: registre o motivo da mudanca de status."
                  onChange={(event) => setStatusNote(event.target.value)}
                />
              </label>

              <div className="admin-feedback-history">
                <h3>Historico</h3>
                <div className="admin-feedback-history-list">
                  {selectedItem.history.map((entry) => (
                    <article key={entry.id} className="admin-feedback-history-item">
                      <div className="admin-feedback-history-dot" />
                      <div>
                        <strong>{entry.statusLabel}</strong>
                        <span>{formatFeedbackDateTime(entry.createdAt)}</span>
                        <p>{entry.note}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="admin-feedback-empty-state">
              <strong>Selecione um ticket</strong>
              <p>Abra um item da lista para ver detalhes e mover o status.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminFeedbackInbox;
