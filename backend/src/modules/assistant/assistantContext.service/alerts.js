const { formatPercent } = require("./shared");

function createAlert(id, severity, title, description) {
  return { id, severity, title, description };
}

function buildAlerts(metrics) {
  const alerts = [];

  if (metrics.monthlyComparison.profitDeltaPercent < 0) {
    alerts.push(
      createAlert(
        "profit-drop",
        "warning",
        "Lucro mensal em desaceleracao",
        `O lucro do periodo mais recente caiu ${formatPercent(
          Math.abs(metrics.monthlyComparison.profitDeltaPercent)
        )} em relacao ao mes anterior.`
      )
    );
  }

  if (metrics.orders.pendingRate >= 25) {
    alerts.push(
      createAlert(
        "pending-orders",
        "warning",
        "Fila de pedidos pendentes acima do ideal",
        `${metrics.orders.pending} pedido(s) ainda estao pendentes, o que representa ${formatPercent(
          metrics.orders.pendingRate
        )} da operacao recente.`
      )
    );
  }

  if (metrics.products.lowestMarginProducts.length && metrics.products.lowestMarginProducts[0].margin <= 22) {
    const worstMarginProduct = metrics.products.lowestMarginProducts[0];

    alerts.push(
      createAlert(
        "margin-pressure",
        "warning",
        "Produto com margem pressionada",
        `${worstMarginProduct.name} esta operando com margem estimada de ${formatPercent(
          worstMarginProduct.margin
        )}.`
      )
    );
  }

  if (metrics.costPressure.shippingSharePercent >= 7) {
    alerts.push(
      createAlert(
        "shipping-pressure",
        "info",
        "Frete consumindo parte relevante da receita",
        `O frete representa ${formatPercent(
          metrics.costPressure.shippingSharePercent
        )} da receita bruta do periodo analisado.`
      )
    );
  }

  if (metrics.products.pausedCount > 0) {
    alerts.push(
      createAlert(
        "paused-products",
        "info",
        "Produtos pausados exigem revisao",
        `Existem ${metrics.products.pausedCount} produto(s) pausado(s) no catalogo atual.`
      )
    );
  }

  if (metrics.accounts.pendingCount > 0) {
    alerts.push(
      createAlert(
        "account-sync",
        "info",
        "Conta com sincronizacao pendente",
        `${metrics.accounts.pendingCount} conta(s) conectada(s) ainda nao estao plenamente sincronizadas.`
      )
    );
  }

  return alerts.slice(0, 4);
}

module.exports = {
  buildAlerts,
};
