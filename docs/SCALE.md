# Scaling and job queue

## Current behavior

- **Without Redis:** When you `POST /runs/:id/start` (or approve/replay), the orchestrator enqueues the run in-process via `setImmediate(() => executePipeline(runId))`. The pipeline runs in the same Node process. Use this for single-instance and moderate throughput.
- **With Redis:** Set `REDIS_URL` (or `HYPERSHIFT_REDIS_URL`). The API server enqueues a job to a BullMQ queue; **run one or more worker processes** that pull jobs and call `executePipeline(runId)`. Run state stays in the existing store (SQLite or in-memory); workers must use the same store (e.g. same `ORCHESTRATOR_DATABASE_PATH` and env).

## Running the worker (Redis)

1. Use the same environment as the API (database path, agent URLs, webhooks, etc.).
2. Start the worker:
   - From repo root: `pnpm --filter @hypershift/orchestrator run worker` (dev with tsx), or after `pnpm build` in the orchestrator package: `node dist/worker.js` (or `pnpm run worker:start`).
   - Worker exits with an error if `REDIS_URL` is not set.
3. Scale by running multiple worker processes (same Redis, same DB path). Each job is processed by one worker; BullMQ handles distribution.

## Queue details

- **Queue name:** `hypershift-runs`
- **Job data:** `{ runId: string }`
- **Concurrency:** One job at a time per worker (configurable in `worker.ts`).
- Jobs are added from: `POST /runs/:id/start`, `POST /runs/:id/approve`, `POST /runs/:id/replay`.

## Orchestrator API

The HTTP API only enqueues jobs and reads/writes run state. You can run the API server and workers on the same machine or separate instances as long as they share the same store (e.g. same SQLite file or same Redis/DB for run state) and env (agent URLs, etc.).

## Environment

| Variable                              | Purpose                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `REDIS_URL` or `HYPERSHIFT_REDIS_URL` | When set, run pipeline jobs are enqueued to BullMQ; start the worker process. When unset, runs execute in-process. |
| `ORCHESTRATOR_DATABASE_PATH`          | Persistent store path. Must be the same for API and workers so they see the same runs.                             |

All run and usage queries are scoped by `workspace_id`; the store (SQLite or in-memory) uses the same workspace scoping.
