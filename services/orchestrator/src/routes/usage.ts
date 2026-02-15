import { Router } from "express";
import * as store from "../store.js";
import { getWorkspaceId } from "./context.js";

export const usageRouter = Router();

usageRouter.get("/", (req, res) => {
  const workspace_id = getWorkspaceId(req);
  const period = store.currentPeriodStart();
  const { current, limit } = store.checkRunLimit(workspace_id);
  const ws = store.getWorkspace(workspace_id);
  res.json({
    workspace_id,
    period,
    runs: current,
    limit,
    tier: ws?.tier ?? "free",
  });
});
