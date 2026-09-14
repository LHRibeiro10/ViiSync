import PageHeader from "../PageHeader";
import { formatQuestionSyncLabel } from "../../utils/mercadoLivreQuestions";

function MercadoLivreQuestionsOverview({
  overview,
  overviewCards,
  meta,
  listLoading,
  listRefreshing,
  hasQuestionsPayload,
  onRefresh,
}) {
  return (
    <>
      <PageHeader
        tag="Atendimento"
        title="Perguntas do Mercado Livre"
        description="Centralize a caixa de perguntas dos anuncios, filtre a fila e responda sem sair do ViiSync."
      >
        <div className={`ml-questions-header-chip ${overview.urgent > 0 ? "is-critical" : ""}`}>
          <strong>{overview.unanswered}</strong>
          <span>pendentes</span>
          <small>
            {overview.urgent > 0
              ? `${overview.urgent} urgente(s) para priorizar`
              : "fila sem urgencias criticas"}
          </small>
        </div>
        <button type="button" onClick={onRefresh} disabled={listRefreshing}>
          {listRefreshing ? "Atualizando..." : "Atualizar dados"}
        </button>
      </PageHeader>

      <div className="ml-questions-page-subtitle">
        <span>{formatQuestionSyncLabel(meta?.lastSyncAt)}</span>
        <span>
          {meta?.filteredTotal || 0} pergunta(s) visiveis no recorte atual |{" "}
          {overview.urgent > 0
            ? `${overview.urgent} urgente(s) exigem resposta imediata`
            : "sem urgencias criticas no momento"}
        </span>
      </div>

      <div className="ml-questions-overview-grid">
        {overviewCards.map((card) => (
          <article
            key={card.id}
            className={`ml-questions-stat-card is-${card.tone} ${
              !hasQuestionsPayload && listLoading ? "is-loading" : ""
            }`}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </>
  );
}

export default MercadoLivreQuestionsOverview;
