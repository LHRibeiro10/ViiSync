function PageHeader({ tag, title, description, children }) {
  return (
    <div className="header">
      <div className="header-copy">
        <span className="tag">{tag}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {children ? <div className="header-actions">{children}</div> : null}
    </div>
  );
}

export default PageHeader;
