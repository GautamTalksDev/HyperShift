import { NextResponse } from "next/server";
import type { AgentId } from "@/lib/llm-routing";
import { getLlmProvider } from "@/lib/llm-routing";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

/** Archestra OpenAI-compatible proxy: URL must include LLM Proxy ID (see archestra.ai/docs). */
function getArchestraChatUrl(): string | null {
  const base = process.env.ARCHESTRA_API_URL?.trim();
  const proxyId = process.env.ARCHESTRA_LLM_PROXY_ID?.trim();
  if (!base || !proxyId) return null;
  return `${base.replace(/\/$/, "")}/v1/openai/${encodeURIComponent(proxyId)}/chat/completions`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const agent = body?.agent as AgentId | undefined;
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const maxTokens =
      typeof body?.maxTokens === "number" ? body.maxTokens : 1024;
    const useArchestra = body?.useArchestra === true;

    const validAgents: AgentId[] = [
      "architect",
      "builder",
      "sentinel",
      "sre",
      "finops",
    ];
    if (!agent || !validAgents.includes(agent)) {
      return NextResponse.json(
        { error: "Invalid agent", content: "", provider: "groq" },
        { status: 400 },
      );
    }

    const normalizedMessages = messages.map(
      (m: { role?: string; content?: string }) => ({
        role: m?.role ?? "user",
        content: typeof m?.content === "string" ? m.content : "",
      }),
    );

    const archestraUrl = getArchestraChatUrl();
    const archestraKey = process.env.ARCHESTRA_API_KEY?.trim();

    if (
      (useArchestra || getLlmProvider(agent) === "archestra") &&
      archestraUrl &&
      archestraKey
    ) {
      const res = await fetch(archestraUrl, {
        method: "POST",
        headers: {
          Authorization: archestraKey.startsWith("Bearer ")
            ? archestraKey
            : `Bearer ${archestraKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: normalizedMessages,
          max_tokens: Math.min(Math.max(maxTokens, 1), 4096),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          {
            content: `[Archestra API error ${res.status}: ${errText.slice(0, 200)}]`,
            provider: "archestra",
          },
          { status: 200 },
        );
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content =
        data?.choices?.[0]?.message?.content ?? "[No content from Archestra]";
      return NextResponse.json({ content, provider: "archestra" });
    }

    const provider = getLlmProvider(agent);
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (provider === "groq" && apiKey) {
      const res = await fetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: normalizedMessages,
          max_tokens: Math.min(Math.max(maxTokens, 1), 4096),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          {
            content: `[Groq API error ${res.status}: ${errText.slice(0, 200)}]`,
            provider: "groq",
          },
          { status: 200 },
        );
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content =
        data?.choices?.[0]?.message?.content ?? "[No content from Groq]";
      return NextResponse.json({ content, provider: "groq" });
    }

    const placeholder =
      provider === "groq"
        ? "[LLM not configured; set GROQ_API_KEY in .env and restart.]"
        : provider === "archestra"
          ? "[Archestra not configured; set ARCHESTRA_API_URL, ARCHESTRA_API_KEY, and ARCHESTRA_LLM_PROXY_ID in .env.]"
          : `[LLM not implemented for provider: ${provider}. Set GROQ_API_KEY or use archestra provider.]`;
    return NextResponse.json({ content: placeholder, provider });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { content: `[LLM request failed: ${message}]`, provider: "groq" },
      { status: 200 },
    );
  }
}
