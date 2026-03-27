import { createLogger } from "@taskflow/utils";

const logger = createLogger("worker:scheduler");

interface ScheduledJob {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  timer?: ReturnType<typeof setInterval>;
}

const jobs: ScheduledJob[] = [];

export function scheduleJob(
  name: string,
  intervalMs: number,
  handler: () => Promise<void>
): void {
  jobs.push({ name, intervalMs, handler });
  logger.info(
    { name, intervalMs, intervalHuman: `${Math.round(intervalMs / 1000)}s` },
    "Job scheduled"
  );
}

export function startScheduler(): void {
  for (const job of jobs) {
    // Run immediately
    runJob(job);

    // Then on interval
    job.timer = setInterval(() => runJob(job), job.intervalMs);
  }

  logger.info({ jobCount: jobs.length }, "Scheduler started");
}

export function stopScheduler(): void {
  for (const job of jobs) {
    if (job.timer) {
      clearInterval(job.timer);
      job.timer = undefined;
    }
  }
  logger.info("Scheduler stopped");
}

async function runJob(job: ScheduledJob): Promise<void> {
  const start = Date.now();
  try {
    await job.handler();
    const duration = Date.now() - start;
    logger.info({ name: job.name, durationMs: duration }, "Job completed");
  } catch (err) {
    const duration = Date.now() - start;
    logger.error(
      { err, name: job.name, durationMs: duration },
      "Job failed"
    );
  }
}
