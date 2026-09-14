function ProductsToolbar({
  searchTerm,
  onSearchTermChange,
  selectedStatus,
  onSelectedStatusChange,
  statusOptions,
}) {
  return (
    <div className="products-toolbar">
      <input
        type="text"
        placeholder="Buscar produto, SKU ou status"
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
      />
      <select value={selectedStatus} onChange={(event) => onSelectedStatusChange(event.target.value)}>
        <option value="all">Todos os status</option>
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ProductsToolbar;
