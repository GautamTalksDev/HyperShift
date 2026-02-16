# Run HyperShift locally

Follow these steps **in order** from the **repo root** (`HyperShift`).

## 1. Install dependencies

```bash
pnpm install
```

## 2. Dashboard env (signup/login)

Create or edit **`apps/dashboard/.env`** with at least:

- **`NEXT_PUBLIC_SUPABASE_URL`** — Supabase project URL (Dashboard → Settings → API).
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — Supabase anon key (same page).
- **`SUPABASE_SERVICE_ROLE_KEY`** — Supabase service_role key (required for signup; keep secret).
- **`NEXT_PUBLIC_API_URL`** — `http://localhost:4000`
- **`NEXT_PUBLIC_ORCHESTRATOR_URL`** — `http://localhost:4001`

## 3. Create Supabase tables (once)

In the **Supabase Dashboard** → SQL Editor, run the script **`docs/supabase-tables.sql`** once. This creates `profiles`, `workspaces`, and `workspace_members` (and RLS). No Prisma or local Postgres.

## 4. Start the app

From the **repo root**:

```bash
pnpm dev
```

This starts: API (:4000), Orchestrator (:4001), Architect/Builder/Sentinel/SRE/FinOps agents, and the Dashboard (:3000). Wait until you see the dashboard ready.

- **Dashboard:** http://localhost:3000  
- **API:** http://localhost:4000  
- **Orchestrator:** http://localhost:4001  

## 5. Sign up / log in

Open http://localhost:3000/signup, create an account, then sign in. If signup fails, ensure `SUPABASE_SERVICE_ROLE_KEY` is set and you ran **`docs/supabase-tables.sql`** in Supabase.

## Troubleshooting

- **“Database tables missing”** — Ensure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are in `apps/dashboard/.env`. Run **`docs/supabase-tables.sql`** in the Supabase SQL Editor once.
- **Connection refused to :4001** — Start from the **repo root** with `pnpm dev`. Do not run only the dashboard (`cd apps/dashboard && pnpm dev`) or the orchestrator won’t be running.
- **Port already in use** — Stop other Node processes or change ports in the scripts / `.env`.
