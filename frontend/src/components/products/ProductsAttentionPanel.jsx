import { Link } from "react-router-dom";

function ProductsAttentionPanel({ attentionGroups }) {
  return (
    <section className="products-attention-panel">
      <div className="products-attention-header">
        <div>
          <span className="products-section-tag">Prioridade operacional</span>
          <h2>Produtos que merecem atencao</h2>
          <p>
            Ajustes de custo, margem e cadastro para proteger rentabilidade do catalogo.
          </p>
        </div>
      </div>

      {attentionGroups.length ? (
        <div className="products-attention-list">
          {attentionGroups.map((group) => (
            <article key={group.id} className={`products-attention-item ${group.tone}`}>
              <div className="products-attention-copy">
                <strong>{group.title}</strong>
                <p>{group.description}</p>
                <small>{group.preview}</small>
              </div>

              {group.productId ? (
                <Link className="products-attention-link" to={`/produtos/${group.productId}`}>
                  Abrir produto
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="products-attention-empty">
          <strong>Nenhum alerta critico identificado no recorte atual.</strong>
          <p>
            Os produtos filtrados estao com leitura de custo, margem e cadastro em faixa
            controlada.
          </p>
        </div>
      )}
    </section>
  );
}

export default ProductsAttentionPanel;
