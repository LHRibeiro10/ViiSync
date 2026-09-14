import { useEffect, useMemo, useState } from "react";
import { getAdminUsers, toggleAdminUserBlock } from "../services/api";
import AdminUsersSummaryGrid from "../components/adminUsers/AdminUsersSummaryGrid";
import AdminUsersFilterBar from "../components/adminUsers/AdminUsersFilterBar";
import AdminUsersListPanel from "../components/adminUsers/AdminUsersListPanel";
import AdminUsersDetailPanel from "../components/adminUsers/AdminUsersDetailPanel";
import { matchesFilters } from "../utils/adminUsersInsights";
import "./AdminUsers.css";

function AdminUsers() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    subscription: "all",
    blockStatus: "all",
  });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
  const [blockReason, setBlockReason] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadUsers() {
      try {
        setError("");
        setLoading(true);
        const response = await getAdminUsers();

        if (!isCancelled) {
          setPayload(response);
        }
      } catch {
        if (!isCancelled) {
          setError("Nao foi possivel carregar a gestao de usuarios.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      isCancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!payload?.items?.length) {
      return [];
    }

    return payload.items.filter((user) => matchesFilters(user, filters));
  }, [payload, filters]);

  useEffect(() => {
    if (!filteredUsers.length) {
      setSelectedUserId("");
      return;
    }

    const selectedExists = filteredUsers.some((user) => user.id === selectedUserId);

    if (!selectedExists) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId]);

  const selectedUser = useMemo(() => {
    return filteredUsers.find((user) => user.id === selectedUserId) || null;
  }, [filteredUsers, selectedUserId]);

  function handleFilterChange(event) {
    const { name, value } = event.target;

    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  function handleSelectUser(userId) {
    setSelectedUserId(userId);
    setActionFeedback("");
    setBlockReason("");
  }

  async function handleToggleBlock() {
    if (!selectedUser) {
      return;
    }

    try {
      setBusyUserId(selectedUser.id);
      setActionFeedback("");

      const response = await toggleAdminUserBlock(
        selectedUser.id,
        !selectedUser.isBlocked,
        selectedUser.isBlocked ? "" : blockReason
      );

      setPayload((currentPayload) => {
        if (!currentPayload) {
          return currentPayload;
        }

        return {
          ...currentPayload,
          summary: response.summary,
          items: currentPayload.items.map((user) =>
            user.id === response.item.id ? response.item : user
          ),
        };
      });

      setActionFeedback(
        selectedUser.isBlocked
          ? "Seller desbloqueado com sucesso."
          : "Seller bloqueado com sucesso."
      );
      setBlockReason("");
    } catch {
      setActionFeedback("Nao foi possivel atualizar o status desse seller.");
    } finally {
      setBusyUserId("");
    }
  }

  if (loading && !payload) {
    return <div className="screen-message">Carregando usuarios...</div>;
  }

  return (
    <div className="admin-users-page">
      <header className="admin-users-hero">
        <div>
          <span className="admin-users-tag">Gestao de contas</span>
          <h1>Usuarios e sellers</h1>
          <p>
            Acompanhe sellers pagantes, onboarding, risco de churn e bloqueio
            administrativo a partir de um unico painel.
          </p>
        </div>
      </header>

      {error ? <div className="admin-users-inline-alert">{error}</div> : null}

      <AdminUsersSummaryGrid summary={payload?.summary} />

      <AdminUsersFilterBar filters={filters} onFilterChange={handleFilterChange} />

      <div className="admin-users-grid">
        <AdminUsersListPanel
          filteredUsers={filteredUsers}
          selectedUserId={selectedUserId}
          onSelectUser={handleSelectUser}
        />

        <AdminUsersDetailPanel
          selectedUser={selectedUser}
          blockReason={blockReason}
          onBlockReasonChange={setBlockReason}
          actionFeedback={actionFeedback}
          busyUserId={busyUserId}
          onToggleBlock={handleToggleBlock}
        />
      </div>
    </div>
  );
}

export default AdminUsers;
