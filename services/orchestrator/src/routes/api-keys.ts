import express, { Router } from "express";
import { env } from "../env.js";
import * as store from "../store.js";

export const apiKeysRouter = Router({ mergeParams: true });

function checkSecret(req: express.Request): boolean {
  if (!env.WORKSPACE_TIER_UPDATE_SECRET) return true;
  const secret = req.headers["x-webhook-secret"];
  return (
    typeof secret === "string" && secret === env.WORKSPACE_TIER_UPDATE_SECRET
  );
}

/** GET /workspaces/:workspaceId/api-keys — List API keys (requires X-Webhook-Secret when set). */
apiKeysRouter.get("/", (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: "Missing or invalid X-Webhook-Secret" });
    return;
  }
  const workspaceId = (req.params as { workspaceId?: string }).workspaceId!;
  const ws = store.getWorkspace(workspaceId);
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  const keys = store.listApiKeys(workspaceId);
  res.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      key_prefix: k.key_prefix,
      created_at: k.created_at,
    })),
  });
});

/** POST /workspaces/:workspaceId/api-keys — Create API key (requires X-Webhook-Secret when set). Body: { name?: string }. Returns { id, name, key, key_prefix, created_at }. Show key only once. */
apiKeysRouter.post("/", (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: "Missing or invalid X-Webhook-Secret" });
    return;
  }
  const workspaceId = (req.params as { workspaceId?: string }).workspaceId!;
  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : "API key";
  const ws = store.getWorkspace(workspaceId);
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  try {
    const created = store.createApiKey(workspaceId, name);
    res.status(201).json({
      id: created.id,
      name: created.name,
      key: created.key,
      key_prefix: created.key_prefix,
      created_at: created.created_at,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to create API key", message: String(err) });
  }
});

/** DELETE /workspaces/:workspaceId/api-keys/:keyId — Revoke API key (requires X-Webhook-Secret when set). */
apiKeysRouter.delete("/:keyId", (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: "Missing or invalid X-Webhook-Secret" });
    return;
  }
  const workspaceId = (req.params as { workspaceId?: string }).workspaceId!;
  const keyId = (req.params as { keyId?: string }).keyId!;
  const ok = store.revokeApiKey(workspaceId, keyId);
  if (!ok) {
    res.status(404).json({ error: "API key not found" });
    return;
  }
  res.json({ message: "Revoked" });
});
