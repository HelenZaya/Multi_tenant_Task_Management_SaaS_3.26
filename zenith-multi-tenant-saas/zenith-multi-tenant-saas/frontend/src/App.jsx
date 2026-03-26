import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "./lib/api";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BoardPage from "./pages/BoardPage";
import { getSocket } from "./lib/socket";

export default function App() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadMe();
  }, []);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-slate-400">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={loadMe} />} />
      <Route path="/" element={me ? <DashboardPage me={me} onLogout={() => { localStorage.clear(); setMe(null); }} /> : <Navigate to="/login" replace />} />
      <Route path="/boards/:boardId" element={me ? <BoardPage me={me} /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
