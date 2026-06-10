import { describe, it, expect } from "vitest";
import { suggestRoles } from "./roles";

describe("suggestRoles", () => {
  it("suggests data/ML roles for a data-science CV, ranked by support", () => {
    const cv =
      "Python, Machine Learning, Deep Learning, scikit-learn, Pandas, NumPy, Statistics, NLP.";
    const roles = suggestRoles(cv).map((r) => r.role);
    expect(roles).toContain("Data Scientist");
    expect(roles).toContain("Machine Learning Engineer");
    // Data Scientist has the most supporting skills here → should rank first.
    expect(roles[0]).toBe("Data Scientist");
  });

  it("suggests web roles for a frontend CV", () => {
    const roles = suggestRoles("JavaScript, TypeScript, React, CSS, HTML, Node.js").map((r) => r.role);
    expect(roles).toContain("Frontend Developer");
    expect(roles).toContain("Full Stack Developer");
  });

  it("returns each suggestion with its supporting skills", () => {
    const [top] = suggestRoles("Python, Machine Learning, Deep Learning");
    expect(top?.matched.length).toBeGreaterThan(0);
  });

  it("returns nothing for a CV with no recognized skills", () => {
    expect(suggestRoles("I am passionate and hardworking.")).toEqual([]);
  });

  it("caps the number of suggestions", () => {
    const cv = "Python Java C C++ SQL React Node.js TypeScript Machine Learning Deep Learning AWS";
    expect(suggestRoles(cv, 3).length).toBeLessThanOrEqual(3);
  });
});
