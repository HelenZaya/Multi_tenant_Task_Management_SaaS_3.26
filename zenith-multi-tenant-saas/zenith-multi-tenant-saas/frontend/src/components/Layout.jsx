import { Link } from "react-router-dom";
import { KanbanSquare, LogOut } from "lucide-react";

export default function Layout({ me, onLogout, children, title, subtitle, actions }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-500/15 p-3 text-indigo-300"><KanbanSquare size={20} /></div>
            <div>
              <Link to="/" className="text-lg font-semibold tracking-wide">Zenith Workspace</Link>
              <p className="text-xs text-slate-400">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <div className="hidden rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm md:block">
              <div className="font-medium">{me.name}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">{me.role}</div>
            </div>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {subtitle && <p className="mb-6 text-slate-400">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}
