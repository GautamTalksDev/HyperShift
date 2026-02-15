import { z } from "zod";

/** User intent for a run (description, target, constraints). */
export const userIntentSchema = z.object({
  description: z.string(),
  target: z.string().optional(),
  constraints: z.string().optional(),
});
export type UserIntent = z.infer<typeof userIntentSchema>;

/** Minimal blueprint manifest (apps, infra). */
export const blueprintManifestSchema = z.object({
  version: z.string().optional(),
  appName: z.string().optional(),
  appPlan: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        type: z.string().optional(),
        config: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
  infra: z
    .array(
      z.object({
        id: z.string().optional(),
        type: z.string().optional(),
        config: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
});
export type BlueprintManifest = z.infer<typeof blueprintManifestSchema>;

/** Build plan (steps, output dir). */
export const buildPlanSchema = z.object({
  buildSteps: z.array(z.string()).optional(),
  outputDir: z.string().optional(),
});
export type BuildPlan = z.infer<typeof buildPlanSchema>;

/** Security report (veto, findings). */
export const securityReportSchema = z.object({
  veto: z.boolean().optional(),
  findings: z
    .array(
      z.object({
        title: z.string().optional(),
        severity: z.string().optional(),
        path: z.string().optional(),
      }),
    )
    .optional(),
});
export type SecurityReport = z.infer<typeof securityReportSchema>;

/** FinOps report (cost, currency). */
export const finOpsReportSchema = z.object({
  estimatedMonthlyCost: z.number().optional(),
  currency: z.string().optional(),
});
export type FinOpsReport = z.infer<typeof finOpsReportSchema>;

/** SRE status (rollbackAction, incidents). */
export const sreStatusSchema = z.object({
  rollbackAction: z.string().optional(),
  incidents: z.array(z.object({ title: z.string().optional() })).optional(),
});
export type SREStatus = z.infer<typeof sreStatusSchema>;

/** Dry run result (for builder). */
export const dryRunResultSchema = z.object({
  success: z.boolean().optional(),
  steps: z.array(z.string()).optional(),
});

export type RepoNode = {
  path: string;
  type: "file" | "dir";
  children?: RepoNode[];
};
export type InfraResource = unknown;
export type AppService = unknown;
export type SecurityFinding = unknown;
export type SreIncident = { title?: string };
