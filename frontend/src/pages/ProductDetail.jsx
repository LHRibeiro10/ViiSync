import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { useAnalyticsPeriod } from "../contexts/useAnalyticsPeriod";
import { getProductDetail } from "../services/api";
import {
  formatCurrency,
  formatDateTime,
  formatInteger,
  formatPercent,
} from "../utils/presentation";
import "./ProductDetail.css";

function ProductDetail() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { selectedPeriod, setSelectedPeriod } = useAnalyticsPeriod();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadProductDetail() {
      try {
        setError("");
        setLoading(true);
        const response = await getProductDetail(productId, selectedPeriod);

        if (!isCancelled) {
          setPayload(response);
        }
      } catch {
        if (!isCancelled) {
          setError("Nao foi possivel carregar o detalhe do produto.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadProductDetail();

    return () => {
      isCancelled = true;
    };
  }, [productId, selectedPeriod]);

  if (loading && !payload) {
    return <div className="screen-message">Carregando detalhe do produto...</div>;
  }

  if (error && !payload) {
    return <div className="screen-message">{error}</div>;
  }

  const item = payload?.item;

  if (!item) {
    return <div className="screen-message">Produto nao encontrado.</div>;
  }

  const summaryCards = [
    { id: "revenue", label: "Faturamento", value: formatCurrency(item.summary.revenue) },
    { id: "profit", label: "Lucro", value: formatCurrency(item.summary.profit) },
    { id: "margin", label: "Margem", value: formatPercent(item.summary.marginPercent) },
    { id: "fees", label: "Taxas", value: formatCurrency(item.summary.feeAmount) },
    { id: "sales", label: "Vendas", value: formatInteger(item.summary.sales) },
  ];

  const statusToneClass =
    item.status?.toLowerCase() === "ativo"
      ? "is-success"
      : item.status?.toLowerCase() === "pausado"
        ? "is-warning"
        : "is-neutral";

  const maxRevenue = Math.max(...item.evolution.map((point) => point.revenue), 1);

  return (
    <div className="product-detail-page">
      <PageHeader
        tag="Detalhe do produto"
        title={item.name}
        description={`${item.category} - ${item.sku} - ${item.healthLabel}`}
      >
        <div className="product-detail-header-actions">
          <div className="product-detail-period-switcher">
            <button
              type="button"
              className={selectedPeriod === "7d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("7d")}
            >
              7 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "30d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("30d")}
            >
              30 dias
            </button>
            <button
              type="button"
              className={selectedPeriod === "90d" ? "is-active" : ""}
              onClick={() => setSelectedPeriod("90d")}
            >
              90 dias
            </button>
          </div>

          <button
            type="button"
            className="product-detail-back-button"
            onClick={() => navigate(-1)}
          >
            Voltar
          </button>
        </div>
      </PageHeader>

      {error ? <div className="product-detail-inline-alert">{error}</div> : null}

      <div className="product-detail-summary-grid">
        {summaryCards.map((card) => (
          <article key={card.id} className="product-detail-summary-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="product-detail-layout">
        <section className="panel product-detail-main-panel">
          <div className="product-detail-panel-header">
            <div>
              <h2>Evolucao no periodo</h2>
              <p>Receita, lucro e pedidos do item no recorte ativo.</p>
            </div>
            <span className={`product-detail-panel-chip ${statusToneClass}`}>{item.status}</span>
          </div>

          <div className="product-detail-timeline">
            {item.evolution.map((point) => (
              <article key={point.label} className="product-detail-timeline-item">
                <div className="product-detail-timeline-top">
                  <strong>{point.label}</strong>
                  <span>{formatInteger(point.orders)} pedido(s)</span>
                </div>
                <div className="product-detail-bar-shell">
                  <div
                    className="product-detail-bar-fill"
                    style={{ width: `${(point.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
                <div className="product-detail-timeline-metrics">
                  <span>{formatCurrency(point.revenue)}</span>
                  <strong>{formatCurrency(point.profit)}</strong>
                </div>
              </article>
            ))}
          </div>

          <div className="product-detail-dual-grid">
            <div className="product-detail-card">
              <h3>Canais</h3>
              <div className="product-detail-list">
                {item.channelMix.map((channel) => (
                  <div key={channel.id} className="product-detail-list-item">
                    <div>
                      <strong>{channel.marketplace}</strong>
                      <p>{formatPercent(channel.marginPercent)} de margem liquida</p>
                    </div>
                    <div className="product-detail-list-values">
                      <span>{formatCurrency(channel.revenue)}</span>
                      <strong>{formatCurrency(channel.profit)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="product-detail-card">
              <h3>Taxas e custos</h3>
              <div className="product-detail-list">
                {item.feeBreakdown.map((fee) => (
                  <div key={fee.id} className="product-detail-list-item">
                    <div>
                      <strong>{fee.label}</strong>
                    </div>
                    <div className="product-detail-list-values">
                      <strong>{formatCurrency(fee.amount)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="product-detail-side-column">
          <section className="panel product-detail-side-panel">
            <div className="product-detail-panel-header">
              <div>
                <h2>Vendas recentes</h2>
                <p>Ultimos movimentos vinculados ao item.</p>
              </div>
            </div>

            <div className="product-detail-list">
              {item.recentSales.map((sale) => (
                <div key={sale.id} className="product-detail-list-item">
                  <div>
                    <strong>{sale.orderId}</strong>
                    <p>
                      {sale.marketplace} - {formatDateTime(sale.soldAt)}
                    </p>
                  </div>
                  <div className="product-detail-list-values">
                    <span>{formatCurrency(sale.revenue)}</span>
                    <strong>{formatCurrency(sale.profit)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel product-detail-side-panel">
            <div className="product-detail-panel-header">
              <div>
                <h2>Recomendacoes</h2>
                <p>Sugestoes praticas para o seller agir no SKU.</p>
              </div>
            </div>

            <div className="product-detail-recommendations">
              {item.recommendations.map((recommendation, index) => (
                <div key={`${recommendation}-${index}`} className="product-detail-recommendation">
                  <div className="product-detail-dot" />
                  <p>{recommendation}</p>
                </div>
              ))}
            </div>

            <Link to="/produtos" className="product-detail-link-back">
              Voltar para a lista de produtos
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
