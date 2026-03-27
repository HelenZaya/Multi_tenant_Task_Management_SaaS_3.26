import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function RegisterPage({ onRegister }) {
  const [form, setForm] = useState({ name: "", email: "", password: "Password123!", tenantName: "", tenantSlug: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/register", form);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      await onRegister();
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-6">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-black/20 p-8 backdrop-blur-xl">
        <h1 className="text-3xl font-semibold">Create tenant</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Boot a new isolated workspace with an admin user.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
          <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 md:col-span-2" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" placeholder="Tenant name" value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} />
          <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3" placeholder="tenant-slug" value={form.tenantSlug} onChange={(e) => setForm({ ...form, tenantSlug: e.target.value.toLowerCase() })} />
          {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 md:col-span-2">{error}</div> : null}
          <button disabled={loading} className="rounded-2xl bg-[color:var(--accent)] px-4 py-3 font-medium text-slate-950 md:col-span-2 disabled:opacity-50">{loading ? "Creating..." : "Create tenant"}</button>
        </form>
        <div className="mt-4 text-sm text-slate-400">Already have an account? <Link to="/login" className="text-[color:var(--accent)]">Sign in</Link></div>
      </div>
    </div>
  );
}
