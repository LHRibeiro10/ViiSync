import Panel from "../Panel";

function DashboardListPanels({
  topProducts,
  recentOrders,
  shouldScrollTopProducts,
  shouldScrollRecentOrders,
  hasMercadoLivreConnected,
  hasSyncActionInProgress,
  onSync,
  onConnectMercadoLivre,
  onOpenCustomRangePanel,
  onNavigateToProducts,
  onNavigateToOrders,
}) {
  return (
    <div className="panels">
      <Panel
        title="Top produtos"
        description="Itens com maior faturamento no periodo"
        actionLabel={topProducts.length ? "Ver todos" : null}
        onActionClick={onNavigateToProducts}
      >
        <div
          className={`panel-scroll-body ui-scroll-region ${
            shouldScrollTopProducts ? "is-scrollable scroll-region-medium" : ""
          }`}
        >
          {topProducts.length ? (
            topProducts.map((product, index) => (
              <div key={product.id} className="row">
                <div className="rank">{index + 1}</div>

                <div className="row-main">
                  <strong>{product.name}</strong>
                  <p>Produto em destaque</p>
                </div>

                <span className="row-value">{product.revenue}</span>
              </div>
            ))
          ) : (
            <div className="dashboard-list-empty">
              <strong>Nenhum produto ranqueado no recorte atual.</strong>
              <p>
                Sem faturamento validado, nao e possivel sugerir prioridade comercial.
                Sincronize ou ajuste o periodo para reconstruir o ranking.
              </p>
              <div className="dashboard-empty-actions">
                <button
                  type="button"
                  className="panel-link"
                  onClick={hasMercadoLivreConnected ? onSync : onConnectMercadoLivre}
                  disabled={hasSyncActionInProgress}
                >
                  {hasMercadoLivreConnected ? "Atualizar ranking" : "Conectar Mercado Livre"}
                </button>
                <button
                  type="button"
                  className="dashboard-empty-ghost-button"
                  onClick={onOpenCustomRangePanel}
                >
                  Revisar periodo
                </button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title="Pedidos recentes"
        description="Ultimas vendas sincronizadas"
        actionLabel={recentOrders.length ? "Ver pedidos" : null}
        onActionClick={onNavigateToOrders}
      >
        <div
          className={`panel-scroll-body ui-scroll-region ${
            shouldScrollRecentOrders ? "is-scrollable scroll-region-medium" : ""
          }`}
        >
          {recentOrders.length ? (
            recentOrders.map((order) => (
              <div key={order.id} className="row">
                <div className="order-dot" />

                <div className="row-main">
                  <strong>{order.product}</strong>
                  <p>{order.marketplace}</p>
                </div>

                <span className="row-value">{order.value}</span>
              </div>
            ))
          ) : (
            <div className="dashboard-list-empty">
              <strong>Nenhum pedido recente encontrado neste recorte.</strong>
              <p>
                Isso pode indicar periodo muito restrito ou base ainda nao sincronizada.
                Revise o recorte e acompanhe a central de pedidos.
              </p>
              <div className="dashboard-empty-actions">
                <button type="button" onClick={onNavigateToOrders}>
                  Abrir central de pedidos
                </button>
                <button
                  type="button"
                  className="dashboard-empty-ghost-button"
                  onClick={onOpenCustomRangePanel}
                >
                  Revisar periodo
                </button>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

export default DashboardListPanels;
