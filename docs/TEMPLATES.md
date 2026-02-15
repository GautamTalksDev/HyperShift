# Templates and presets

## What they are

**Templates** (presets) are pre-defined intents that map to architect/builder defaults—e.g. "Next.js + Auth", "API only". The dashboard uses them for one-click flows (Happy path, Sabotage deploy, etc.); see `apps/dashboard/src/utils/agents.ts` → `projectTemplates`.

## Adding a template

1. **Dashboard:** Add an entry to `projectTemplates` in `utils/agents.ts` with `id`, `label`, `description`, and `userIntent: { description, target?, constraints? }`.
2. **Optional backend:** If the orchestrator or architect later supports a `template_id` (e.g. "nextjs-auth"), you can pass it in `POST /runs` body and have the architect return a blueprint tuned for that template. For now, the architect derives the blueprint from `user_intent` only.

## Recommendations

A simple **rule-based recommendation** is shown in the dashboard (e.g. "Teams with similar intent often add: Sentry"). It uses static or keyword-based rules (e.g. if intent contains "production", suggest "Sentry, error tracking"). To add more:

- **Static:** Add a list of `{ pattern: string | RegExp, suggestion: string }` in the dashboard and show the first matching suggestion.
- **Anonymized outcomes (future):** Store anonymized run outcomes (success/fail per intent type or template_id) in the orchestrator; then an "insights" view can show "Teams using template X often add Y" from aggregated data. No PII—only template id and success rate or common next-steps.
