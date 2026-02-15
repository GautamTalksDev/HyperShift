import express from "express";
import { env } from "./env";
import { architectRouter } from "./routes/architect";

const app = express();
app.use(express.json());
app.get("/health", (_req, res) =>
  res.json({ status: "ok", service: "architect-agent" }),
);
app.get("/", (_req, res) =>
  res.json({ service: "architect-agent", version: "1.0.0" }),
);
app.use("/", architectRouter);
app.listen(env.ARCHITECT_AGENT_PORT, env.HOST, () => {
  console.log(
    `Architect agent listening on http://${env.HOST}:${env.ARCHITECT_AGENT_PORT}`,
  );
});
