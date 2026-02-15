import { Router } from "express";
import { userIntentSchema } from "@hypershift/contracts";
import * as agents from "../agents.js";

export const whatIfRouter = Router();

whatIfRouter.post("/", async (req, res) => {
  const parsed = userIntentSchema.safeParse(req.body?.user_intent ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid user_intent" });
    return;
  }
  const user_intent = parsed.data;
  const addition =
    typeof req.body?.addition === "string" ? req.body.addition : "";

  let estimatedMonthlyCost = 0;
  let currency = "USD";
  let riskLevel = "low";
  let message = `Estimate for: ${user_intent.description}${addition ? ` (${addition})` : ""}.`;

  try {
    const blueprint = await agents.callArchitect(user_intent);
    const finops = await agents.callFinOps(blueprint);
    if (finops && typeof finops === "object") {
      if (
        "estimatedMonthlyCost" in finops &&
        typeof (finops as { estimatedMonthlyCost?: number })
          .estimatedMonthlyCost === "number"
      ) {
        estimatedMonthlyCost = (finops as { estimatedMonthlyCost: number })
          .estimatedMonthlyCost;
      }
      if (
        "currency" in finops &&
        typeof (finops as { currency?: string }).currency === "string"
      ) {
        currency = (finops as { currency: string }).currency;
      }
      if (
        "riskLevel" in finops &&
        typeof (finops as { riskLevel?: string }).riskLevel === "string"
      ) {
        riskLevel = (finops as { riskLevel: string }).riskLevel;
      }
      message = `Based on blueprint and FinOps: ${user_intent.description}${addition ? ` (${addition})` : ""}. Estimated ${currency} ${estimatedMonthlyCost}/mo, risk: ${riskLevel}.`;
    } else {
      message = `Estimate for: ${user_intent.description}${addition ? ` (${addition})` : ""}. Agents returned no cost data; showing default.`;
    }
  } catch (err) {
    message = `Estimate for: ${user_intent.description}${addition ? ` (${addition})` : ""}. (Agent error: ${String(err)}; showing default.)`;
  }

  res.json({
    estimatedMonthlyCost,
    currency,
    riskLevel,
    message,
  });
});
