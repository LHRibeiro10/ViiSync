import { Link } from "react-router-dom";
import ProductThumbnail from "./ProductThumbnail";
import { getStatusTone, getMarginTone } from "../../utils/productsInsights";

function ProductsTable({
  filteredProducts,
  hasProducts,
  shouldScrollProducts,
  onResetFilters,
  onNavigateToDashboard,
}) {
  return (
    <>
      <div className="products-results-meta">
        <strong>{filteredProducts.length}</strong>
        <span>
          {filteredProducts.length === 1 ? "produto encontrado" : "produtos encontrados"}
        </span>
      </div>

      <div
        className={`products-table-wrapper ui-scroll-region is-table-scroll ${
          shouldScrollProducts ? "is-scrollable scroll-region-table" : ""
        }`}
      >
        {filteredProducts.length > 0 ? (
          <table className="products-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>SKU</th>
                <th>Preco</th>
                <th>Custo</th>
                <th>Margem</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td data-label="Produto">
                    <div className="products-product-cell">
                      <ProductThumbnail src={product.thumbnail} alt={product.name} />
                      <span>{product.name}</span>
                    </div>
                  </td>
                  <td data-label="SKU">{product.sku}</td>
                  <td data-label="Preco">{product.price}</td>
                  <td data-label="Custo">{product.cost}</td>
                  <td data-label="Margem">
                    <span className={`products-margin-pill ${getMarginTone(product.parsedMargin)}`}>
                      {product.margin}
                    </span>
                  </td>
                  <td data-label="Status">
                    <span className={`products-status-badge ${getStatusTone(product.status)}`}>
                      {product.status}
                    </span>
                  </td>
                  <td data-label="Acoes">
                    <Link className="products-detail-link" to={`/produtos/${product.id}`}>
                      Ver detalhe
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="products-empty-state">
            <strong>
              {hasProducts
                ? "Nenhum produto corresponde aos filtros atuais."
                : "O catalogo ainda nao possui produtos sincronizados."}
            </strong>
            <p>
              {hasProducts
                ? "Revise busca e status para recuperar os itens da operacao."
                : "Quando os produtos forem sincronizados, esta area exibira custo, margem e sinais de atencao por item."}
            </p>
            <div className="products-empty-actions">
              <button type="button" className="products-empty-button" onClick={onResetFilters}>
                Revisar filtros
              </button>
              <button
                type="button"
                className="products-empty-button is-secondary"
                onClick={onNavigateToDashboard}
              >
                Ir para dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ProductsTable;
