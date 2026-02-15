# HyperShift

Production-ready monorepo with pnpm workspaces + Turborepo: pipeline orchestration (Architect → Builder → Sentinel → SRE → FinOps), dashboard, public API, usage limits, audit log, optional approval gate, and CLI.

## Structure

- **apps/dashboard** — Next.js 14 + Tailwind + shadcn/ui (auth, roles, usage, insights, status)
- **apps/api** — Node/Express API (TypeScript)
- **packages/shared** — Shared types and utilities
- **packages/contracts** — Zod schemas for all agent I/O
- **packages/cli** — CLI: `hypershift run "…"`, `hypershift runs list`, `hypershift runs logs <id>`
- **services/orchestrator** — Run lifecycle, pipeline, audit log, usage, webhooks, SLO
- **services/** — Agents (architect, builder, sentinel, sre, finops)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm hypershift
```

**Run the entire application (all services)** with: **`pnpm hypershift`**. This starts the dashboard, API, orchestrator, and all agents (architect, builder, sentinel, SRE, finops) from the repo root—no need to `cd` into subfolders or run multiple commands.

Open the dashboard at **http://localhost:3000**. The API is at **http://localhost:4000** and the orchestrator at **http://localhost:4001**.

### Environment variables

Copy **`.env.example`** to `.env`; defaults are enough for local dev (no API keys required for the pipeline or UI). For real LLM calls, deploys, or other integrations, set the optional vars described in **[ENV.md](./ENV.md)**. Required vs optional are summarized there.

**Persistent store (orchestrator):** Set **`ORCHESTRATOR_DATABASE_PATH`** (e.g. `./data/hypershift.sqlite`) so runs, workspaces, usage, and audit log survive restarts. If unset, the orchestrator uses an in-memory store. See [ENV.md](./ENV.md).

**Auth (dashboard):** For real sign-up and login (instead of mock auth), in **`apps/dashboard`** create a **`.env`** with **`DATABASE_URL`** (e.g. `file:./prisma/dev.db`), **`NEXTAUTH_SECRET`** (min 32 chars), and **`NEXTAUTH_URL`** (e.g. `http://localhost:3000`). Then run **`npx prisma db push`** from `apps/dashboard` once to create the auth tables. See [docs/WORKSPACES.md](./docs/WORKSPACES.md) for how workspaces map to **X-Workspace-Id**.

**Important:** Always run `pnpm hypershift` (or `pnpm dev`) from the **repo root** (this folder). If you run it only from `apps/dashboard`, the orchestrator (port 4001) and agents will not start and you'll see connection errors in the dashboard. From the root, Turborepo starts the dashboard, API, orchestrator, and all agents together.

### Real deployment (optional)

To have the pipeline actually build and deploy a Next.js app and show a live URL:

1. Set **BUILDER_AGENT_URL** so the builder agent generates the app on disk (e.g. `http://localhost:4003`).
2. Set **DEPLOY_BUILD_BASE_DIR** on the orchestrator to the same path the builder uses (e.g. `./builds`). When orchestrator and builder share the same filesystem (e.g. local dev), this is the builder's `BUILD_OUTPUT_DIR`.
3. Set **VERCEL_TOKEN** (Vercel CLI token) so the orchestrator can run `vercel deploy --prod` from the build output directory.

After a successful run, the run page shows a **View deployment** button that opens the live Vercel URL. If any of these are unset, the deploy step is skipped and the run still completes (no live URL).

### SRE sabotage demo

To see the SRE agent detect failure and recommend rollback:

1. Start the API and SRE agent (e.g. `pnpm dev`).
2. Sabotage the API so `/health` returns 500:  
   `curl -X POST http://localhost:4000/sabotage`
3. Start SRE monitoring against the API health URL:  
   `curl -X POST http://localhost:4005/sre/start -H "Content-Type: application/json" -d "{\"run_id\":\"demo\",\"deployment_url\":\"http://localhost:4000/health\"}"`  
   After 2 consecutive failed checks (~30s), the response includes an incident and `rollbackAction: "recommended"`.
4. Toggle health back to 200:  
   `curl -X POST http://localhost:4000/sabotage`

## Troubleshooting

- **`GET http://localhost:4001/runs net::ERR_CONNECTION_REFUSED`** — The orchestrator is not running. Start everything from the repo root: `pnpm hypershift` (do not run only from `apps/dashboard`).
- **Prisma `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`** (Windows) — Another process has the Prisma engine loaded. **Stop the dev server** (`pnpm hypershift` or the dashboard) and any other Node process using the dashboard, then run `pnpm exec prisma generate` (or `pnpm run db:generate`) from `apps/dashboard`. If it still fails, close the IDE or run from a new terminal. `prisma db push` can succeed even when generate fails; the schema is already in sync.

## Deployment

To run the full platform in production: **dashboard on Vercel** and **backend on Render** (single service for API + Orchestrator + all agents). See **[DEPLOY.md](./DEPLOY.md)** for:

- Vercel: root directory `apps/dashboard`, env vars `NEXT_PUBLIC_ORCHESTRATOR_URL` and `NEXT_PUBLIC_API_URL` pointing at your hosted backend.
- Render: repo root, build `pnpm install && pnpm run build`, start `pnpm run start:backend`; use the service URL as the backend base (API at `/api`, Orchestrator at `/`).
- Step-by-step: deploy backend first → get URL → deploy dashboard with those env vars.

## Features

- **Trust & safety:** Login (mock session), roles (viewer / operator / admin), immutable audit log, optional approval before production deploy.
- **Platform:** Public REST API for runs (create, list, get, start, rollback, approve, reject); see **[OPENAPI.md](./OPENAPI.md)**. Webhooks: `run.created`, `run.completed`, `deploy.succeeded`. Agent contract: **[docs/AGENT_CONTRACT.md](./docs/AGENT_CONTRACT.md)**.
- **Observability:** Run outcomes and SLO (success rate, avg duration) in dashboard **Insights**; **Status** page for platform health. A **public status page** (no login) is at **`/status-page`** when using the dashboard.
- **Monetization:** Usage metering (runs per workspace/period), free-tier limit (10 runs/month), enforced on create; see **[docs/TIER.md](./docs/TIER.md)**.
- **Multi-tenant:** Workspace/org via `X-Workspace-Id` or `X-Org-Id`; all runs and usage scoped by workspace.
- **CLI:** `pnpm exec hypershift run "deploy a Next.js app"`, `hypershift runs list`, `hypershift runs logs <id>`. Set `HYPERSHIFT_ORCHESTRATOR_URL` (default `http://localhost:4001`). API keys: use `Authorization: Bearer hs_...` or `HYPERSHIFT_API_KEY` for workspace-scoped calls. CI example in **[DEPLOY.md](./DEPLOY.md)**.
- **Scaling:** With **Redis** (`REDIS_URL`), run pipeline jobs are enqueued; run one or more **worker** processes to process them. See **[docs/SCALE.md](./docs/SCALE.md)**.

## Scripts

| Command               | Description                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------ |
| **`pnpm hypershift`** | **Run the entire application** — dashboard, API, orchestrator, all agents (from repo root) |
| `pnpm dev`            | Same as `pnpm hypershift` (all apps and services)                                          |
| `pnpm demo`           | Start all services, open dashboard, print demo steps                                       |
| `pnpm build`          | Build all packages                                                                         |
| `pnpm lint`           | Lint all packages                                                                          |
| `pnpm format`         | Format with Prettier                                                                       |
| `pnpm typecheck`      | Type-check all packages                                                                    |

## Why Node/Express for the API?

- Same runtime as Next.js and all services → single TypeScript ecosystem.
- Shared packages (`@hypershift/shared`, `@hypershift/contracts`) work without cross-language boundaries.
- One toolchain (ESLint, Prettier, pnpm) and a single `pnpm hypershift` to run everything.
>>>>>>> bc5b209 (Initial commit - HyperShift autonomous cloud orchestration UI)
