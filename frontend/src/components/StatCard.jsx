export default function StatCard({ label, value, helper }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/10 p-5">
      <div className="text-sm text-[color:var(--muted)]">{label}</div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
      {helper ? <div className="mt-2 text-xs text-slate-400">{helper}</div> : null}
    </div>
  );
}
