import {
  ML_QUESTION_PERIOD_OPTIONS,
  ML_QUESTION_SORT_OPTIONS,
  ML_QUESTION_STATUS_OPTIONS,
  formatAverageResponse,
  formatResponseRate,
} from "../../utils/mercadoLivreQuestions";

function MercadoLivreQuestionFilters({
  filters,
  searchTerm,
  meta,
  isRefreshing,
  onSearchChange,
  onFilterChange,
  onClearFilters,
}) {
  const overview = meta?.overview || {
    total: 0,
    answered: 0,
    unanswered: 0,
    urgent: 0,
    averageResponseHours: 0,
    responseRate: 0,
  };
  const announcements = meta?.availableAnnouncements || [];
  const isClearDisabled =
    filters.status === "all" &&
    filters.itemId === "all" &&
    filters.period === "30d" &&
    filters.sort === "recent" &&
    searchTerm.trim().length === 0;

  return (
    <section className="panel ml-questions-filters-panel">
      <div className="ml-questions-filters-head">
        <div>
          <h2>Filtros e fila operacional</h2>
          <p>
            Taxa de resposta em {formatResponseRate(overview.responseRate)} e tempo
            medio de resposta em {formatAverageResponse(overview.averageResponseHours)}.
          </p>
        </div>

        <div className="ml-questions-status-pills" role="tablist" aria-label="Status">
          {ML_QUESTION_STATUS_OPTIONS.map((option) => {
            const countByStatus =
              option.value === "all"
                ? overview.total
                : option.value === "unanswered"
                  ? overview.unanswered
                  : overview.answered;

            return (
              <button
                key={option.value}
                type="button"
                className={`ml-questions-status-pill ${
                  filters.status === option.value ? "is-active" : ""
                }`}
                onClick={() => onFilterChange("status", option.value)}
                aria-pressed={filters.status === option.value}
              >
                <span>{option.label}</span>
                <strong>{countByStatus}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ml-questions-filter-grid">
        <label className="ml-questions-filter-field ml-questions-filter-search">
          <span>Busca textual</span>
          <input
            type="search"
            placeholder="Pergunta, anuncio, item_id, comprador ou SKU"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <label className="ml-questions-filter-field">
          <span>Anuncio</span>
          <select
            value={filters.itemId}
            onChange={(event) => onFilterChange("itemId", event.target.value)}
          >
            <option value="all">Todos os anuncios</option>
            {announcements.map((announcement) => (
              <option key={announcement.itemId} value={announcement.itemId}>
                {announcement.itemTitle}
              </option>
            ))}
          </select>
        </label>

        <label className="ml-questions-filter-field">
          <span>Periodo</span>
          <select
            value={filters.period}
            onChange={(event) => onFilterChange("period", event.target.value)}
          >
            {ML_QUESTION_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="ml-questions-filter-field">
          <span>Ordenar por</span>
          <select
            value={filters.sort}
            onChange={(event) => onFilterChange("sort", event.target.value)}
          >
            {ML_QUESTION_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="ml-questions-clear-button"
          onClick={onClearFilters}
          disabled={isClearDisabled}
        >
          Limpar filtros
        </button>
      </div>

      {isRefreshing ? (
        <div className="ml-questions-inline-status">
          Atualizando a caixa de perguntas do Mercado Livre...
        </div>
      ) : null}
    </section>
  );
}

export default MercadoLivreQuestionFilters;
