import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "../services/api";
import "./Products.css";

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    async function loadProducts() {
      try {
        const result = await getProducts();
        setProducts(result);
      } catch (err) {
        setError("Nao foi possivel carregar os produtos.");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  if (loading) return <div className="screen-message">Carregando produtos...</div>;
  if (error) return <div className="screen-message">{error}</div>;

  const statusOptions = Array.from(
    new Set(products.map((product) => product.status).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));

  const normalizedSearchTerm = normalizeValue(searchTerm);

  const filteredProducts = products.filter((product) => {
    const matchesStatus =
      selectedStatus === "all" || product.status === selectedStatus;

    const matchesSearch =
      normalizedSearchTerm.length === 0 ||
      [product.name, product.sku, product.status].some((value) =>
        normalizeValue(value).includes(normalizedSearchTerm)
      );

    return matchesStatus && matchesSearch;
  });

  const shouldScrollProducts = filteredProducts.length > 10;

  return (
    <div className="products-page">
      <div className="products-header">
        <div>
          <span className="tag">Catalogo</span>
          <h1>Produtos</h1>
          <p>Gerencie custo, preco e margem dos itens sincronizados.</p>
        </div>
      </div>

      <div className="products-panel">
        <div className="products-toolbar">
          <input
            type="text"
            placeholder="Buscar produto, SKU ou status"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
          >
            <option value="all">Todos os status</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="products-results-meta">
          <strong>{filteredProducts.length}</strong>
          <span>
            {filteredProducts.length === 1
              ? "produto encontrado"
              : "produtos encontrados"}
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
                    <td data-label="Produto">{product.name}</td>
                    <td data-label="SKU">{product.sku}</td>
                    <td data-label="Preco">{product.price}</td>
                    <td data-label="Custo">{product.cost}</td>
                    <td data-label="Margem">{product.margin}</td>
                    <td data-label="Status">{product.status}</td>
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
              Nenhum produto corresponde aos filtros aplicados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Products;
