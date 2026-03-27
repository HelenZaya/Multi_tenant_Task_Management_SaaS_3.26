import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { api } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

export default function DashboardPage() {
  const me = useAppStore((state) => state.me);
  const [summary, setSummary] = useState(null);
  const [boards, setBoards] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    async function load() {
      const [summaryRes, boardsRes, workspaceRes] = await Promise.all([
        api.get("/boards/summary"),
        api.get("/boards"),
        api.get("/workspaces")
      ]);
      setSummary(summaryRes.data);
      setBoards(boardsRes.data.boards);
      setWorkspaces(workspaceRes.data.workspaces);
    }
    load();
  }, []);

  if (!summary) return <LoadingSkeleton label="Loading dashboard" />;

  return (
    <Layout title="Workspace dashboard" subtitle="Tenant-aware execution overview, board access, and workload posture.">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Workspaces" value={summary.workspaces} />
        <StatCard label="Boards" value={summary.boards} />
        <StatCard label="Completion" value={`${summary.completionRate}%`} helper="Across active tenant cards" />
        <StatCard label="Overdue" value={summary.overdueCards} helper="Needs attention" />
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-black/10 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Boards</h2>
            <p className="text-sm text-[color:var(--muted)]">Operational boards available to your membership.</p>
          </div>
          <div className="text-sm text-slate-400">{workspaces.length} workspaces</div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boards.map((board) => (
            <Link key={board.id} to={`/boards/${board.id}`} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 transition hover:border-[color:var(--accent)]">
              <div className="text-lg font-medium">{board.name}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">{board.workspace.name}</div>
              <div className="mt-4 text-xs text-slate-500">{board.lists.length} lists · {board._count.cards} cards</div>
            </Link>
          ))}
        </div>
      </section>

      {me?.role === "ADMIN" ? (
        <section className="mt-8 rounded-3xl border border-white/10 bg-black/10 p-6">
          <h2 className="text-xl font-semibold">Admin controls</h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Admins can invite users and create boards through the API surface.</p>
        </section>
      ) : null}
    </Layout>
  );
}
