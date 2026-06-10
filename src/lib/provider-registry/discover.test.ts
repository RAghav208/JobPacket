import { describe, it, expect } from "vitest";
import {
  discoverProviders,
  selectChatProvider,
  selectEmbeddingProvider,
} from "./discover";
import {
  buildAnthropicRequest,
  buildOpenAIRequest,
  buildOllamaRequest,
} from "./providers";
import type { ChatMessage } from "./types";

describe("discoverProviders", () => {
  it("finds nothing when the environment is empty", () => {
    expect(discoverProviders({})).toEqual([]);
    expect(selectChatProvider({})).toBeNull();
  });

  it("discovers Anthropic from ANTHROPIC_API_KEY (chat, no embeddings)", () => {
    const got = discoverProviders({ ANTHROPIC_API_KEY: "sk-x" });
    expect(got).toHaveLength(1);
    expect(got[0]?.id).toBe("anthropic");
    expect(got[0]?.capability).toEqual({ chat: true, embeddings: false });
  });

  it("discovers OpenAI with embeddings capability", () => {
    const got = discoverProviders({ OPENAI_API_KEY: "sk-x" });
    expect(got[0]?.capability.embeddings).toBe(true);
  });

  it("accepts either GEMINI_API_KEY or GOOGLE_API_KEY", () => {
    expect(discoverProviders({ GOOGLE_API_KEY: "x" })[0]?.id).toBe("gemini");
    expect(discoverProviders({ GEMINI_API_KEY: "x" })[0]?.id).toBe("gemini");
  });

  it("treats blank/whitespace keys as absent", () => {
    expect(discoverProviders({ ANTHROPIC_API_KEY: "   " })).toEqual([]);
  });

  it("includes Ollama only when the live probe says it is up", () => {
    expect(discoverProviders({}, { ollamaAvailable: false })).toEqual([]);
    const got = discoverProviders({}, { ollamaAvailable: true });
    expect(got[0]?.id).toBe("ollama");
    expect(got[0]?.capability).toEqual({ chat: true, embeddings: true });
  });
});

describe("provider selection priority", () => {
  const env = { ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "b" };

  it("prefers a configured cloud key by default (Anthropic over OpenAI)", () => {
    expect(selectChatProvider(env)?.id).toBe("anthropic");
  });

  it("preferLocal moves Ollama to the front", () => {
    const got = selectChatProvider(env, { ollamaAvailable: true, preferLocal: true });
    expect(got?.id).toBe("ollama");
  });

  it("embeddings selection skips Anthropic (no embeddings API)", () => {
    // Anthropic-only env → no embeddings provider → caller uses local fallback.
    expect(selectEmbeddingProvider({ ANTHROPIC_API_KEY: "a" })).toBeNull();
    // Add OpenAI → embeddings now available.
    expect(selectEmbeddingProvider({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "b" })?.id).toBe("openai");
  });
});

describe("request builders (pure, no network)", () => {
  const msgs: ChatMessage[] = [
    { role: "system", content: "be honest" },
    { role: "user", content: "tailor this" },
  ];

  it("Anthropic puts system text in the top-level `system` field", () => {
    const req = buildAnthropicRequest(msgs);
    expect(req.system).toBe("be honest");
    expect(req.messages).toEqual([{ role: "user", content: "tailor this" }]);
  });

  it("OpenAI keeps system+user in the messages array", () => {
    const req = buildOpenAIRequest(msgs);
    expect(req.messages).toHaveLength(2);
    expect(req.messages[0]).toEqual({ role: "system", content: "be honest" });
  });

  it("Ollama sets stream:false for a single response", () => {
    expect(buildOllamaRequest(msgs).stream).toBe(false);
  });
});
