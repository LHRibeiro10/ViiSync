import { useEffect, useState } from "react";
import { getOrders } from "../services/api";
import "./Orders.css";

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMarketplace, setSelectedMarketplace] = useState("all");

  useEffect(() => {
    async function loadOrders() {
      try {
        const result = await getOrders();
        setOrders(result);
      } catch {
        setError("Nao foi possivel carregar os pedidos.");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  if (loading) return <div className="screen-message">Carregando pedidos...</div>;
  if (error) return <div className="screen-message">{error}</div>;

  const marketplaceOptions = Array.from(
    new Set(orders.map((order) => order.marketplace).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));

  const normalizedSearchTerm = normalizeValue(searchTerm);

  const filteredOrders = orders.filter((order) => {
    const matchesMarketplace =
      selectedMarketplace === "all" || order.marketplace === selectedMarketplace;

    const matchesSearch =
      normalizedSearchTerm.length === 0 ||
      [order.id, order.product, order.marketplace, order.status].some((value) =>
        normalizeValue(value).includes(normalizedSearchTerm)
      );

    return matchesMarketplace && matchesSearch;
  });

  const shouldScrollOrders = filteredOrders.length > 10;

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div>
          <span className="tag">Operacao</span>
          <h1>Pedidos</h1>
          <p>Visualize as vendas sincronizadas e acompanhe os dados principais.</p>
        </div>
      </div>

      <div className="orders-panel">
        <div className="orders-toolbar">
          <input
            type="text"
            placeholder="Buscar pedido, produto ou status"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            value={selectedMarketplace}
            onChange={(event) => setSelectedMarketplace(event.target.value)}
          >
            <option value="all">Todos os canais</option>
            {marketplaceOptions.map((marketplace) => (
              <option key={marketplace} value={marketplace}>
                {marketplace}
              </option>
            ))}
          </select>
        </div>

        <div className="orders-results-meta">
          <strong>{filteredOrders.length}</strong>
          <span>
            {filteredOrders.length === 1
              ? "pedido encontrado"
              : "pedidos encontrados"}
          </span>
        </div>

        <div
          className={`orders-table-wrapper ui-scroll-region is-table-scroll ${
            shouldScrollOrders ? "is-scrollable scroll-region-table" : ""
          }`}
        >
          {filteredOrders.length > 0 ? (
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Marketplace</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Produto">{order.product}</td>
                    <td data-label="Marketplace">{order.marketplace}</td>
                    <td data-label="Valor">{order.value}</td>
                    <td data-label="Status">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="orders-empty-state">
              Nenhum pedido corresponde aos filtros aplicados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Orders;
