function ChartPanel({ title, description, data = [], formatCurrency }) {
  const maxRevenue = Math.max(...data.map((item) => item.revenue), 1);

  return (
    <div className="chart-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="chart-bars">
        {data.map((item) => (
          <div key={item.label} className="chart-bar-item">
            <div className="chart-bar-track">
              <div
                className="chart-bar-fill"
                style={{ height: `${(item.revenue / maxRevenue) * 100}%` }}
              />
            </div>
            <span className="chart-label">{item.label}</span>
            <strong className="chart-value">{formatCurrency(item.revenue)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChartPanel;