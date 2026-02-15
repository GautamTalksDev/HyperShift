import { Router } from "express";
import { userIntentSchema } from "@hypershift/contracts";
import { intentToBlueprint } from "../parseIntent";

export const architectRouter = Router();

architectRouter.post("/architect", (req, res) => {
  const parsed = userIntentSchema.safeParse(req.body?.user_intent ?? req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid user_intent",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }
  const blueprint_manifest = intentToBlueprint(parsed.data);
  res.json({ blueprint_manifest });
});

architectRouter.post("/run", (req, res) => {
  const requirements =
    typeof req.body?.requirements === "string"
      ? req.body.requirements
      : typeof req.body?.user_intent?.description === "string"
        ? [
            req.body.user_intent.description,
            req.body.user_intent.target,
            req.body.user_intent.constraints,
          ]
            .filter(Boolean)
            .join(" ")
        : "";
  if (!requirements.trim()) {
    res.status(400).json({ error: "Missing requirements or user_intent" });
    return;
  }
  const blueprint_manifest = intentToBlueprint(requirements);
  res.json(blueprint_manifest);
});
