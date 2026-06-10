import { describe, it, expect } from "vitest";
import { buildSkillPrompt, parseSkillList, extractSkills, parseBatchSkills } from "./extract-skills";
import type { ChatProvider, ChatMessage } from "../provider-registry/types";

describe("buildSkillPrompt", () => {
  it("frames CV vs JD extraction and forbids inference", () => {
    expect(buildSkillPrompt("x", "cv")[0]?.content).toMatch(/never infer/i);
    expect(buildSkillPrompt("x", "cv")[1]?.content).toContain("RESUME");
    expect(buildSkillPrompt("x", "jd")[1]?.content).toContain("JOB DESCRIPTION");
  });
});

describe("parseSkillList", () => {
  it("parses a JSON array", () => {
    expect(parseSkillList('["Python", "SQL", "Machine Learning"]')).toEqual([
      "Python",
      "SQL",
      "Machine Learning",
    ]);
  });

  it("parses bullet/numbered lines and dedupes", () => {
    expect(parseSkillList("1. Python\n- Python\n* SQL")).toEqual(["Python", "SQL"]);
  });

  it("drops overly long non-skill lines", () => {
    expect(parseSkillList("Python\nThis candidate has a lot of experience across many domains and tools")).toEqual([
      "Python",
    ]);
  });
});

describe("parseBatchSkills", () => {
  it("parses an array-of-arrays into per-job lists", () => {
    const out = parseBatchSkills('[["Python","SQL"],["React","TypeScript"]]', 2);
    expect(out).toEqual([
      ["Python", "SQL"],
      ["React", "TypeScript"],
    ]);
  });

  it("pads to the requested count when the model returns fewer", () => {
    const out = parseBatchSkills('[["Python"]]', 3);
    expect(out).toHaveLength(3);
    expect(out[1]).toEqual([]);
    expect(out[2]).toEqual([]);
  });

  it("returns empty lists when parsing fails", () => {
    expect(parseBatchSkills("not json at all", 2)).toEqual([[], []]);
  });
});

describe("extractSkills", () => {
  it("calls the provider and parses the list", async () => {
    const provider: ChatProvider = {
      id: "ollama",
      label: "fake",
      complete: async (_m: ChatMessage[]) => '["Python", "Random Forest", "SVM"]',
    };
    expect(await extractSkills("cv", provider)).toEqual(["Python", "Random Forest", "SVM"]);
  });
});
