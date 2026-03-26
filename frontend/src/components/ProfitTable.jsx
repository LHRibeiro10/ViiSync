import { useState } from "react";

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 15.75V20h4.25L19.06 9.19l-4.25-4.25L4 15.75Zm13.71-8.46a1.003 1.003 0 0 0 0-1.42l-1.58-1.58a1.003 1.003 0 0 0-1.42 0l-1.24 1.24 4.25 4.25 1.99-1.99Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ProfitProductPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span className="profit-product-photo profit-product-photo-fallback" aria-hidden="true" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="profit-product-photo"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function ProfitTable({ rows, formatCurrency, formatPercent, onEditRow }) {
  const shouldScrollRows = rows.length > 8;

  function renderCurrencyCell(value, isMissing) {
    if (isMissing) {
      return <span className="profit-missing-value">N/D</span>;
    }

    return formatCurrency(value);
  }

  return (
    <div className="panel profit-table-panel">
      <div className="panel-header">
        <div>
          <h2>Operacao por produto</h2>
          <p>Controle custo, imposto e lucro por item vendido.</p>
        </div>
      </div>

      <div
        className={`profit-table-wrapper ui-scroll-region is-table-scroll ${
          shouldScrollRows ? "is-scrollable scroll-region-table" : ""
        }`}
      >
        <table className="profit-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Titulo</th>
              <th>Conta</th>
              <th>SKU</th>
              <th>Data</th>
              <th>Qtde</th>
              <th>Valor</th>
              <th>Tarifa</th>
              <th>Frete Vendedor</th>
              <th>Custo do Produto</th>
              <th>Lucro</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const canRenderProfit = !row.hasDataGaps;
              const marginPercent =
                canRenderProfit && row.value ? (row.profit / row.value) * 100 : 0;
              const profitTone =
                !canRenderProfit
                  ? "profit-pill warning"
                  : row.profit >= 0
                    ? "profit-pill positive"
                    : "profit-pill negative";

              return (
                <tr key={row.id}>
                  <td data-label="Foto" className="profit-photo-cell">
                    <ProfitProductPhoto src={row.photo} alt={row.title} />
                  </td>
                  <td data-label="Titulo">
                    <div className="profit-title-cell">
                      <strong>{row.title}</strong>
                      <span>
                        Imposto atual:{" "}
                        {row.taxMissing ? "N/D" : formatPercent(row.taxPercent)}
                      </span>
                      {row.hasDataGaps ? (
                        <small className="profit-inline-warning">
                          Alguns custos ainda nao foram encontrados.
                        </small>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="Conta">
                    <span className="profit-account-badge">{row.account}</span>
                  </td>
                  <td data-label="SKU" className="profit-muted">{row.sku}</td>
                  <td data-label="Data" className="profit-muted">{row.date}</td>
                  <td data-label="Qtde">{row.quantity}</td>
                  <td data-label="Valor">{formatCurrency(row.value)}</td>
                  <td data-label="Tarifa">
                    {renderCurrencyCell(row.fee, row.feeMissing)}
                  </td>
                  <td data-label="Frete vendedor">
                    {renderCurrencyCell(row.sellerShipping, row.sellerShippingMissing)}
                  </td>
                  <td data-label="Custo do produto">
                    <div className="profit-cost-cell">
                      <span>
                        {renderCurrencyCell(row.productCost, row.productCostMissing)}
                      </span>
                      <button
                        type="button"
                        className="profit-edit-button"
                        onClick={() => onEditRow(row)}
                        aria-label={`Editar custo e imposto de ${row.title}`}
                      >
                        <PencilIcon />
                      </button>
                    </div>
                  </td>
                  <td data-label="Lucro">
                    <div className="profit-result-cell">
                      <span className={profitTone}>
                        {canRenderProfit ? formatCurrency(row.profit) : "N/D"}
                      </span>
                      <small>
                        {canRenderProfit
                          ? `${formatPercent(marginPercent)} de margem`
                          : "Dados incompletos para lucro real"}
                      </small>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProfitTable;
