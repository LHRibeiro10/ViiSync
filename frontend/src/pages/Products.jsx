import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProducts } from "../services/api";
import ProductsToolbar from "../components/products/ProductsToolbar";
import ProductsContextGrid from "../components/products/ProductsContextGrid";
import ProductsAttentionPanel from "../components/products/ProductsAttentionPanel";
import ProductsTable from "../components/products/ProductsTable";
import {
  normalizeValue,
  enrichProducts,
  buildProductsContextCards,
  buildProductsAttentionGroups,
} from "../utils/productsInsights";
import "./Products.css";

function Products() {
  const navigate = useNavigate();
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
      } catch {
        setError("Nao foi possivel carregar os produtos.");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  if (loading) return <div className="screen-message">Carregando produtos...</div>;
  if (error) return <div className="screen-message">{error}</div>;

  const enrichedProducts = enrichProducts(products);

  const statusOptions = Array.from(
    new Set(enrichedProducts.map((product) => product.status).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));

  const normalizedSearchTerm = normalizeValue(searchTerm);

  const filteredProducts = enrichedProducts.filter((product) => {
    const matchesStatus =
      selectedStatus === "all" || product.status === selectedStatus;

    const matchesSearch =
      normalizedSearchTerm.length === 0 ||
      [product.name, product.sku, product.status].some((value) =>
        normalizeValue(value).includes(normalizedSearchTerm)
      );

    return matchesStatus && matchesSearch;
  });

  const contextCards = buildProductsContextCards(filteredProducts);
  const visibleAttentionGroups = buildProductsAttentionGroups(filteredProducts).slice(0, 4);
  const shouldScrollProducts = filteredProducts.length > 10;

  function handleResetFilters() {
    setSearchTerm("");
    setSelectedStatus("all");
  }

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
        <ProductsToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          selectedStatus={selectedStatus}
          onSelectedStatusChange={setSelectedStatus}
          statusOptions={statusOptions}
        />

        <ProductsContextGrid contextCards={contextCards} />

        <ProductsAttentionPanel attentionGroups={visibleAttentionGroups} />

        <ProductsTable
          filteredProducts={filteredProducts}
          hasProducts={products.length > 0}
          shouldScrollProducts={shouldScrollProducts}
          onResetFilters={handleResetFilters}
          onNavigateToDashboard={() => navigate("/")}
        />
      </div>
    </div>
  );
}

export default Products;
