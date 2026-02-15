import { Router } from "express";
import { isHealthSabotaged } from "../state";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  if (isHealthSabotaged()) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Sabotaged",
    });
    return;
  }
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
