import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { initStore } from "./store.js";
import { runsRouter } from "./routes/runs.js";
import { whatIfRouter } from "./routes/what-if.js";
import { fleetHealthRouter } from "./routes/fleet-health.js";
import { usageRouter } from "./routes/usage.js";
import { observabilityRouter } from "./routes/observability.js";
import { workspacesRouter } from "./routes/workspaces.js";

initStore();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) =>
  res.json({ status: "ok", service: "orchestrator" }),
);
app.get("/", (_req, res) =>
  res.json({ service: "orchestrator", version: "1.0.0" }),
);
app.get("/status", (_req, res) =>
  res.json({
    status: "operational",
    service: "orchestrator",
    last_deploy: process.env.LAST_DEPLOY_TIME ?? null,
  }),
);

app.use("/runs", runsRouter);
app.use("/workspaces", workspacesRouter);
app.use("/what-if", whatIfRouter);
app.use("/fleet-health", fleetHealthRouter);
app.use("/usage", usageRouter);
app.use("/observability", observabilityRouter);

app.listen(env.ORCHESTRATOR_PORT, env.HOST, () => {
  console.log(
    `Orchestrator listening on http://${env.HOST}:${env.ORCHESTRATOR_PORT}`,
  );
});
