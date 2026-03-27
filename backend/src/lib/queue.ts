import { Queue } from "bullmq";
import { env } from "../config/env.js";

const connection = { url: env.REDIS_URL };

export const emailQueue = new Queue("email-notifications", { connection });
export const deadlineQueue = new Queue("deadline-reminders", { connection });
export const reportQueue = new Queue("report-generation", { connection });
