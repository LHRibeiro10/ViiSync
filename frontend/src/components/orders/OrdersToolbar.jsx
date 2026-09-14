import { DATE_PRESETS } from "../../utils/ordersInsights";

function OrdersToolbar({
  searchTerm,
  onSearchTermChange,
  selectedMarketplace,
  onSelectedMarketplaceChange,
  marketplaceOptions,
  datePreset,
  onDatePresetChange,
  customRange,
  onCustomRangeChange,
}) {
  return (
    <>
      <div className="orders-toolbar">
        <input
          type="text"
          placeholder="Buscar pedido, produto ou status"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
        <select
          value={selectedMarketplace}
          onChange={(event) => onSelectedMarketplaceChange(event.target.value)}
        >
          <option value="all">Todos os canais</option>
          {marketplaceOptions.map((marketplace) => (
            <option key={marketplace} value={marketplace}>
              {marketplace}
            </option>
          ))}
        </select>
        <select value={datePreset} onChange={(event) => onDatePresetChange(event.target.value)}>
          {DATE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {datePreset === "custom" ? (
        <div className="orders-custom-range">
          <label>
            <span>Data inicial</span>
            <input
              type="date"
              value={customRange.startDate}
              onChange={(event) =>
                onCustomRangeChange((currentRange) => ({
                  ...currentRange,
                  startDate: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Data final</span>
            <input
              type="date"
              value={customRange.endDate}
              onChange={(event) =>
                onCustomRangeChange((currentRange) => ({
                  ...currentRange,
                  endDate: event.target.value,
                }))
              }
            />
          </label>
        </div>
      ) : null}
    </>
  );
}

export default OrdersToolbar;
