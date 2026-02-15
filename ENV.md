# Environment variables

All supported env vars are listed in **`.env.example`** at the repo root. Copy it to `.env` and fill in only what you need.

## Orchestrator persistent store

- **`ORCHESTRATOR_DATABASE_PATH`** (or **`DATABASE_PATH`**): Path to a SQLite file (e.g. `./data/hypershift.sqlite`). When set, runs, workspaces, usage, and audit log are persisted. When unset, the orchestrator uses an in-memory store (data is lost on restart).

## Required for local dev

No API keys are required to run the pipeline and dashboard locally. You only need:

- `NEXT_PUBLIC_ORCHESTRATOR_URL` (e.g. `http://localhost:4001`)
- `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:4000`)
- Port and host settings for the API and each service (defaults in `.env.example` are fine)

Run `pnpm dev` from the **repo root** so the orchestrator and agents start. The UI and globe/network views work without any external keys.

## Optional: real integrations

| Area              | Env vars                                                                        | Purpose                                                                                          |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **LLM**           | `GROQ_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_LLM_*_PROVIDER`                  | Real LLM responses in the dashboard; set `GROQ_API_KEY` for Groq or `GEMINI_API_KEY` for Gemini. |
| **Deploy**        | `VERCEL_TOKEN`, `RAILWAY_TOKEN`, `SUPABASE_SERVICE_KEY`, `CLOUDFLARE_API_TOKEN` | Builder agent: deploy previews, Supabase project creation.                                       |
| **Architect**     | `GITHUB_TOKEN`, `NOTION_API_KEY`, `NOTION_DATABASE_ID`                          | Repo context, Notion specs.                                                                      |
| **Sentinel**      | `SNYK_TOKEN`                                                                    | Vulnerability scanning.                                                                          |
| **SRE**           | `PROMETHEUS_URL`, `UPTIMEROBOT_API_KEY`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`      | Metrics, uptime, error tracking.                                                                 |
| **FinOps**        | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`                      | Cost/usage data.                                                                                 |
| **Observability** | `NEXT_PUBLIC_OBSERVABILITY_ENDPOINT`                                            | POST run outcomes to your backend.                                                               |

See `docs/AGENT_API_INTEGRATIONS.md` for per-agent integration details.

## Billing (Stripe)

- **Dashboard:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO` — for checkout, webhook, and Pro price. In Stripe Dashboard create a Product/Price for Pro and a webhook endpoint pointing to `https://your-dashboard/api/stripe/webhook` (events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).
- **Orchestrator:** `WORKSPACE_TIER_UPDATE_SECRET` — when set, the dashboard webhook sends this value as `X-Webhook-Secret` when calling `PATCH /workspaces/:id/tier` to upgrade/downgrade a workspace. Use the same secret in both dashboard and orchestrator env.

## Demo-only / no production secrets

- **Fake Stripe key**: The Builder agent can generate a demo app that includes a **fake** `STRIPE_SECRET_KEY` in `config.secret.ts` for the **sabotage demo** only. Sentinel is designed to detect it and block deploy. That value is not a real secret and must not be used in production. Real Stripe keys should come from env (e.g. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) in your own app.
- Never commit real API keys or `.env` to the repo; use `.env.example` as a template and keep `.env` local or in a secure secrets store.
