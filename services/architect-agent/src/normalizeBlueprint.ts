import type { BlueprintManifest } from "@hypershift/contracts";
import { blueprintManifestSchema } from "@hypershift/contracts";

const ENV_ALIASES: Record<string, string> = {
  db_url: "DATABASE_URL",
  database_url: "DATABASE_URL",
  postgres_url: "DATABASE_URL",
  supabase_url: "SUPABASE_URL",
  supabase_anon_key: "SUPABASE_ANON_KEY",
  supabase_service_key: "SUPABASE_SERVICE_ROLE_KEY",
  anon_key: "SUPABASE_ANON_KEY",
  service_role_key: "SUPABASE_SERVICE_ROLE_KEY",
  redis_url: "REDIS_URL",
  stripe_secret_key: "STRIPE_SECRET_KEY",
  stripe_webhook_secret: "STRIPE_WEBHOOK_SECRET",
  api_url: "NEXT_PUBLIC_API_URL",
  public_api_url: "NEXT_PUBLIC_API_URL",
};

function toCanonicalEnvName(name: string): string {
  const normalized = name.trim().toUpperCase().replace(/-/g, "_");
  return ENV_ALIASES[normalized.toLowerCase()] ?? normalized;
}

function standardizeEnvVars(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...config };
  const envVars = (config.env_vars ?? config.env ?? config.envVars) as
    | Record<string, unknown>
    | undefined;
  if (envVars && typeof envVars === "object" && !Array.isArray(envVars)) {
    const standardized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(envVars)) {
      standardized[toCanonicalEnvName(key)] = value;
    }
    out.env_vars = standardized;
  }
  if (Array.isArray(config.requiredEnv)) {
    out.requiredEnv = [
      ...new Set(config.requiredEnv.map((n: string) => toCanonicalEnvName(n))),
    ];
  }
  return out;
}

const SECURITY_DEFAULTS = {
  cors: "strict",
  rateLimiting: true,
  secretsViaEnv: true,
};

function applySecurityDefaults(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const existing = (config.security as Record<string, unknown>) ?? {};
  return { ...config, security: { ...SECURITY_DEFAULTS, ...existing } };
}

function normalizeInfraResource(r: {
  type?: string;
  config?: Record<string, unknown>;
  [k: string]: unknown;
}) {
  const config = { ...(r.config ?? {}) };
  if (
    r.type?.toLowerCase().includes("supabase") &&
    r.type?.toLowerCase().includes("postgres")
  ) {
    (config as Record<string, unknown>).rls = true;
  }
  return {
    ...r,
    config: Object.keys(config).length
      ? standardizeEnvVars(config as Record<string, unknown>)
      : undefined,
  };
}

function normalizeAppService(s: {
  config?: Record<string, unknown>;
  [k: string]: unknown;
}) {
  const config = { ...(s.config ?? {}) };
  const withSecurity = applySecurityDefaults(standardizeEnvVars(config));
  return {
    ...s,
    config: Object.keys(withSecurity).length ? withSecurity : undefined,
  };
}

export function normalizeBlueprint(
  blueprint: BlueprintManifest,
): BlueprintManifest {
  const infra = (blueprint.infra ?? []).map(normalizeInfraResource);
  const appPlan = (blueprint.appPlan ?? []).map(normalizeAppService);
  return blueprintManifestSchema.parse({
    version: blueprint.version ?? "1.0",
    infra,
    appPlan,
  });
}
