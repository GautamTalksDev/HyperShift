import express from "express";
import { env } from "./env";
import { healthRouter } from "./routes/health";
import { toggleHealthSabotage } from "./state";

const app = express();
app.use(express.json());

app.use("/health", healthRouter);
app.post("/sabotage", (_req, res) => {
  const sabotaged = toggleHealthSabotage();
  res.json({
    sabotaged,
    message: sabotaged ? "Health will return 500" : "Health will return 200",
  });
});
app.get("/", (_req, res) =>
  res.json({ name: "hypershift-api", version: "1.0.0" }),
);

app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
});
