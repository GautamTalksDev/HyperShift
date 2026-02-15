import { Router } from "express";
import { env } from "../env.js";
import * as store from "../store.js";
import { apiKeysRouter } from "./api-keys.js";

export const workspacesRouter = Router();
workspacesRouter.use("/:workspaceId/api-keys", apiKeysRouter);

/** POST /workspaces — Create a workspace (e.g. when user signs up). Body: { name?: string }. Returns { id, name, tier, created_at }. */
workspacesRouter.post("/", (req, res) => {
  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : "My Workspace";
  try {
    const ws = store.createWorkspace(name);
    res.status(201).json(ws);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to create workspace", message: String(err) });
  }
});

/** GET /workspaces/:id — Get workspace by id (tier, name). */
workspacesRouter.get("/:id", (req, res) => {
  const ws = store.getWorkspace(req.params.id!);
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  res.json(ws);
});

/** PATCH /workspaces/:id/tier — Set workspace tier (e.g. from Stripe webhook). Body: { tier: "free" | "pro" }. Requires X-Webhook-Secret if WORKSPACE_TIER_UPDATE_SECRET is set. */
workspacesRouter.patch("/:id/tier", (req, res) => {
  if (env.WORKSPACE_TIER_UPDATE_SECRET) {
    const secret = req.headers["x-webhook-secret"];
    const match =
      typeof secret === "string" && secret === env.WORKSPACE_TIER_UPDATE_SECRET;
    if (!match) {
      res.status(401).json({ error: "Missing or invalid X-Webhook-Secret" });
      return;
    }
  }
  const tier = req.body?.tier;
  if (tier !== "free" && tier !== "pro") {
    res.status(400).json({ error: "Body must include tier: 'free' or 'pro'" });
    return;
  }
  const id = req.params.id!;
  const ws = store.getWorkspace(id);
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  store.setWorkspaceTier(id, tier);
  res.json(store.getWorkspace(id));
});
