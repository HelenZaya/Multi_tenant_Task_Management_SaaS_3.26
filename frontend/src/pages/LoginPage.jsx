import { useState } from "react";
import { Link } from "react-router-dom";
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
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-black/20 p-8 backdrop-blur-xl">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.35em] text-[color:var(--accent)]">Enterprise SaaS</div>
          <h1 className="mt-3 text-3xl font-semibold">Multi-tenant Task Control</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Secure sign-in for the seeded demo workspace.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input type="password" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          <button disabled={loading} className="w-full rounded-2xl bg-[color:var(--accent)] px-4 py-3 font-medium text-slate-950 disabled:opacity-50">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm text-slate-400">
          <span>Demo password: Password123!</span>
          <Link to="/register" className="text-[color:var(--accent)]">Register</Link>
        </div>
      </div>
    </div>
  );
}
