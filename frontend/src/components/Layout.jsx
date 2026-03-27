import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, KanbanSquare, LogOut, LayoutDashboard } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

export default function Layout({ title, subtitle, actions, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const me = useAppStore((state) => state.me);
  const setMe = useAppStore((state) => state.setMe);

  function logout() {
    localStorage.clear();
    setMe(null);
    navigate("/login");
  }

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/reports", label: "Reporting", icon: BarChart3 },
    { to: me?.role === "VIEWER" ? "/" : "/boards/zenith-board", label: "Board", icon: KanbanSquare }
  ];

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-8">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">{me?.tenantName}</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link key={to + label} to={to} className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm ${location.pathname === to ? "border-[color:var(--accent)] bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
                <Icon size={16} />
                {label}
              </Link>
            ))}
            {actions}
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </header>
        <div className="mb-6 flex items-center justify-between rounded-3xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-[color:var(--muted)]">
          <span>{me?.name} · {me?.email}</span>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[color:var(--accent)]">{me?.role}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
