export function LoadingSkeleton({ label = "Loading" }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-5xl animate-pulse space-y-6">
        <div className="h-16 rounded-3xl bg-white/5" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 rounded-3xl bg-white/5" />)}
        </div>
        <div className="h-96 rounded-3xl bg-white/5" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
