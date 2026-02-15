import express from "express";
import * as store from "../store.js";

const DEFAULT_WORKSPACE = "ws-default";

/** Resolve workspace ID from Authorization Bearer (API key) or X-Workspace-Id / X-Org-Id / query. */
export function getWorkspaceId(req: express.Request): string {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const raw = auth.slice(7).trim();
    const wid = store.resolveWorkspaceFromApiKey(raw);
    if (wid) return wid;
  }
  const h = req.headers["x-workspace-id"] ?? req.headers["x-org-id"];
  const q = req.query?.workspace_id ?? req.query?.org_id;
  if (typeof h === "string") return h;
  if (Array.isArray(h) && h[0]) return h[0];
  if (typeof q === "string") return q;
  return DEFAULT_WORKSPACE;
}

/** Optional user/actor from header (e.g. API key or session). */
export function getActor(req: express.Request): string | null {
  const h = req.headers["x-user-id"] ?? req.headers["x-actor"];
  if (typeof h === "string") return h;
  if (Array.isArray(h) && h[0]) return h[0];
  return null;
}
