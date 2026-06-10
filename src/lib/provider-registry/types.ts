/**
 * ProviderRegistry types.
 *
 * JobPacket never makes the user paste a key into a setup form. On first run it
 * discovers whatever AI the user already has configured (env keys, a running
 * Ollama) and uses it. Scoring always has a guaranteed-free local fallback, so
 * tailoring is the only thing that needs a provider here.
 */

export type ProviderId =
  | "anthropic"
  | "openai"
  | "gemini"
  | "openrouter"
  | "ollama";

export interface ProviderCapability {
  /** Can generate text (resume tailoring). */
  chat: boolean;
  /** Exposes an embeddings endpoint (for the score engine's fuzzy fallback). */
  embeddings: boolean;
}

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  capability: ProviderCapability;
  /** "env" = found via an API key; "ollama" = a local server is running. */
  source: "env" | "ollama";
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

/** A ready-to-call chat backend. The tailor engine depends on this interface only.
 *  `id` is a free string because CLI agents (claude/codex/gemini) have their own ids
 *  alongside the API-based ProviderIds. */
export interface ChatProvider {
  id: string;
  label: string;
  complete(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
}
