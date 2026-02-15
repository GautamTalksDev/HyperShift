/**
 * Standalone worker process. Run when using Redis: processes run pipeline jobs from the queue.
 * Usage: REDIS_URL=redis://... node dist/worker.js   (or tsx src/worker.ts)
 * The API server (index.ts) enqueues jobs; one or more workers process them.
 */
import { env } from "./env.js";
import { initStore } from "./store.js";
import { QUEUE_NAME } from "./queue.js";
import { executePipeline } from "./pipeline.js";

initStore();

if (!env.REDIS_URL) {
  console.error(
    "REDIS_URL (or HYPERSHIFT_REDIS_URL) is required to run the worker.",
  );
  process.exit(1);
}

async function main() {
  const { Worker } = await import("bullmq");
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const runId = job.data?.runId;
      if (!runId || typeof runId !== "string") {
        throw new Error("Job data.runId required");
      }
      await executePipeline(runId);
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 1,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[worker] run ${job.data?.runId} completed`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[worker] run ${job?.data?.runId} failed`, err),
  );
  console.log("HyperShift run worker started (Redis). Waiting for jobs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
