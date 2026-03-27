import { reportService } from "../services/reportService.js";
export const reportController = {
    async snapshot(req, res, next) {
        try {
            const report = await reportService.getReportingSnapshot(req.auth.tenantId);
            res.json(report);
        }
        catch (error) {
            next(error);
        }
    },
    async generate(req, res, next) {
        try {
            const job = await reportService.enqueueReportGeneration(req.auth.tenantId, req.auth.userId);
            res.status(202).json(job);
        }
        catch (error) {
            next(error);
        }
    }
};
