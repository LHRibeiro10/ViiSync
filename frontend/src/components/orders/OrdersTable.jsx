import { getStatusTone } from "../../utils/ordersInsights";

function OrdersTable({
  filteredOrders,
  hasOrdersInPeriod,
  shouldScrollOrders,
  onResetFilters,
  onExpandPeriod,
  onNavigateToDashboard,
}) {
  return (
    <>
      <div className="orders-results-meta">
        <strong>{filteredOrders.length}</strong>
        <span>{filteredOrders.length === 1 ? "pedido encontrado" : "pedidos encontrados"}</span>
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
                <th>Pedido</th>
                <th>Produto</th>
                <th>Conta</th>
                <th>Marketplace</th>
                <th>Data</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td data-label="Pedido">{order.id}</td>
                  <td data-label="Produto">{order.product}</td>
                  <td data-label="Conta">{order.account || "Conta"}</td>
                  <td data-label="Marketplace">{order.marketplace}</td>
                  <td data-label="Data">{order.saleDateLabel || "--"}</td>
                  <td data-label="Valor">{order.value}</td>
                  <td data-label="Status">
                    <span className={`orders-status-badge ${getStatusTone(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="orders-empty-state">
            <strong>
              {hasOrdersInPeriod
                ? "Nenhum pedido corresponde aos filtros atuais."
                : "Nenhum pedido sincronizado para o recorte selecionado."}
            </strong>
            <p>
              {hasOrdersInPeriod
                ? "Revise busca, canal e periodo para recuperar a leitura operacional."
                : "Amplie o periodo ou sincronize os dados para carregar novos pedidos."}
            </p>
            <div className="orders-empty-actions">
              <button type="button" className="orders-empty-button" onClick={onResetFilters}>
                Revisar filtros
              </button>
              <button type="button" className="orders-empty-button" onClick={onExpandPeriod}>
                Ampliar periodo
              </button>
              <button
                type="button"
                className="orders-empty-button is-secondary"
                onClick={onNavigateToDashboard}
              >
                Sincronizar no dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default OrdersTable;
