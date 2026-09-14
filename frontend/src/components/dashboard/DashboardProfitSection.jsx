import ProfitTable from "../ProfitTable";
import MercadoLivreSyncButton from "./MercadoLivreSyncButton";

function DashboardProfitSection({
  hasProfitRows,
  profitRows,
  formatCurrency,
  formatPercent,
  onEditRow,
  hasMercadoLivreConnected,
  syncing,
  isMarketplaceSyncing,
  connectingMercadoLivre,
  onSync,
  onConnectMercadoLivre,
  onOpenCustomRangePanel,
}) {
  if (hasProfitRows) {
    return (
      <ProfitTable
        rows={profitRows}
        formatCurrency={formatCurrency}
        formatPercent={formatPercent}
        onEditRow={onEditRow}
      />
    );
  }

  return (
    <div className="panel profit-table-panel">
      <div className="panel-header">
        <div>
          <h2>Operacao por produto</h2>
          <p>Controle custo, imposto e lucro por item vendido.</p>
        </div>
      </div>

      <div className="dashboard-module-empty">
        <strong>Nenhum item encontrado para este periodo.</strong>
        <p>
          Quando os pedidos forem sincronizados, voce podera revisar margem e lucro por
          produto aqui.
        </p>
        <div className="dashboard-empty-actions">
          <MercadoLivreSyncButton
            hasMercadoLivreConnected={hasMercadoLivreConnected}
            syncing={syncing}
            isMarketplaceSyncing={isMarketplaceSyncing}
            connectingMercadoLivre={connectingMercadoLivre}
            connectedLabel="Sincronizar produtos"
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

export default DashboardProfitSection;
