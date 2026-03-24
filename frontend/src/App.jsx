import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import AdminLayout from "./components/AdminLayout";
import AuthLayout from "./components/AuthLayout";
import Alerts from "./pages/Alerts";
import AdminFeedbackInbox from "./pages/AdminFeedbackInbox";
import AdminObservability from "./pages/AdminObservability";
import AdminUsers from "./pages/AdminUsers";
import AutomationCenter from "./pages/AutomationCenter";
import Dashboard from "./pages/Dashboard";
import FinanceCenter from "./pages/FinanceCenter";
import ForgotPassword from "./pages/ForgotPassword";
import Orders from "./pages/Orders";
import MercadoLivreQuestions from "./pages/MercadoLivreQuestions";
import OperationsCalendar from "./pages/OperationsCalendar";
import Products from "./pages/Products";
import AdminOverview from "./pages/AdminOverview";
import Login from "./pages/Login";
import ProductDetail from "./pages/ProductDetail";
import Register from "./pages/Register";
import Reports from "./pages/Reports";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import UserCenter from "./pages/UserCenter";
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from "./components/RouteGuards";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/reclamacoes" element={<AdminFeedbackInbox />} />
            <Route path="/admin/observabilidade" element={<AdminObservability />} />
            <Route path="/admin/usuarios" element={<AdminUsers />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alertas" element={<Alerts />} />
            <Route path="/financeiro" element={<FinanceCenter />} />
            <Route path="/calendario" element={<OperationsCalendar />} />
            <Route path="/automacoes" element={<AutomationCenter />} />
            <Route path="/pedidos" element={<Orders />} />
            <Route
              path="/mercado-livre/perguntas"
              element={<MercadoLivreQuestions />}
            />
            <Route path="/produtos" element={<Products />} />
            <Route path="/produtos/:productId" element={<ProductDetail />} />
            <Route path="/usuario" element={<UserCenter />} />
            <Route
              path="/contas"
              element={<Navigate to="/usuario?tab=integracoes" replace />}
            />
            <Route
              path="/integracoes"
              element={<Navigate to="/usuario?tab=integracoes" replace />}
            />
            <Route path="/relatorios" element={<Reports />} />
            <Route path="/feedback" element={<Navigate to="/usuario?tab=feedback" replace />} />
            <Route path="/configuracoes" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
