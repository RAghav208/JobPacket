export {
  discoverProviders,
  selectChatProvider,
  selectEmbeddingProvider,
  isOllamaRunning,
} from "./discover";
export type { DiscoverOptions } from "./discover";
export {
  createChatProvider,
  buildAnthropicRequest,
  buildOpenAIRequest,
  buildOllamaRequest,
} from "./providers";
export {
  CLI_AGENT_SPECS,
  detectCliAgents,
  createCliAgentProvider,
  flattenMessages,
} from "./cli-agents";
export type { CliAgentSpec } from "./cli-agents";
export type {
  ProviderId,
  ProviderDescriptor,
  ProviderCapability,
  ChatProvider,
  ChatMessage,
  ChatOptions,
} from "./types";

import { discoverProviders, isOllamaRunning } from "./discover";
import { createChatProvider } from "./providers";
import { detectCliAgents, createCliAgentProvider } from "./cli-agents";
import type { ChatProvider } from "./types";

/**
 * All available chat providers, in preference order:
 *   CLI agents (Claude → Codex → Gemini) → Ollama server → API keys.
 *
 * CLI agents come first because they use the user's already-authenticated agent
 * with no API key. Detection spawns a process per agent (cached ~60s).
 */
export async function getChatProviders(
  env: Record<string, string | undefined> = process.env,
): Promise<ChatProvider[]> {
  const providers: ChatProvider[] = [];

  // 1) Installed CLI agents, in spec order.
  for (const agent of await detectCliAgents()) {
    providers.push(createCliAgentProvider(agent));
  }

  // 2) Ollama HTTP server (if running) ahead of API keys.
  const ollamaAvailable = await isOllamaRunning();
  const descriptors = discoverProviders(env, { ollamaAvailable });
  const ollama = descriptors.find((d) => d.id === "ollama");
  if (ollama) providers.push(createChatProvider(ollama, env));

  // 3) API-key providers last.
  for (const d of descriptors.filter((d) => d.id !== "ollama")) {
    providers.push(createChatProvider(d, env));
  }

  return providers;
}

/** The single best available provider, or null if nothing is configured. */
export async function getChatProvider(
  env: Record<string, string | undefined> = process.env,
): Promise<ChatProvider | null> {
  return (await getChatProviders(env))[0] ?? null;
}

/**
 * A provider that tries each available backend in order and falls through on
 * failure (so a present-but-broken key never blocks a working agent). If `only`
 * is given, restrict to that provider id (for the UI's manual override).
 */
export async function getFallbackChatProvider(
  env: Record<string, string | undefined> = process.env,
  only?: string,
): Promise<ChatProvider | null> {
  let providers = await getChatProviders(env);
  if (only) providers = providers.filter((p) => p.id === only);
  if (providers.length === 0) return null;

  const first = providers[0]!;
  return {
    id: first.id,
    label:
      providers.length > 1 ? `${first.label} (+${providers.length - 1} fallback)` : first.label,
    async complete(messages, opts) {
      const errors: string[] = [];
      for (const p of providers) {
        try {
          const text = await p.complete(messages, opts);
          if (text.trim()) return text;
        } catch (e) {
          errors.push(`${p.label}: ${(e as Error).message}`);
        }
      }
      throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
    },
  };
}

/** id+label of every available provider, for the UI picker. */
export async function listProviderInfo(
  env: Record<string, string | undefined> = process.env,
): Promise<Array<{ id: string; label: string }>> {
  return (await getChatProviders(env)).map((p) => ({ id: p.id, label: p.label }));
}
