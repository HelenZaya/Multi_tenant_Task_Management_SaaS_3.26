import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import { api } from "../lib/api";

export default function DashboardPage({ me, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [boards, setBoards] = useState([]);

  async function load() {
    const [summaryRes, boardsRes] = await Promise.all([
      api.get("/dashboard/summary"),
      api.get("/boards"),
    ]);
    setSummary(summaryRes.data);
    setBoards(boardsRes.data.boards);
  }

  useEffect(() => { load(); }, []);

  return (
    <Layout me={me} onLogout={onLogout} title="Workspace Summary" subtitle="Dark theme dashboard with overdue and completion insights.">
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Organizations" value={summary.organizations} />
          <StatCard label="Boards" value={summary.boards} />
          <StatCard label="Completion" value={`${summary.completionRate}%`} helper="Across all visible cards" />
          <StatCard label="Overdue" value={summary.overdueCards} />
        </div>
      )}

      <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Boards</h2>
            <p className="text-sm text-slate-400">Select a board to manage lists and cards.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boards.map(board => (
            <Link key={board.id} to={`/boards/${board.id}`} className="rounded-3xl border border-slate-800 bg-slate-950 p-5 transition hover:border-indigo-500/60 hover:bg-slate-900">
              <div className="text-lg font-medium">{board.name}</div>
              <div className="mt-1 text-sm text-slate-400">{board.workspace.name}</div>
              <div className="mt-4 text-xs text-slate-500">{board.lists.length} lists • {board._count.cards} cards</div>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
