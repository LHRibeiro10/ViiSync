import { formatCurrency } from "../../utils/presentation";

function OrdersSummaryGrid({ totalOrders, grossRevenue, netReceived, averageTicket }) {
  return (
    <div className="orders-summary-grid">
      <article className="orders-summary-card">
        <span>Pedidos</span>
        <strong>{totalOrders}</strong>
      </article>
      <article className="orders-summary-card">
        <span>Faturamento</span>
        <strong>{formatCurrency(grossRevenue)}</strong>
      </article>
      <article className="orders-summary-card">
        <span>Recebido liquido</span>
        <strong>{formatCurrency(netReceived)}</strong>
      </article>
      <article className="orders-summary-card">
        <span>Ticket medio</span>
        <strong>{formatCurrency(averageTicket)}</strong>
      </article>
    </div>
  );
}

export default OrdersSummaryGrid;
