import type { UserIntent } from "@hypershift/contracts";
import { blueprintManifestSchema } from "@hypershift/contracts";
import { normalizeBlueprint } from "./normalizeBlueprint";

export function intentToText(input: string | UserIntent): string {
  if (typeof input === "string") return input.trim();
  const parts = [input.description, input.target, input.constraints].filter(
    Boolean,
  );
  return parts.join(" ").trim();
}

const LOWER = (s: string) => s.toLowerCase();

export function parseIntentKeywords(intentText: string): {
  hasAuth: boolean;
  hasDatabase: boolean;
  hasStripe: boolean;
  hasBlog: boolean;
  hasAdminDashboard: boolean;
  hasRealtime: boolean;
  sabotageDemo: boolean;
  isLandingOnly: boolean;
  isApiOnly: boolean;
  framework: string;
  deployTarget: string;
} {
  const text = [intentText].flat().join(" ").toLowerCase();
  const has = (keywords: string[]) =>
    keywords.some((k) => text.includes(LOWER(k)));
  const hasAuth = has([
    "auth",
    "authentication",
    "login",
    "sign-in",
    "signin",
    "user account",
  ]);
  const hasDatabase = has([
    "database",
    "db",
    "postgres",
    "supabase",
    "sql",
    "data store",
    "storage",
  ]);
  const hasStripe = has([
    "stripe",
    "payment",
    "payments",
    "billing",
    "subscription",
  ]);
  const hasBlog = has(["blog", "blogging", "posts", "cms"]);
  const hasAdminDashboard = has([
    "admin",
    "dashboard",
    "admin dashboard",
    "saas",
    "backoffice",
  ]);
  const hasRealtime = has([
    "realtime",
    "real-time",
    "real time",
    "chat",
    "live",
    "websocket",
  ]);
  const sabotageDemo = has([
    "sabotage demo",
    "sabotage deploy",
    "demo blocked",
    "include hardcoded key",
  ]);
  const isLandingOnly =
    has(["landing page", "landing only", "single page", "one page"]) &&
    !hasDatabase &&
    !hasAuth;
  const isApiOnly =
    has([
      "api only",
      "api + database",
      "backend only",
      "rest api",
      "api and database",
    ]) ||
    (has(["api", "database"]) &&
      !has(["frontend", "react", "next", "landing", "blog", "dashboard"]));
  const framework = isApiOnly
    ? "api"
    : has(["react"]) && !has(["next", "next.js", "nextjs"])
      ? "react"
      : "nextjs";
  const deployTarget = "vercel";
  return {
    hasAuth,
    hasDatabase,
    hasStripe,
    hasBlog,
    hasAdminDashboard,
    hasRealtime,
    sabotageDemo,
    isLandingOnly,
    isApiOnly,
    framework,
    deployTarget,
  };
}

export function intentToBlueprint(
  intentInput: string | UserIntent,
): ReturnType<typeof normalizeBlueprint> {
  const text = intentToText(intentInput);
  const p = parseIntentKeywords(text);
  const infra: {
    id: string;
    type: string;
    config?: Record<string, unknown>;
  }[] = [];
  if (p.hasDatabase || p.hasAuth || p.hasRealtime) {
    infra.push({
      id: "supabase-db",
      type: "supabase-postgres",
      config: {
        provider: "supabase",
        rls: true,
        schema_summary: p.hasAuth ? "auth, public" : "public",
      },
    });
  }
  if (p.hasAuth) {
    infra.push({
      id: "supabase-auth",
      type: "supabase-auth",
      config: { provider: "supabase" },
    });
  }
  if (p.hasRealtime) {
    infra.push({
      id: "supabase-realtime",
      type: "supabase-realtime",
      config: { provider: "supabase" },
    });
  }
  const appPlan: {
    id: string;
    name: string;
    type: string;
    config?: Record<string, unknown>;
  }[] = [];
  if (p.isApiOnly) {
    appPlan.push({
      id: "api",
      name: "api",
      type: "api",
      config: {
        deploy: p.deployTarget,
        runtime: "node",
        database: p.hasDatabase ? "supabase" : undefined,
      },
    });
    if (p.sabotageDemo) {
      appPlan.push({
        id: "sabotage-demo",
        name: "sabotage-demo",
        type: "demo",
        config: { injectSecret: true },
      });
    }
    return normalizeBlueprint(
      blueprintManifestSchema.parse({ version: "1.0", infra, appPlan }),
    );
  }
  const webFeatures: string[] = [];
  if (p.hasBlog) webFeatures.push("blog");
  if (p.hasAuth) webFeatures.push("auth");
  if (p.hasStripe) webFeatures.push("stripe");
  if (p.hasAdminDashboard) webFeatures.push("admin-dashboard");
  if (p.hasRealtime) webFeatures.push("realtime");
  appPlan.push({
    id: "web",
    name: "web",
    type: p.framework,
    config: {
      deploy: p.deployTarget,
      features: webFeatures.length ? webFeatures : undefined,
      minimal: p.isLandingOnly,
      ...(p.sabotageDemo ? { sabotageDemo: true } : {}),
    },
  });
  if (p.sabotageDemo) {
    appPlan.push({
      id: "sabotage-demo",
      name: "sabotage-demo",
      type: "demo",
      config: { injectSecret: true },
    });
  }
  if (p.hasAdminDashboard && !p.isLandingOnly) {
    appPlan.push({
      id: "admin",
      name: "admin",
      type: "nextjs",
      config: { deploy: p.deployTarget, features: ["auth", "dashboard"] },
    });
  }
  return normalizeBlueprint(
    blueprintManifestSchema.parse({ version: "1.0", infra, appPlan }),
  );
}
