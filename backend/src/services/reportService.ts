import { reportQueue } from "../lib/queue.js";
import { boardService } from "./boardService.js";

export const reportService = {
  async getReportingSnapshot(tenantId: string) {
    const summary = await boardService.dashboardSummary(tenantId) as {
      doneCards: number;
      overdueCards: number;
      cards: number;
    };
    return {
      generatedAt: new Date().toISOString(),
      summary,
      trends: [
        { label: "Completed", value: summary.doneCards },
        { label: "Overdue", value: summary.overdueCards },
        { label: "Open", value: summary.cards - summary.doneCards }
      ]
    };
  },
  async enqueueReportGeneration(tenantId: string, actorId: string) {
    const job = await reportQueue.add("report.generate", { tenantId, actorId });
    return { jobId: job.id };
  }
};
