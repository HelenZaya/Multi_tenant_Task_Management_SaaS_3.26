import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { api } from "../lib/api";

export default function ReportingPage() {
  const [report, setReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/reports").then(({ data }) => setReport(data));
  }, []);

  async function generate() {
    setSubmitting(true);
    try {
      await api.post("/reports/generate");
      const { data } = await api.get("/reports");
      setReport(data);
    } finally {
      setSubmitting(false);
    }
  }

  if (!report) return <LoadingSkeleton label="Loading reports" />;

  return (
    <Layout title="Reporting dashboard" subtitle="CQRS-style read snapshot for tenant analytics." actions={<button onClick={generate} className="rounded-2xl bg-[color:var(--accent-2)] px-4 py-2 text-sm font-medium text-slate-950">{submitting ? "Generating..." : "Generate report"}</button>}>
      <div className="grid gap-4 md:grid-cols-3">
        {report.trends.map((trend) => <StatCard key={trend.label} label={trend.label} value={trend.value} />)}
      </div>
      <section className="mt-8 rounded-3xl border border-white/10 bg-black/10 p-6">
        <h2 className="text-xl font-semibold">Latest snapshot</h2>
        <pre className="mt-4 overflow-auto rounded-3xl bg-slate-950/70 p-4 text-sm text-slate-300">{JSON.stringify(report, null, 2)}</pre>
      </section>
    </Layout>
  );
}
