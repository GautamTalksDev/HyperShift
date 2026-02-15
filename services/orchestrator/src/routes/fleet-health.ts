import { Router } from "express";
import { env } from "../env.js";

export const fleetHealthRouter = Router();

async function checkAgent(name: string, url: string): Promise<"ok" | "down"> {
  if (!url) return "ok";
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
      method: "GET",
    });
    return res.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

fleetHealthRouter.get("/", async (_req, res) => {
  const [architect, builder, sentinel, sre, finops] = await Promise.all([
    checkAgent("architect", env.ARCHITECT_AGENT_URL),
    checkAgent("builder", env.BUILDER_AGENT_URL),
    checkAgent("sentinel", env.SENTINEL_AGENT_URL),
    checkAgent("sre", env.SRE_AGENT_URL),
    checkAgent("finops", env.FINOPS_AGENT_URL),
  ]);
  res.json({
    orchestrator: "ok",
    agents: { architect, builder, sentinel, sre, finops },
  });
});
