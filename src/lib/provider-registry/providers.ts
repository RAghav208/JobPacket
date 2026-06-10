import type {
  ChatMessage,
  ChatOptions,
  ChatProvider,
  ProviderDescriptor,
} from "./types";

/**
 * Concrete chat backends.
 *
 * Request construction is split into pure `build*Request` helpers (unit-tested
 * without network) from the `complete()` calls that actually hit the wire.
 */

const DEFAULTS = { temperature: 0.3, maxTokens: 2048 };

/** Fail loudly on a non-2xx response instead of silently returning "". */
async function assertOk(res: Response, label: string): Promise<void> {
  if (res.ok) return;
  let body = "";
  try {
    body = (await res.text()).slice(0, 300);
  } catch {
    /* ignore */
  }
  throw new Error(`${label} request failed: ${res.status} ${res.statusText}. ${body}`);
}

function splitMessages(messages: ChatMessage[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const user = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");
  return { system, user };
}

// ── Anthropic ────────────────────────────────────────────────────────────────
export function buildAnthropicRequest(messages: ChatMessage[], opts: ChatOptions = {}) {
  const { system, user } = splitMessages(messages);
  return {
    model: "claude-sonnet-4-6",
    max_tokens: opts.maxTokens ?? DEFAULTS.maxTokens,
    temperature: opts.temperature ?? DEFAULTS.temperature,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: user }],
  };
}

// ── OpenAI / OpenRouter (same wire format) ────────────────────────────────────
export function buildOpenAIRequest(messages: ChatMessage[], opts: ChatOptions = {}, model = "gpt-4o-mini") {
  return {
    model,
    temperature: opts.temperature ?? DEFAULTS.temperature,
    max_tokens: opts.maxTokens ?? DEFAULTS.maxTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

// ── Ollama ────────────────────────────────────────────────────────────────────
export function buildOllamaRequest(messages: ChatMessage[], opts: ChatOptions = {}, model = "llama3.1") {
  return {
    model,
    stream: false,
    options: { temperature: opts.temperature ?? DEFAULTS.temperature },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

/** Build a callable ChatProvider for a discovered descriptor. */
export function createChatProvider(
  descriptor: ProviderDescriptor,
  env: Record<string, string | undefined> = process.env,
): ChatProvider {
  const { id, label } = descriptor;

  const complete = async (messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> => {
    switch (id) {
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY ?? "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(buildAnthropicRequest(messages, opts)),
        });
        await assertOk(res, "Anthropic");
        const json = (await res.json()) as { content?: Array<{ text?: string }> };
        return json.content?.map((c) => c.text ?? "").join("") ?? "";
      }
      case "openai":
      case "openrouter": {
        const base =
          id === "openrouter"
            ? "https://openrouter.ai/api/v1"
            : "https://api.openai.com/v1";
        const key = id === "openrouter" ? env.OPENROUTER_API_KEY : env.OPENAI_API_KEY;
        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key ?? ""}` },
          body: JSON.stringify(buildOpenAIRequest(messages, opts)),
        });
        await assertOk(res, id === "openrouter" ? "OpenRouter" : "OpenAI");
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        return json.choices?.[0]?.message?.content ?? "";
      }
      case "gemini": {
        const key = env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY ?? "";
        const { system, user } = splitMessages(messages);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
              contents: [{ role: "user", parts: [{ text: user }] }],
            }),
          },
        );
        await assertOk(res, "Gemini");
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      }
      case "ollama": {
        const host = env.OLLAMA_HOST ?? "http://localhost:11434";
        const res = await fetch(`${host.replace(/\/$/, "")}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildOllamaRequest(messages, opts)),
        });
        await assertOk(res, "Ollama");
        const json = (await res.json()) as { message?: { content?: string } };
        return json.message?.content ?? "";
      }
    }
  };

  return { id, label, complete };
}
