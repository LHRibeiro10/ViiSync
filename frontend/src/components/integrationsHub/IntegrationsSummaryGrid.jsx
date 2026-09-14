function IntegrationsSummaryGrid({ summary }) {
  return (
    <div className="integrations-summary-grid">
      {(summary || []).map((card) => (
        <article key={card.id} className={`integrations-summary-card is-${card.tone}`}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </div>
  );
}

export default IntegrationsSummaryGrid;
