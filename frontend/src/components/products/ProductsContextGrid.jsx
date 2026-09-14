function ProductsContextGrid({ contextCards }) {
  return (
    <div className="products-context-grid">
      {contextCards.map((card) => (
        <article key={card.id} className={`products-context-card ${card.tone}`}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <p>{card.detail}</p>
        </article>
      ))}
    </div>
  );
}

export default ProductsContextGrid;
