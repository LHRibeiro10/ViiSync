function OrdersOpsStrip({ operationalInsights }) {
  return (
    <section className="orders-ops-strip">
      {operationalInsights.map((insight) => (
        <article key={insight.id} className={`orders-ops-card ${insight.tone}`}>
          <span>{insight.label}</span>
          <strong>{insight.value}</strong>
          <p>{insight.detail}</p>
        </article>
      ))}
    </section>
  );
}

export default OrdersOpsStrip;
