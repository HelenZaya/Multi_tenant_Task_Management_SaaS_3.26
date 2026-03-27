import { reportQueue } from "../lib/queue.js";
import { boardService } from "./boardService.js";
export const reportService = {
    async getReportingSnapshot(tenantId) {
        const summary = await boardService.dashboardSummary(tenantId);
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
    async enqueueReportGeneration(tenantId, actorId) {
        const job = await reportQueue.add("report.generate", { tenantId, actorId });
        return { jobId: job.id };
    }
};
