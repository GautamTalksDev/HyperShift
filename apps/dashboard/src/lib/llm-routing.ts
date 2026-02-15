/**
 * Multi-LLM routing: map each agent to a configurable provider.
 * Target: Architect/Builder/FinOps → Groq (free tier), Sentinel → Claude, SRE → Gemini.
 * Env-based provider per agent; implement at least one provider (e.g. Groq) so the pattern is in place.
 *
 * Env vars (optional):
 *   NEXT_PUBLIC_LLM_ARCHITECT_PROVIDER=groq
 *   NEXT_PUBLIC_LLM_BUILDER_PROVIDER=groq
 *   NEXT_PUBLIC_LLM_SENTINEL_PROVIDER=claude
 *   NEXT_PUBLIC_LLM_SRE_PROVIDER=gemini
 *   NEXT_PUBLIC_LLM_FINOPS_PROVIDER=groq
 *   GROQ_API_KEY=...
 *   GEMINI_API_KEY=... (for Gemini provider)
 *
 * The orchestrator (backend) typically calls LLMs; this module documents the intended mapping
 * and provides a client-side abstraction for any dashboard-initiated LLM calls (e.g. what-if).
 */

export type AgentId = "architect" | "builder" | "sentinel" | "sre" | "finops";
export type LlmProviderId =
  | "groq"
  | "claude"
  | "gemini"
  | "openai"
  | "archestra";

const DEFAULT_PROVIDERS: Record<AgentId, LlmProviderId> = {
  architect: "groq",
  builder: "groq",
  sentinel: "claude",
  sre: "gemini",
  finops: "groq",
};

const VALID_PROVIDERS: LlmProviderId[] = [
  "groq",
  "claude",
  "gemini",
  "openai",
  "archestra",
];

function getProviderForAgent(agent: AgentId): LlmProviderId {
  const key =
    `NEXT_PUBLIC_LLM_${agent.toUpperCase()}_PROVIDER` as keyof typeof process.env;
  const raw = typeof process !== "undefined" ? process.env[key] : undefined;
  if (raw && VALID_PROVIDERS.includes(raw as LlmProviderId)) {
    return raw as LlmProviderId;
  }
  return DEFAULT_PROVIDERS[agent];
}

/** Resolve which LLM provider to use for an agent (for display or API routing). */
export function getLlmProvider(agent: AgentId): LlmProviderId {
  return getProviderForAgent(agent);
}

/**
 * Call LLM via the configured provider for the given agent. Uses the dashboard API route
 * (/api/llm) so GROQ_API_KEY stays server-side. When GROQ_API_KEY is set and provider is groq,
 * returns the real Groq response; otherwise returns a short placeholder.
 */
export async function callLlmForAgent(
  agent: AgentId,
  messages: { role: string; content: string }[],
  opts?: { maxTokens?: number },
): Promise<{ content: string; provider: LlmProviderId }> {
  const provider = getProviderForAgent(agent);
  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent,
        messages,
        maxTokens: opts?.maxTokens ?? 1024,
      }),
    });
    const data = (await res.json()) as {
      content?: string;
      provider?: LlmProviderId;
    };
    return {
      content:
        typeof data.content === "string" ? data.content : "[No response]",
      provider: (data.provider as LlmProviderId) ?? provider,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return {
      content: `[LLM call failed: ${message}]`,
      provider,
    };
  }
}
