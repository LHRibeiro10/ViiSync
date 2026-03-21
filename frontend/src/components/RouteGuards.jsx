import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthSession } from "../contexts/useAuthSession";

function LoadingScreen() {
  return <div className="screen-message">Validando sessao...</div>;
}

export function PublicOnlyRoute() {
  const { loading, authenticated, user } = useAuthSession();

  if (loading) {
    return <LoadingScreen />;
  }

  if (authenticated) {
    if (String(user?.role || "").toUpperCase() === "ADMIN") {
      return <Navigate to="/admin" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function ProtectedRoute() {
  const { loading, authenticated } = useAuthSession();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { loading, authenticated, user } = useAuthSession();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (String(user?.role || "").toUpperCase() !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}