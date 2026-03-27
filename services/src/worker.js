import dotenv from "dotenv";
import { QueueEvents, Worker } from "bullmq";
import Redis from "ioredis";
import pino from "pino";

dotenv.config();

const logger = pino({ level: process.env.NODE_ENV === "production" ? "info" : "debug" });
const connection = { url: process.env.REDIS_URL || "redis://redis:6379" };
const redis = new Redis(connection.url, { maxRetriesPerRequest: null });
const subscriber = redis.duplicate();

new Worker("email-notifications", async (job) => {
  logger.info({ jobId: job.id, data: job.data }, "email notification processed");
}, { connection });

new Worker("deadline-reminders", async (job) => {
  logger.info({ jobId: job.id, data: job.data }, "deadline reminder processed");
}, { connection });

new Worker("report-generation", async (job) => {
  logger.info({ jobId: job.id, data: job.data }, "report generation processed");
  return { generatedAt: new Date().toISOString() };
}, { connection });

for (const queueName of ["email-notifications", "deadline-reminders", "report-generation"]) {
  const queueEvents = new QueueEvents(queueName, { connection });
  queueEvents.on("completed", ({ jobId }) => logger.info({ queueName, jobId }, "job completed"));
}

await subscriber.subscribe("domain-events");
subscriber.on("message", (_channel, payload) => {
  logger.info({ payload: JSON.parse(payload) }, "domain event received");
});

logger.info("worker started");
