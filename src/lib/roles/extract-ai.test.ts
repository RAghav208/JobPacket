import { describe, it, expect } from "vitest";
import { buildRolePrompt, parseRoles, extractRolesAI } from "./extract-ai";
import type { ChatProvider, ChatMessage } from "../provider-registry/types";

describe("buildRolePrompt", () => {
  const [system, user] = buildRolePrompt("Python and ML experience.");
  it("asks for a JSON array of titles and includes the CV", () => {
    expect(system?.content).toMatch(/JSON array/i);
    expect(user?.content).toContain("Python and ML");
  });
});

describe("parseRoles", () => {
  it("parses a clean JSON array", () => {
    expect(parseRoles('["Data Analyst", "Business Analyst"]')).toEqual([
      "Data Analyst",
      "Business Analyst",
    ]);
  });

  it("extracts a JSON array embedded in chatter", () => {
    expect(parseRoles('Sure! Here you go:\n["ML Engineer"]\nHope that helps')).toEqual([
      "ML Engineer",
    ]);
  });

  it("falls back to bullet/numbered lines", () => {
    const raw = "1. Data Scientist\n2. ML Engineer\n- NLP Engineer";
    expect(parseRoles(raw)).toEqual(["Data Scientist", "ML Engineer", "NLP Engineer"]);
  });

  it("dedupes case-insensitively and caps the count", () => {
    const raw = '["A","a","B","C","D","E","F","G"]';
    const out = parseRoles(raw, 3);
    expect(out).toEqual(["A", "B", "C"]);
  });

  it("drops stray long sentences that aren't titles", () => {
    const raw = "Data Analyst\nI think you would be a great fit for many roles in analytics and data.";
    expect(parseRoles(raw)).toEqual(["Data Analyst"]);
  });
});

describe("extractRolesAI", () => {
  it("calls the provider and parses its output", async () => {
    const provider: ChatProvider = {
      id: "ollama",
      label: "fake",
      complete: async (_m: ChatMessage[]) => '["Data Scientist", "ML Engineer"]',
    };
    expect(await extractRolesAI("cv text", provider)).toEqual([
      "Data Scientist",
      "ML Engineer",
    ]);
  });
});
