import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/index.js';
import AppShell from './components/AppShell.jsx';
import NotificationScheduler from './components/NotificationScheduler.jsx';
import ToastHost from './components/ToastHost.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import RecoverPassword from './pages/RecoverPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AssetDetail from './pages/AssetDetail.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Rankings from './pages/Rankings.jsx';
import Comparador from './pages/Comparador.jsx';
import Chat from './pages/Chat.jsx';
import Alerts from './pages/Alerts.jsx';
import MyAlerts from './pages/MyAlerts.jsx';
import SearchPage from './pages/SearchPage.jsx';
import Settings from './pages/Settings.jsx';

function Private({ children }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <>
      <NotificationScheduler />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/recuperar-senha" element={<RecoverPassword />} />
        <Route path="/" element={<Private><Dashboard /></Private>} />
        <Route path="/ativo/:ticker" element={<Private><AssetDetail /></Private>} />
        <Route path="/portfolio" element={<Private><Portfolio /></Private>} />
        <Route path="/rankings" element={<Private><Rankings /></Private>} />
        <Route path="/comparar" element={<Private><Comparador /></Private>} />
        <Route path="/chat" element={<Private><Chat /></Private>} />
        <Route path="/alertas" element={<Private><Alerts /></Private>} />
        <Route path="/meus-alertas" element={<Private><MyAlerts /></Private>} />
        <Route path="/busca" element={<Private><SearchPage /></Private>} />
        <Route path="/configuracoes" element={<Private><Settings /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </>
  );
}
