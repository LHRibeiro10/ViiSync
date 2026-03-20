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

function ProfitTable({ rows, formatCurrency, formatPercent, onEditRow }) {
  const shouldScrollRows = rows.length > 8;

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
              const marginPercent = row.value ? (row.profit / row.value) * 100 : 0;
              const profitTone =
                row.profit >= 0 ? "profit-pill positive" : "profit-pill negative";

              return (
                <tr key={row.id}>
                  <td data-label="Foto" className="profit-photo-cell">
                    <img
                      src={row.photo}
                      alt={row.title}
                      className="profit-product-photo"
                    />
                  </td>
                  <td data-label="Titulo">
                    <div className="profit-title-cell">
                      <strong>{row.title}</strong>
                      <span>Imposto atual: {formatPercent(row.taxPercent)}</span>
                    </div>
                  </td>
                  <td data-label="Conta">
                    <span className="profit-account-badge">{row.account}</span>
                  </td>
                  <td data-label="SKU" className="profit-muted">{row.sku}</td>
                  <td data-label="Data" className="profit-muted">{row.date}</td>
                  <td data-label="Qtde">{row.quantity}</td>
                  <td data-label="Valor">{formatCurrency(row.value)}</td>
                  <td data-label="Tarifa">{formatCurrency(row.fee)}</td>
                  <td data-label="Frete vendedor">{formatCurrency(row.sellerShipping)}</td>
                  <td data-label="Custo do produto">
                    <div className="profit-cost-cell">
                      <span>{formatCurrency(row.productCost)}</span>
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
                      <span className={profitTone}>{formatCurrency(row.profit)}</span>
                      <small>{formatPercent(marginPercent)} de margem</small>
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
