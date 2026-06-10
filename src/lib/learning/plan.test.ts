import { describe, it, expect } from "vitest";
import { buildLearningPlanPrompt } from "./plan";

describe("buildLearningPlanPrompt", () => {
  it("includes the missing skills and the role", () => {
    const [, user] = buildLearningPlanPrompt(["SQL", "Docker"], "Data Engineer", "1 month");
    expect(user?.content).toContain("SQL, Docker");
    expect(user?.content).toContain("Data Engineer");
  });

  it("paces the plan to the chosen timeframe", () => {
    const [system, user] = buildLearningPlanPrompt(["SQL"], "Analyst", "2 weeks");
    expect(system?.content).toContain("2 weeks");
    expect(user?.content).toContain("2 weeks");
    expect(system?.content.toLowerCase()).toContain("prioritize");
  });

  it("defaults the timeframe to 1 month when not given", () => {
    const [system] = buildLearningPlanPrompt(["SQL"], "Analyst");
    expect(system?.content).toContain("1 month");
  });

  it("asks for free resources and a project per skill", () => {
    const [system] = buildLearningPlanPrompt(["SQL"], "x", "1 week");
    expect(system?.content.toLowerCase()).toContain("free");
    expect(system?.content.toLowerCase()).toContain("project");
  });

  it("handles an empty gap list gracefully", () => {
    const [, user] = buildLearningPlanPrompt([], "Analyst", "1 month");
    expect(user?.content).toMatch(/highest-impact/i);
  });
});
