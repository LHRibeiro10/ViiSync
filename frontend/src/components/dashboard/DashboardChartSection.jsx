import ChartPanel from "../ChartPanel";
import MercadoLivreSyncButton from "./MercadoLivreSyncButton";

function DashboardChartSection({
  hasChartData,
  chartData,
  formatCurrency,
  hasMercadoLivreConnected,
  syncing,
  isMarketplaceSyncing,
  connectingMercadoLivre,
  onSync,
  onConnectMercadoLivre,
  onOpenCustomRangePanel,
}) {
  if (hasChartData) {
    return (
      <ChartPanel
        title="Faturamento por periodo"
        description="Evolucao recente das vendas sincronizadas"
        data={chartData}
        formatCurrency={formatCurrency}
      />
    );
  }

  return (
    <div className="chart-panel">
      <div className="panel-header">
        <div>
          <h2>Faturamento por periodo</h2>
          <p>Evolucao recente das vendas sincronizadas</p>
        </div>
      </div>

      <div className="dashboard-module-empty">
        <strong>A curva de faturamento ainda nao pode ser exibida.</strong>
        <p>
          Nao encontramos pontos suficientes neste recorte para leitura de tendencia.
          Sincronize ou revise o periodo para recuperar visibilidade.
        </p>
        <div className="dashboard-empty-actions">
          <MercadoLivreSyncButton
            hasMercadoLivreConnected={hasMercadoLivreConnected}
            syncing={syncing}
            isMarketplaceSyncing={isMarketplaceSyncing}
            connectingMercadoLivre={connectingMercadoLivre}
            connectedLabel="Sincronizar dados"
            onSync={onSync}
            onConnect={onConnectMercadoLivre}
          />
          <button
            type="button"
            className="dashboard-empty-ghost-button"
            onClick={onOpenCustomRangePanel}
          >
            Revisar periodo
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardChartSection;
