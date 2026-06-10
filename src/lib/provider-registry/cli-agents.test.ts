import { describe, it, expect } from "vitest";
import {
  CLI_AGENT_SPECS,
  flattenMessages,
  createCliAgentProvider,
} from "./cli-agents";
import type { ChatMessage } from "./types";

describe("CLI_AGENT_SPECS", () => {
  it("includes claude, codex, gemini in preference order", () => {
    expect(CLI_AGENT_SPECS.map((s) => s.id)).toEqual(["claude", "codex", "gemini"]);
  });

  it("never puts user data in runArgs (prompt goes via stdin)", () => {
    for (const s of CLI_AGENT_SPECS) {
      expect(s.runArgs.join(" ")).not.toMatch(/prompt|\$\{/i);
    }
  });
});

describe("flattenMessages", () => {
  it("labels the system message and joins with blank lines", () => {
    const msgs: ChatMessage[] = [
      { role: "system", content: "be honest" },
      { role: "user", content: "do the thing" },
    ];
    expect(flattenMessages(msgs)).toBe("# Instructions\nbe honest\n\ndo the thing");
  });
});

describe("createCliAgentProvider", () => {
  it("builds a ChatProvider carrying the spec id and label", () => {
    const p = createCliAgentProvider(CLI_AGENT_SPECS[0]!);
    expect(p.id).toBe("claude");
    expect(p.label).toBe("Claude Code");
    expect(typeof p.complete).toBe("function");
  });
});
