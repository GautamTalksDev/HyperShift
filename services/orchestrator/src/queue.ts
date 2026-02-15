/**
 * Run pipeline job queue. When REDIS_URL is set, jobs are added to a BullMQ queue
 * and processed by a separate worker process. When not set, jobs run in-process via setImmediate.
 */
import { env } from "./env.js";
import { executePipeline } from "./pipeline.js";

const QUEUE_NAME = "hypershift-runs";

let bullQueue: import("bullmq").Queue | null = null;

async function getBullQueue(): Promise<import("bullmq").Queue | null> {
  if (!env.REDIS_URL) return null;
  if (bullQueue) return bullQueue;
  const { Queue } = await import("bullmq");
  bullQueue = new Queue(QUEUE_NAME, {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: { removeOnComplete: { count: 1000 }, attempts: 1 },
  });
  return bullQueue;
}

/** Enqueue a pipeline run. With Redis: adds to queue (worker process runs it). Without: runs in-process. */
export async function addRunJob(runId: string): Promise<void> {
  const queue = await getBullQueue();
  if (queue) {
    await queue.add("run", { runId }, { jobId: runId });
    return;
  }
  setImmediate(() => executePipeline(runId));
}

export { QUEUE_NAME };
