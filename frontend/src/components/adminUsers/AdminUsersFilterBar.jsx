function AdminUsersFilterBar({ filters, onFilterChange }) {
  return (
    <section className="admin-users-filter-bar">
      <input
        type="search"
        name="search"
        value={filters.search}
        onChange={onFilterChange}
        placeholder="Buscar por seller, empresa, email ou plano"
      />

      <select name="subscription" value={filters.subscription} onChange={onFilterChange}>
        <option value="all">Todas as assinaturas</option>
        <option value="paid">Somente pagantes</option>
        <option value="trial">Somente trial</option>
      </select>

      <select name="blockStatus" value={filters.blockStatus} onChange={onFilterChange}>
        <option value="all">Todos os status</option>
        <option value="active">Somente ativos</option>
        <option value="blocked">Somente bloqueados</option>
      </select>
    </section>
  );
}

export default AdminUsersFilterBar;
