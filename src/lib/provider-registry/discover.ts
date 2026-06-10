import type { ProviderDescriptor, ProviderId } from "./types";

/**
 * Pure provider discovery.
 *
 * Reads an environment map (defaults to process.env) and an optional flag for
 * whether a local Ollama server answered, and returns the providers available
 * for use. Pure and synchronous so it is trivially testable — the live Ollama
 * probe happens in `isOllamaRunning()` and is passed in as `ollamaAvailable`.
 */

export interface DiscoverOptions {
  /** Result of a live probe to the local Ollama server (see isOllamaRunning). */
  ollamaAvailable?: boolean;
  /**
   * Prefer free/local backends (Ollama) over paid cloud keys even when both
   * exist, to avoid surprise API charges. Default false: a configured cloud key
   * is assumed intentional.
   */
  preferLocal?: boolean;
}

type Env = Record<string, string | undefined>;

interface Rule {
  id: ProviderId;
  label: string;
  keys: string[];
  embeddings: boolean;
}

// Order here is the default selection priority (cloud keys first; they were
// configured on purpose). `preferLocal` moves Ollama to the front.
const ENV_RULES: Rule[] = [
  { id: "anthropic", label: "Anthropic (Claude)", keys: ["ANTHROPIC_API_KEY"], embeddings: false },
  { id: "openai", label: "OpenAI", keys: ["OPENAI_API_KEY"], embeddings: true },
  { id: "gemini", label: "Google Gemini", keys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], embeddings: true },
  { id: "openrouter", label: "OpenRouter", keys: ["OPENROUTER_API_KEY"], embeddings: false },
];

export function discoverProviders(
  env: Env = process.env,
  opts: DiscoverOptions = {},
): ProviderDescriptor[] {
  const found: ProviderDescriptor[] = [];

  for (const rule of ENV_RULES) {
    if (rule.keys.some((k) => (env[k] ?? "").trim().length > 0)) {
      found.push({
        id: rule.id,
        label: rule.label,
        capability: { chat: true, embeddings: rule.embeddings },
        source: "env",
      });
    }
  }

  if (opts.ollamaAvailable) {
    const ollama: ProviderDescriptor = {
      id: "ollama",
      label: "Ollama (local)",
      capability: { chat: true, embeddings: true },
      source: "ollama",
    };
    if (opts.preferLocal) found.unshift(ollama);
    else found.push(ollama);
  }

  return found;
}

/** The best available chat provider, or null if the user has nothing configured. */
export function selectChatProvider(
  env: Env = process.env,
  opts: DiscoverOptions = {},
): ProviderDescriptor | null {
  return discoverProviders(env, opts).find((p) => p.capability.chat) ?? null;
}

/** The best available embeddings provider, or null (caller falls back to local Transformers.js). */
export function selectEmbeddingProvider(
  env: Env = process.env,
  opts: DiscoverOptions = {},
): ProviderDescriptor | null {
  return discoverProviders(env, opts).find((p) => p.capability.embeddings) ?? null;
}

/** Live probe: is a local Ollama server answering? Best-effort, never throws. */
export async function isOllamaRunning(
  host = process.env.OLLAMA_HOST ?? "http://localhost:11434",
): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 400);
    const res = await fetch(`${host.replace(/\/$/, "")}/api/tags`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}
