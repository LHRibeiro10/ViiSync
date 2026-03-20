import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { getOperationalCalendar } from "../services/api";
import { formatDate } from "../utils/presentation";
import "./OperationsCalendar.css";

function OperationsCalendar() {
  const [payload, setPayload] = useState(null);
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadCalendar() {
      try {
        setError("");
        setLoading(true);
        const response = await getOperationalCalendar(filters);

        if (!isCancelled) {
          setPayload(response);
        }
      } catch (err) {
        if (!isCancelled) {
          setError("Nao foi possivel carregar o calendario operacional.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadCalendar();

    return () => {
      isCancelled = true;
    };
  }, [filters]);

  if (loading && !payload) {
    return <div className="screen-message">Carregando calendario operacional...</div>;
  }

  return (
    <div className="calendar-page">
      <PageHeader
        tag="Rotina"
        title="Calendario operacional"
        description="Centralize vencimentos, repasses, campanhas, tarefas e lembretes em uma fila organizada."
      />

      <div className="calendar-summary-grid">
        <article className="calendar-summary-card">
          <span>Total de eventos</span>
          <strong>{payload?.meta?.total || 0}</strong>
        </article>
        <article className="calendar-summary-card">
          <span>Visiveis agora</span>
          <strong>{payload?.meta?.filteredTotal || 0}</strong>
        </article>
        <article className="calendar-summary-card">
          <span>Proximos</span>
          <strong>{payload?.meta?.upcomingCount || 0}</strong>
        </article>
        <article className="calendar-summary-card">
          <span>Pedem atencao</span>
          <strong>{payload?.meta?.attentionCount || 0}</strong>
        </article>
      </div>

      <section className="panel calendar-filter-panel">
        <div className="calendar-filter-grid">
          <label>
            <span>Tipo</span>
            <select
              value={filters.type}
              onChange={(event) =>
                setFilters((currentValue) => ({
                  ...currentValue,
                  type: event.target.value,
                }))
              }
            >
              <option value="all">Todos</option>
              <option value="repasse">Repasses</option>
              <option value="campanha">Campanhas</option>
              <option value="tarefa">Tarefas</option>
              <option value="vencimento">Vencimentos</option>
              <option value="lembrete">Lembretes</option>
            </select>
          </label>

          <label>
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((currentValue) => ({
                  ...currentValue,
                  status: event.target.value,
                }))
              }
            >
              <option value="all">Todos</option>
              <option value="upcoming">Proximos</option>
              <option value="attention">Atencao</option>
              <option value="scheduled">Agendados</option>
            </select>
          </label>
        </div>
      </section>

      {error ? <div className="calendar-inline-alert">{error}</div> : null}

      <section className="panel calendar-list-panel">
        {payload?.items?.length ? (
          <div className="calendar-list">
            {payload.items.map((item) => (
              <article key={item.id} className={`calendar-item is-${item.status}`}>
                <div className="calendar-item-top">
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <span className="calendar-item-badge">{item.type}</span>
                </div>

                <div className="calendar-item-meta">
                  <span>{formatDate(item.date)}</span>
                  <span>{item.owner}</span>
                  <span>{item.marketplace}</span>
                  <span>{item.status}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="calendar-empty-state">
            <strong>Nenhum evento no recorte atual</strong>
            <p>Altere os filtros para visualizar outros compromissos operacionais.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default OperationsCalendar;
