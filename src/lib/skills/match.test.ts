import { describe, it, expect } from "vitest";
import { matchSkills, normalizeSkill, skillsMentionedIn } from "./match";

describe("normalizeSkill", () => {
  it("maps known aliases to canonical names", () => {
    expect(normalizeSkill("JS")).toBe("JavaScript");
    expect(normalizeSkill("sklearn")).toBe("scikit-learn");
  });

  it("passes through unknown skills trimmed", () => {
    expect(normalizeSkill("  Rust ")).toBe("Rust");
  });
});

describe("skillsMentionedIn", () => {
  it("finds candidate skills present in text, alias-aware", () => {
    const text = "Built dashboards in JS and wrote SQL queries.";
    expect(skillsMentionedIn(text, ["JavaScript", "SQL", "Kubernetes"]).sort()).toEqual([
      "JavaScript",
      "SQL",
    ]);
  });

  it("is boundary-aware: 'Java' does not match inside 'JavaScript'", () => {
    expect(skillsMentionedIn("JavaScript developer", ["Java"])).toEqual([]);
  });

  it("returns [] when none are mentioned", () => {
    expect(skillsMentionedIn("Python only", ["Go", "Rust"])).toEqual([]);
  });
});

describe("matchSkills", () => {
  it("matches via alias normalization and scores the overlap", () => {
    const r = matchSkills(["Python", "JS"], ["JavaScript", "Python", "SQL"]);
    expect(r.matched.map((m) => m.skill).sort()).toEqual(["JavaScript", "Python"]);
    expect(r.missing).toEqual(["SQL"]);
    expect(r.score).toBe(67); // 2 of 3
  });

  it("honest ceiling: a required skill absent from the CV stays missing", () => {
    const r = matchSkills(["Python"], ["Python", "Kubernetes"]);
    expect(r.missing).toContain("Kubernetes");
    expect(r.score).toBeLessThan(100);
  });

  it("dedupes JD skills and handles an empty JD list", () => {
    expect(matchSkills(["Python"], ["Python", "python"]).jdSkills).toEqual(["Python"]);
    expect(matchSkills(["Python"], []).score).toBe(0);
  });
});
