import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProducts } from "../services/api";
import "./Products.css";

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseCurrency(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "N/D";
  }

  return `${value.toFixed(1).replace(".", ",")}%`;
}

function getStatusTone(status) {
  const normalized = normalizeValue(status);

  if (normalized.includes("paus")) {
    return "is-warning";
  }

  if (normalized.includes("ativ")) {
    return "is-positive";
  }

  return "is-neutral";
}

function getMarginTone(marginValue) {
  if (!Number.isFinite(marginValue)) {
    return "is-neutral";
  }

  if (marginValue <= 0) {
    return "is-danger";
  }

  if (marginValue < 12) {
    return "is-warning";
  }

  return "is-positive";
}

function ProductThumbnail({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span className="products-product-thumb is-fallback" aria-hidden="true" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="products-product-thumb"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

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

  const enrichedProducts = products.map((product) => {
    const parsedCost = parseCurrency(product.cost);
    const parsedMargin = parsePercent(product.margin);
    const normalizedSku = normalizeValue(product.sku);
    const normalizedStatus = normalizeValue(product.status);
    const hasMissingCost = parsedCost === null || parsedCost <= 0;
    const hasMissingMargin = parsedMargin === null || parsedMargin <= 0;
    const hasZeroProfitSignal = Number.isFinite(parsedMargin) && parsedMargin <= 0;
    const hasIncompleteRegistration =
      normalizedSku.length === 0 || normalizedSku === "n/a";
    const hasLowPerformance =
      normalizedStatus.includes("paus") ||
      (Number.isFinite(parsedMargin) && parsedMargin > 0 && parsedMargin < 8);
    const needsAttention =
      hasMissingCost ||
      hasMissingMargin ||
      hasZeroProfitSignal ||
      hasIncompleteRegistration ||
      hasLowPerformance;

    return {
      ...product,
      parsedCost,
      parsedMargin,
      hasMissingCost,
      hasMissingMargin,
      hasZeroProfitSignal,
      hasIncompleteRegistration,
      hasLowPerformance,
      needsAttention,
    };
  });

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

  const productsWithoutCost = filteredProducts.filter((product) => product.hasMissingCost);
  const productsWithoutMargin = filteredProducts.filter((product) => product.hasMissingMargin);
  const productsWithAttention = filteredProducts.filter((product) => product.needsAttention);
  const bestMarginProduct = filteredProducts
    .filter((product) => Number.isFinite(product.parsedMargin) && product.parsedMargin > 0)
    .sort((left, right) => right.parsedMargin - left.parsedMargin)[0];

  const contextCards = [
    {
      id: "registered",
      label: "Produtos cadastrados",
      value: String(filteredProducts.length),
      detail: "Itens no recorte atual da listagem.",
      tone: "is-neutral",
    },
    {
      id: "missing-cost",
      label: "Sem custo informado",
      value: String(productsWithoutCost.length),
      detail: "Nao entram com precisao em leitura de margem.",
      tone: productsWithoutCost.length ? "is-warning" : "is-positive",
    },
    {
      id: "missing-margin",
      label: "Sem margem calculada",
      value: String(productsWithoutMargin.length),
      detail: "Itens com margem indisponivel ou zerada.",
      tone: productsWithoutMargin.length ? "is-warning" : "is-positive",
    },
    bestMarginProduct
      ? {
          id: "best-margin",
          label: "Com melhor margem",
          value: bestMarginProduct.name,
          detail: `${formatPercent(bestMarginProduct.parsedMargin)} (${bestMarginProduct.sku}).`,
          tone: "is-positive",
        }
      : {
          id: "best-margin-empty",
          label: "Com melhor margem",
          value: "Sem base de margem",
          detail: "A margem aparecera quando houver dados consistentes.",
          tone: "is-placeholder",
        },
    {
      id: "attention",
      label: "Com atencao",
      value: String(productsWithAttention.length),
      detail: "Produtos com sinal operacional para revisao.",
      tone: productsWithAttention.length ? "is-warning" : "is-positive",
    },
  ];

  const attentionGroups = [];

  if (productsWithoutCost.length) {
    attentionGroups.push({
      id: "attention-missing-cost",
      title: `${productsWithoutCost.length} item(ns) sem custo cadastrado`,
      description:
        "Sem custo, a decisao de preco e margem pode ficar distorcida.",
      preview: productsWithoutCost.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-warning",
      productId: productsWithoutCost[0].id,
    });
  }

  const tightMarginProducts = filteredProducts.filter(
    (product) =>
      Number.isFinite(product.parsedMargin) &&
      product.parsedMargin > 0 &&
      product.parsedMargin < 12
  );
  if (tightMarginProducts.length) {
    attentionGroups.push({
      id: "attention-tight-margin",
      title: `${tightMarginProducts.length} item(ns) com margem apertada`,
      description:
        "Margem abaixo de 12% sugere revisar custo, tarifa e estrategia de preco.",
      preview: tightMarginProducts.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-warning",
      productId: tightMarginProducts[0].id,
    });
  }

  const zeroProfitProducts = filteredProducts.filter((product) => product.hasZeroProfitSignal);
  if (zeroProfitProducts.length) {
    attentionGroups.push({
      id: "attention-zero-profit",
      title: `${zeroProfitProducts.length} item(ns) com lucro zerado`,
      description:
        "Itens sem margem positiva merecem ajuste imediato para evitar erosao de caixa.",
      preview: zeroProfitProducts.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-danger",
      productId: zeroProfitProducts[0].id,
    });
  }

  const incompleteProducts = filteredProducts.filter(
    (product) => product.hasIncompleteRegistration
  );
  if (incompleteProducts.length) {
    attentionGroups.push({
      id: "attention-incomplete",
      title: `${incompleteProducts.length} item(ns) com cadastro incompleto`,
      description:
        "SKU ausente dificulta rastreio operacional e conciliacao de custos.",
      preview: incompleteProducts.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-neutral",
      productId: incompleteProducts[0].id,
    });
  }

  const lowPerformanceProducts = filteredProducts.filter((product) => product.hasLowPerformance);
  if (lowPerformanceProducts.length) {
    attentionGroups.push({
      id: "attention-low-performance",
      title: `${lowPerformanceProducts.length} item(ns) com baixa performance`,
      description:
        "Produtos pausados ou com margem fraca pedem revisao de estrategia comercial.",
      preview: lowPerformanceProducts.slice(0, 2).map((product) => product.name).join(" | "),
      tone: "is-warning",
      productId: lowPerformanceProducts[0].id,
    });
  }

  const visibleAttentionGroups = attentionGroups.slice(0, 4);
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

        <div className="products-context-grid">
          {contextCards.map((card) => (
            <article key={card.id} className={`products-context-card ${card.tone}`}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

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

          {visibleAttentionGroups.length ? (
            <div className="products-attention-list">
              {visibleAttentionGroups.map((group) => (
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
                {products.length
                  ? "Nenhum produto corresponde aos filtros atuais."
                  : "O catalogo ainda nao possui produtos sincronizados."}
              </strong>
              <p>
                {products.length
                  ? "Revise busca e status para recuperar os itens da operacao."
                  : "Quando os produtos forem sincronizados, esta area exibira custo, margem e sinais de atencao por item."}
              </p>
              <div className="products-empty-actions">
                <button
                  type="button"
                  className="products-empty-button"
                  onClick={handleResetFilters}
                >
                  Revisar filtros
                </button>
                <button
                  type="button"
                  className="products-empty-button is-secondary"
                  onClick={() => navigate("/")}
                >
                  Ir para dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Products;
