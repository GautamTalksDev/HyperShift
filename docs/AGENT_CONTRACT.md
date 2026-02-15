# HyperShift agent contract

This document describes how a custom step (agent) plugs into the pipeline so you can add or replace agents.

## Pipeline order

The orchestrator runs steps in order:

1. **Architect** — intent → blueprint
2. **Builder** — blueprint + intent → build plan
3. **Sentinel** — blueprint + build plan → security report (can block)
4. _(Optional approval gate)_
5. **SRE** — deployment health (can recommend rollback)
6. **FinOps** — cost estimate
7. Deploy (orchestrator or external)

## Contract for an agent

- **HTTP** — Agents are called over HTTP (optional; if URL not set, orchestrator uses stubs).
- **Input** — The orchestrator POSTs a JSON body. Each agent has a defined input shape (see below).
- **Output** — The agent returns JSON. The orchestrator stores it in the run and passes it to the next step where needed.
- **Timeout** — `AGENT_TIMEOUT_MS` (default 60s). Orchestrator fails the run if the agent does not respond in time.
- **Idempotency** — Agents should be idempotent for the same input; the orchestrator may retry or replay.

## Per-agent contract

### Architect

- **URL:** `ARCHITECT_AGENT_URL` (e.g. `http://localhost:4002`)
- **Endpoint:** `POST /architect`
- **Request body:** `{ "user_intent": { "description": string, "target"?: string, "constraints"?: string } }`
- **Response:** `{ "blueprint_manifest": object }` — used by Builder and Sentinel.

### Builder

- **URL:** `BUILDER_AGENT_URL`
- **Endpoint:** `POST /builder`
- **Request body:** `{ "user_intent": {...}, "blueprint_manifest": object }`
- **Response:** Any JSON (e.g. `buildSteps`, `outputDir`) — used by Sentinel.

### Sentinel

- **URL:** `SENTINEL_AGENT_URL`
- **Endpoint:** `POST /sentinel`
- **Request body:** `{ "blueprint_manifest": object, "build_plan": object }`
- **Response:** Must include `veto: boolean`. If `veto === true`, the pipeline stops (blocked) and no deploy.

### SRE

- **URL:** `SRE_AGENT_URL`
- **Endpoint:** `POST /sre/check`
- **Request body:** `{ "deployment_url": string | null, "run_id": string }`
- **Response:** Any JSON; if `rollbackAction === "recommended"` or `"required"`, UI shows rollback recommendation.

### FinOps

- **URL:** `FINOPS_AGENT_URL`
- **Endpoint:** `POST /finops`
- **Request body:** `{ "blueprint_manifest": object, "infra"?: object }`
- **Response:** Any JSON (e.g. `estimatedMonthlyCost`, `currency`).

## Adding a custom agent

1. Implement an HTTP server that:
   - Listens on a port (e.g. 4007).
   - Exposes `GET /health` returning `{ "status": "ok" }`.
   - Exposes the contract endpoint (e.g. `POST /my-step`) and returns JSON within the timeout.

2. In the orchestrator:
   - Add a new step in `pipeline.ts` (read previous step output, call your agent, write output to run).
   - Add env var `MY_AGENT_URL` and call it from a small helper in `agents.ts`.
   - Append to the run’s audit log and optionally emit a webhook.

3. In the dashboard (optional):
   - Add the step to the pipeline visualization and run detail (e.g. in `utils/agents.ts` and run page).

## Stub behavior

If an agent URL is not set, the orchestrator uses an in-memory stub so the pipeline still completes. Stubs return minimal valid shapes (e.g. Sentinel returns `veto: false`). This allows local dev without running every agent.
