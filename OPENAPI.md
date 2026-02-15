# HyperShift Runs API (OpenAPI-style)

Base URL: `{ORCHESTRATOR_URL}` (e.g. `http://localhost:4001` or `https://your-backend.onrender.com`).

Optional headers for multi-tenant and audit:

- `X-Workspace-Id` or `X-Org-Id` — workspace/org scope (default: `ws-default`)
- `X-User-Id` or `X-Actor` — user/actor for audit (approve, reject, create)

See ** [docs/WORKSPACES.md](./docs/WORKSPACES.md)** for how workspaces are created and how the dashboard maps session to `X-Workspace-Id`.

---

## Workspaces

### Create workspace

`POST /workspaces`

**Request body:** `{ "name": "Optional display name" }`

**Response:** `201 Created`

```json
{ "id": "ws-xxx", "name": "My Workspace", "tier": "free", "created_at": "..." }
```

Used by the dashboard when a user signs up (creates a default workspace) or creates a new team. The returned `id` is used as `X-Workspace-Id` for all subsequent run and usage requests.

### Get workspace

`GET /workspaces/:id`

**Response:** `200 OK` — `{ "id", "name", "tier", "created_at" }` or `404` if not found.

### Update workspace tier

`PATCH /workspaces/:id/tier`

**Request body:** `{ "tier": "free" | "pro" }`

**Headers:** If `WORKSPACE_TIER_UPDATE_SECRET` is set on the orchestrator, send `X-Webhook-Secret: <secret>` (e.g. from Stripe webhook handler).

**Response:** `200 OK` — updated workspace object. Used by the dashboard after Stripe checkout or subscription change to set workspace tier (Pro = 1000 runs/month).

---

## Runs

### Create run

`POST /runs`

**Request body:**

```json
{
  "user_intent": {
    "description": "Deploy a Next.js app",
    "target": "production",
    "constraints": "free tier only"
  },
  "codename": "optional-human-name",
  "tags": ["tag1", "tag2"],
  "require_approval": false
}
```

**Response:** `201 Created`

```json
{ "run_id": "req-xxx-yyy" }
```

**Errors:**

- `400` — Invalid `user_intent`
- `402` — Run limit exceeded for period (see `current`, `limit`, `period` in body)

---

### List runs

`GET /runs?tag=foo&workspace_id=ws-default`

**Response:** `200 OK`

```json
{
  "runs": [
    {
      "id": "req-xxx",
      "status": "pending",
      "created_at": "2025-02-15T12:00:00.000Z",
      "codename": null,
      "tags": []
    }
  ]
}
```

---

### Get run

`GET /runs/{run_id}`

**Response:** `200 OK`

```json
{
  "id": "req-xxx",
  "status": "running",
  "current_step": 2,
  "error": null,
  "user_intent": { "description": "...", "target": "...", "constraints": "..." },
  "architect_output": { ... },
  "builder_output": null,
  "sentinel_output": null,
  "sre_output": null,
  "finops_output": null,
  "created_at": "...",
  "updated_at": "...",
  "deployment_url": null,
  "codename": null,
  "tags": [],
  "require_approval": false,
  "approved_at": null,
  "approved_by": null,
  "rejected_at": null,
  "rejected_by": null
}
```

**Response:** `404` — Run not found

---

### Start run

`POST /runs/{run_id}/start`

Starts the pipeline for a pending run. Returns immediately; pipeline runs in background.

**Response:** `202 Accepted`

```json
{ "message": "Run started" }
```

**Errors:** `400` — Run is not pending; `404` — Run not found

---

### Approve run (production deploy gate)

`POST /runs/{run_id}/approve`

Use when run is `blocked` and `require_approval` is true. Resumes pipeline from SRE step.

**Response:** `200 OK`

```json
{ "message": "Approved", "run_id": "req-xxx" }
```

---

### Reject run

`POST /runs/{run_id}/reject`

Use when run is `blocked` and awaiting approval. Marks run as rejected (stays blocked).

**Response:** `200 OK`

```json
{ "message": "Rejected", "run_id": "req-xxx" }
```

---

### Rollback

`POST /runs/{run_id}/rollback`

Records a rollback in the audit log (mock: no infra change).

**Response:** `200 OK`

```json
{ "message": "Rollback recorded (mock)", "audit_recorded": true }
```

---

### Replay run

`POST /runs/{run_id}/replay`

Creates a new run with the same `user_intent` and starts it.

**Response:** `201 Created`

```json
{ "run_id": "req-new-id" }
```

---

### Get run logs (audit)

`GET /runs/{run_id}/logs`

**Response:** `200 OK`

```json
{
  "run_id": "req-xxx",
  "logs": [
    {
      "id": 1,
      "run_id": "req-xxx",
      "created_at": "...",
      "action": "run.created",
      "details": { ... }
    }
  ]
}
```

---

## Usage

`GET /usage`

Returns usage and limit for the current workspace (from header or default).

**Response:** `200 OK`

```json
{
  "workspace_id": "ws-default",
  "period": "2025-02-01",
  "runs": 3,
  "limit": 10,
  "tier": "free"
}
```

---

## Observability

### Outcomes

`GET /observability/outcomes`

Run outcomes (success/failure, duration, failed_step) for the workspace.

**Response:** `200 OK`

```json
{
  "workspace_id": "ws-default",
  "outcomes": [
    {
      "run_id": "req-xxx",
      "status": "completed",
      "duration_ms": 12000,
      "failed_step": null,
      "completed_at": "..."
    }
  ]
}
```

### SLO

`GET /observability/slo?days=7`

Success rate and average duration over the last N days (1–30, default 7).

**Response:** `200 OK`

```json
{
  "workspace_id": "ws-default",
  "days": 7,
  "total_runs": 10,
  "success_count": 8,
  "failure_count": 1,
  "blocked_count": 1,
  "success_rate": 0.8,
  "avg_duration_ms": 15000
}
```

---

## Other

- `GET /health` — Liveness
- `GET /status` — Operational status and optional `last_deploy`
- `POST /what-if` — Body: `{ "user_intent": {...}, "addition": "..." }` → cost/risk estimate (stub)
- `GET /fleet-health` — Orchestrator + agent health

---

## Webhooks

Set `WEBHOOK_URL` or `HYPERSHIFT_WEBHOOK_URL` to receive HTTP POSTs for:

- `run.created` — Payload: `run_id`, `workspace_id`, `user_intent`
- `run.started` — Payload: `run_id`, `workspace_id`
- `run.completed` — Payload: `run_id`, `status` (`completed`|`failed`), `deployment_url`, `duration_ms`, `error`, `failed_step` when failed
- `deploy.succeeded` — Payload: `run_id`, `deployment_url`

Each request includes header `X-HyperShift-Event: <event>` and body `{ "event", "payload", "ts" }`.
