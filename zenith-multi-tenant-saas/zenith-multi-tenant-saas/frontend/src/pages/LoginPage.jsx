import { useState } from "react";
import { api } from "../lib/api";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("admin@zenith.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      await onLogin();
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-panel">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">Zenith Workspace</h1>
          <p className="mt-2 text-sm text-slate-400">Production-style multi-tenant task management SaaS starter</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Email</span>
            <input className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 outline-none ring-0 focus:border-indigo-500" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Password</span>
            <input type="password" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 outline-none ring-0 focus:border-indigo-500" value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          <button disabled={loading} className="w-full rounded-2xl bg-indigo-500 px-4 py-3 font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60">
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>
        <div className="mt-6 text-xs text-slate-400">
          Demo password for seed users: <span className="font-medium text-slate-200">Password123!</span>
        </div>
      </div>
    </div>
  );
}
