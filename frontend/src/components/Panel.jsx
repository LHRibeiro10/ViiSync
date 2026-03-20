function Panel({ title, description, actionLabel, onActionClick, children }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        {actionLabel ? (
          <button className="panel-link" onClick={onActionClick}>
            {actionLabel}
          </button>
        ) : null}
      </div>

      {children}
    </div>
  );
}

export default Panel;