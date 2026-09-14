import {
  getPeriodLabel,
  isCustomPeriod,
} from "../../utils/period";
import MercadoLivreSyncButton from "./MercadoLivreSyncButton";

function DashboardHeaderControls({
  selectedPeriod,
  isPeriodRefreshing,
  isCustomRangePanelOpen,
  customRangeForm,
  customRangeError,
  onPeriodChange,
  onOpenCustomRangePanel,
  onCloseCustomRangePanel,
  onCustomRangeFieldChange,
  onApplyCustomRange,
  hasMercadoLivreConnected,
  syncing,
  isMarketplaceSyncing,
  connectingMercadoLivre,
  onSync,
  onConnectMercadoLivre,
}) {
  return (
    <>
      <div className="dashboard-period-control">
        <div className={`period-switcher ${isPeriodRefreshing ? "is-busy" : ""}`}>
          <button
            className={selectedPeriod === "7d" ? "period-button active" : "period-button"}
            onClick={() => onPeriodChange("7d")}
          >
            7 dias
          </button>

          <button
            className={selectedPeriod === "30d" ? "period-button active" : "period-button"}
            onClick={() => onPeriodChange("30d")}
          >
            30 dias
          </button>

          <button
            className={selectedPeriod === "90d" ? "period-button active" : "period-button"}
            onClick={() => onPeriodChange("90d")}
          >
            90 dias
          </button>

          <button
            className={selectedPeriod === "1y" ? "period-button active" : "period-button"}
            onClick={() => onPeriodChange("1y")}
          >
            1 ano
          </button>

          <button
            type="button"
            className={isCustomPeriod(selectedPeriod) ? "period-button active" : "period-button"}
            onClick={onOpenCustomRangePanel}
          >
            Personalizar
          </button>
        </div>

        {isCustomPeriod(selectedPeriod) ? (
          <span className="dashboard-period-caption">
            Recorte ativo: {getPeriodLabel(selectedPeriod)}
          </span>
        ) : null}

        {isCustomRangePanelOpen ? (
          <form className="dashboard-custom-range-panel" onSubmit={onApplyCustomRange}>
            <label>
              <span>Data inicial</span>
              <input
                type="date"
                name="startDate"
                value={customRangeForm.startDate}
                onChange={onCustomRangeFieldChange}
                required
              />
            </label>

            <label>
              <span>Data final</span>
              <input
                type="date"
                name="endDate"
                value={customRangeForm.endDate}
                onChange={onCustomRangeFieldChange}
                required
              />
            </label>

            <div className="dashboard-custom-range-actions">
              <button type="button" onClick={onCloseCustomRangePanel}>
                Cancelar
              </button>
              <button type="submit">Aplicar</button>
            </div>

            {customRangeError ? (
              <p className="dashboard-custom-range-error">{customRangeError}</p>
            ) : null}
          </form>
        ) : null}
      </div>

      <MercadoLivreSyncButton
        hasMercadoLivreConnected={hasMercadoLivreConnected}
        syncing={syncing}
        isMarketplaceSyncing={isMarketplaceSyncing}
        connectingMercadoLivre={connectingMercadoLivre}
        connectedLabel="Sincronizar"
        onSync={onSync}
        onConnect={onConnectMercadoLivre}
        className=""
      />
    </>
  );
}

export default DashboardHeaderControls;
