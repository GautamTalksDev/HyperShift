# HyperShift deployment guide

This guide gets the full platform live: **dashboard on Vercel** and **backend on Render** (one URL for API + Orchestrator + all agents). After both are deployed, you wire the dashboard to the backend with two environment variables.

---

## 0. Before you push (GitHub / Vercel / Render)

- **Secrets:** Ensure no `.env` or `.env.local` files are committed (they are in `.gitignore`). Run `git status` and `git check-ignore -v apps/dashboard/.env` to confirm. If you ever committed a file with real API keys, rotate those keys (Groq, Gemini, Stripe, etc.) and remove the file from history (e.g. `git filter-branch` or BFG).
- **GitHub:** Repo is ready to push. `.gitignore` covers dependencies, build outputs, env files, and IDE/OS cruft. No lockfile is ignored (commit `pnpm-lock.yaml`).
- **Vercel:** Root directory `apps/dashboard`, `vercel.json` sets install/build. Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_ORCHESTRATOR_URL` to your backend URL. For sign-up/login in production, also set `DATABASE_URL` (e.g. Vercel Postgres or external), `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` (your Vercel app URL, e.g. `https://your-app.vercel.app`).
- **Render:** Use `render.yaml` or the steps in §1. Build: `pnpm install && pnpm run build`. Start: `pnpm run start:backend`. Health check uses `/health` (orchestrator). Optional: set `ORCHESTRATOR_DATABASE_PATH` on Render for persistent runs (or leave unset for in-memory).

---

## 1. Deploy the backend first (Render)

The backend runs as a **single Render web service**: API, Orchestrator, and all agents (architect, builder, sentinel, SRE, finops) run in one process group behind a small reverse proxy. The proxy exposes one URL and forwards:

- **`/api/*`** → API (e.g. `/api/health`)
- **`/*`** → Orchestrator (e.g. `/runs`, `/health`)

Agents are only called by the Orchestrator on localhost and are not exposed publicly.

### 1.1 Create the Render service

1. Go to [Render](https://render.com) and sign in (free account is fine).
2. **New → Web Service**.
3. Connect your Git provider and select the **HyperShift** repo.
4. Configure the service:
   - **Name:** `hypershift-backend` (or any name).
   - **Region:** any.
   - **Branch:** your default branch (e.g. `main`).
   - **Root Directory:** leave empty (repo root). Build and start run from the root.
   - **Runtime:** Node.
   - **Build Command:** `pnpm install && pnpm run build`
   - **Start Command:** `pnpm run start:backend`
   - **Instance type:** Free (or Starter if you prefer).

5. (Optional) Add environment variables for LLM keys, Vercel token, etc. See `.env.example` and `ENV.md` at the repo root. The app runs with no env vars; add them only if you need real LLM calls or deploys.

6. Click **Create Web Service**. Render will install, build, and start the backend.

### 1.2 Get the backend URL

After the first deploy succeeds, open the service in Render. The **public URL** is shown at the top, e.g.:

- `https://hypershift-backend.onrender.com`

Use this as the **base URL** for the dashboard env vars:

- **API base:** `https://hypershift-backend.onrender.com/api`
- **Orchestrator base:** `https://hypershift-backend.onrender.com` (no path; orchestrator is at root)

So you will set:

- `NEXT_PUBLIC_API_URL` = `https://<your-service>.onrender.com/api`
- `NEXT_PUBLIC_ORCHESTRATOR_URL` = `https://<your-service>.onrender.com`

---

## 2. Deploy the dashboard (Vercel)

The dashboard is the Next.js app in **`apps/dashboard`**. It depends on workspace packages (`@hypershift/contracts`, `@hypershift/shared`), so the build must run from the monorepo (or with an install that includes the workspace).

### 2.1 Vercel project setup

1. Go to [Vercel](https://vercel.com) and sign in.
2. **Add New → Project** and import the **HyperShift** repo.
3. Configure the project:
   - **Root Directory:** click **Edit**, set to **`apps/dashboard`**.
   - The repo’s `apps/dashboard/vercel.json` sets:
     - **Install Command:** `cd .. && pnpm install` (installs from repo root so workspace deps are available).
     - **Build Command:** `cd .. && pnpm exec turbo run build --filter=@hypershift/dashboard` (builds `@hypershift/shared` and `@hypershift/contracts` first, then the dashboard).
   - **Framework Preset:** Next.js (auto-detected).

4. Before deploying, set environment variables (see 2.2).

5. Click **Deploy**. Vercel will install from the parent directory and build the dashboard.

### 2.2 Required environment variables (Vercel)

In the Vercel project → **Settings → Environment Variables**, add:

| Variable                       | Value                                     | Notes                                          |
| ------------------------------ | ----------------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_API_URL`          | `https://<your-backend>.onrender.com/api` | Replace with your Render backend URL + `/api`. |
| `NEXT_PUBLIC_ORCHESTRATOR_URL` | `https://<your-backend>.onrender.com`     | Same backend URL, no path.                     |

Use the **exact** backend URL from step 1.2 (with `https://`). No trailing slash for the orchestrator URL.

Optional (see `ENV.md` at repo root): LLM keys, Archestra, observability, etc. Add them in Vercel if you need them for the dashboard (e.g. Groq/Gemini for in-app LLM features).

### 2.3 Redeploy after setting env vars

After saving the variables, trigger a new deployment (**Deployments → … → Redeploy**) so the build gets the new `NEXT_PUBLIC_*` values.

---

## 3. Wiring summary

- **Backend (Render):** One URL, e.g. `https://hypershift-backend.onrender.com`.
  - Dashboard calls **API** at `NEXT_PUBLIC_API_URL` = `https://hypershift-backend.onrender.com/api`.
  - Dashboard calls **Orchestrator** at `NEXT_PUBLIC_ORCHESTRATOR_URL` = `https://hypershift-backend.onrender.com`.

- The app already uses these env vars (see `apps/dashboard/src/env.ts` and `src/lib/orchestrator.ts`). Local dev defaults are `http://localhost:4000` and `http://localhost:4001`; in production you override them in Vercel so the dashboard talks to the real backend.

---

## 4. Quick path: zero to live

1. **Backend:** Render → New Web Service → repo **HyperShift**, Root Directory **repo root**, Build `pnpm install && pnpm run build`, Start `pnpm run start:backend` → Deploy → copy the service URL.
2. **Dashboard:** Vercel → Import **HyperShift**, Root Directory **`apps/dashboard`**, add env vars `NEXT_PUBLIC_API_URL` = `https://<url>/api`, `NEXT_PUBLIC_ORCHESTRATOR_URL` = `https://<url>` → Deploy.
3. Open the Vercel dashboard URL; it will use the Render backend.

---

## Alternative: Railway or Fly.io

- **Railway:** New Project → Deploy from GitHub → choose HyperShift, use repo root. Set **Build Command** to `pnpm install && pnpm run build` and **Start Command** to `pnpm run start:backend`. Add the same env vars on the Vercel dashboard (Railway gives you one public URL).
- **Fly.io:** Use a `Dockerfile` or `fly.toml` that runs `pnpm install && pnpm run build` and `pnpm run start:backend` at repo root, and exposes `PORT`. Then set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_ORCHESTRATOR_URL` on Vercel to the Fly app URL (with `/api` for the API).

The backend is designed to run as one process group behind one port (see `scripts/proxy.mjs` and `scripts/start-backend.mjs`).

---

## 5. CI: one-command run (GitHub Actions example)

Use the HyperShift CLI or the public API from CI to create and start a run.

### Option A: CLI

Build the CLI from the repo root, then run it with your orchestrator URL:

```yaml
# .github/workflows/hypershift-deploy.yml
name: HyperShift deploy
on:
  workflow_dispatch:
    inputs:
      description:
        description: "Run description"
        default: "Deploy from CI"
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm exec turbo run build --filter=hypershift-cli
      - run: pnpm exec hypershift run "${{ inputs.description }}"
        env:
          HYPERSHIFT_ORCHESTRATOR_URL: ${{ secrets.HYPERSHIFT_ORCHESTRATOR_URL }}
          HYPERSHIFT_WORKSPACE_ID: ${{ secrets.HYPERSHIFT_WORKSPACE_ID }}
          HYPERSHIFT_USER_ID: "github-actions"
```

### Option B: API (curl)

```yaml
- name: Create and start run
  run: |
    RES=$(curl -s -X POST "${{ secrets.HYPERSHIFT_ORCHESTRATOR_URL }}/runs" \
      -H "Content-Type: application/json" \
      -H "X-User-Id: github-actions" \
      -d '{"user_intent":{"description":"Deploy from CI"}}')
    RUN_ID=$(echo "$RES" | jq -r '.run_id')
    curl -s -X POST "${{ secrets.HYPERSHIFT_ORCHESTRATOR_URL }}/runs/$RUN_ID/start"
    echo "Run started: $RUN_ID"
```

Store `HYPERSHIFT_ORCHESTRATOR_URL` (and optionally workspace/user) as repo secrets.
