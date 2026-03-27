import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { api } from "./lib/api";
import { getSocket } from "./lib/socket";
import { useAppStore } from "./store/useAppStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import BoardPage from "./pages/BoardPage";
import ReportingPage from "./pages/ReportingPage";
import { LoadingSkeleton } from "./components/LoadingSkeleton";

function ProtectedRoute({ children }) {
  const me = useAppStore((state) => state.me);
  return me ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { me, loading, setMe, setLoading } = useAppStore();

  async function loadMe() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setLoading(false);
      setMe(null);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setMe(data.user);
      const socket = getSocket();
      socket.auth = { token };
      if (!socket.connected) socket.connect();
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMe(); }, []);

  if (loading) {
    return <LoadingSkeleton label="Loading workspace" />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={loadMe} />} />
      <Route path="/register" element={<RegisterPage onRegister={loadMe} />} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/boards/:boardId" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportingPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={me ? "/" : "/login"} replace />} />
    </Routes>
  );
}
