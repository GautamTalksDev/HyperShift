# HyperShift Free vs Pro tier

| Feature        | Free                   | Pro      |
| -------------- | ---------------------- | -------- |
| Runs per month | 10                     | 1000     |
| Approvals      | Optional (UI checkbox) | Optional |
| Audit log      | Yes (immutable)        | Yes      |
| Webhooks       | Yes (single URL)       | Yes      |
| API access     | Yes                    | Yes      |

**Enforcement:** Run limit is enforced at create-run time. If the workspace exceeds the limit, `POST /runs` returns `402` with `current`, `limit`, and `period`.

**Upgrade path:** Set the workspace tier to `pro` in the data store (orchestrator in-memory store or future DB). The limit is read from `store.getRunLimit(workspace_id)` which uses `workspace.tier`. To add a new workspace as Pro, implement an admin API or config that sets `workspaces.set(id, { ...workspace, tier: "pro" })`. With SQLite/Postgres, add a `tier` column and use it in `getRunLimit`.
