import { subscribeWorkerJobs, type WorkerJob } from "@taskflow/db";
import { createLogger } from "@taskflow/utils";
import { rebalanceLexoRank, rebalanceColumns } from "./jobs/rebalance.js";

const logger = createLogger("worker:listener");

/**
 * Listen for on-demand worker jobs via Redis pub/sub.
 * Jobs are published by other services when they need background processing.
 */
export async function startJobListener(redisUrl: string): Promise<void> {
  await subscribeWorkerJobs(redisUrl, async (job: WorkerJob) => {
    logger.info({ type: job.type, tenantId: job.tenantId }, "Received worker job");

    try {
      switch (job.type) {
        case "rebalance_lexorank":
          await rebalanceLexoRank(
            job.tenantId,
            job.payload["projectId"] as string,
            job.payload["columnId"] as string
          );
          break;

        case "rebalance_columns":
          await rebalanceColumns(
            job.tenantId,
            job.payload["boardId"] as string
          );
          break;

        case "send_invite_email":
          logger.info(
            { email: job.payload["email"], tenantId: job.tenantId },
            "[DEV] Would send invite email"
          );
          break;

        default:
          logger.warn({ type: job.type }, "Unknown worker job type");
      }
    } catch (err) {
      logger.error({ err, type: job.type, tenantId: job.tenantId }, "Worker job failed");
    }
  });

  logger.info("Worker job listener started");
}
