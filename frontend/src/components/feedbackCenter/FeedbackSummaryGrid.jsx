function FeedbackSummaryGrid({ summaryCards }) {
  return (
    <div className="feedback-summary-grid">
      {summaryCards.map((card) => (
        <article key={card.id} className="feedback-summary-card">
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </div>
  );
}

export default FeedbackSummaryGrid;
