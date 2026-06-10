import { describe, it, expect } from "vitest";
import { scoreResume } from "./score";
import { detectSkills } from "./extract";
import type { SkillVocabulary } from "./types";

describe("scoreResume — honest ceiling (regression-class, write-first)", () => {
  // The trust property validated during dogfooding: a skill the JD requires
  // but the resume lacks can NEVER be counted as present, and the score can
  // never reach 100 while a required skill is missing.
  it("keeps a required-but-absent skill in `missing` and refuses to inflate", () => {
    const resume = "Python and Machine Learning experience.";
    const jd = "We want Python, Machine Learning, and Publications.";

    const r = scoreResume(resume, jd);

    expect(r.missing).toContain("Publications");
    expect(r.matched.map((m) => m.skill)).not.toContain("Publications");
    expect(r.score).toBeLessThan(100);
    // 2 of 3 → 67
    expect(r.score).toBe(67);
  });

  it("never fabricates a match: adding a missing skill only ever lowers the score", () => {
    const resume = "Python.";
    const jdNarrow = "Python.";
    const jdWide = "Python and Kubernetes.";

    expect(scoreResume(resume, jdNarrow).score).toBe(100);
    expect(scoreResume(resume, jdWide).score).toBeLessThan(100);
  });
});

describe("scoreResume — synonym matching", () => {
  it("matches 'JS' on the resume to 'JavaScript' in the JD, flagged as synonym", () => {
    const r = scoreResume("Built UIs in JS.", "Looking for JavaScript skills.");
    const js = r.matched.find((m) => m.skill === "JavaScript");
    expect(js).toBeDefined();
    expect(js?.matchedTerm.toLowerCase()).toBe("js");
    expect(js?.method).toBe("synonym");
    expect(r.score).toBe(100);
  });

  it("matches 'sklearn' to 'scikit-learn'", () => {
    const r = scoreResume("Used sklearn daily.", "Must know scikit-learn.");
    expect(r.matched.map((m) => m.skill)).toContain("scikit-learn");
  });
});

describe("scoreResume — over-match guards (the embedding risk, avoided)", () => {
  it("does NOT match 'Java' (resume) against 'JavaScript' (JD)", () => {
    const r = scoreResume("Strong Java background.", "We need JavaScript.");
    expect(r.missing).toContain("JavaScript");
    expect(r.matched.map((m) => m.skill)).not.toContain("JavaScript");
    expect(r.score).toBe(0);
  });

  it("does NOT let resume 'C++' satisfy a JD asking for plain 'C'", () => {
    const r = scoreResume("I write C++ all day.", "Plain C required.");
    // JD asks only for C. Resume has C++, which must NOT count as C.
    expect(r.jdSkills).toContain("C");
    expect(r.missing).toContain("C");
    expect(r.matched.map((m) => m.skill)).not.toContain("C");
    expect(r.score).toBe(0);
  });

  it("does not detect 'C' inside an ordinary word like 'machine'", () => {
    const detected = detectSkills("machine learning pipeline", {
      C: [],
    } as SkillVocabulary);
    expect(detected.has("C")).toBe(false);
  });
});

describe("scoreResume — edge cases", () => {
  it("returns score 0 and a clear message when the JD has no known skills", () => {
    const r = scoreResume("Python expert.", "We value passion and teamwork.");
    expect(r.score).toBe(0);
    expect(r.jdSkills).toHaveLength(0);
    expect(r.explanation).toMatch(/no known skills/i);
  });

  it("is case-insensitive", () => {
    const r = scoreResume("PYTHON and pandas.", "python, PANDAS");
    expect(r.score).toBe(100);
  });

  it("does not double-count a skill mentioned many times", () => {
    const r = scoreResume("Python Python Python.", "Python Python.");
    expect(r.jdSkills).toEqual(["Python"]);
    expect(r.matched).toHaveLength(1);
  });
});

describe("scoreResume — real case: Raghav's resume vs Google Student Researcher", () => {
  const resume = `
    TECHNICAL SKILLS: Python, C, C++, HTML, Pandas, NumPy, scikit-learn,
    TensorFlow, Deep Learning, Machine Learning, Feature Engineering, Git, GitHub.
    Explored large language model architecture through academic research.
    Built pipelines for text generation and NLP tasks.
  `;
  const jd = `
    Minimum: enrolled in a degree program; experience in Machine Learning,
    Deep Learning, Natural Language Processing, or Data Science; one programming
    language such as Python, Java, or C++.
    Preferred: contributing to research communities, including Publications in
    major conferences or journals.
  `;

  const r = scoreResume(resume, jd);

  it("matches the strong ML/Python signal", () => {
    const skills = r.matched.map((m) => m.skill);
    expect(skills).toEqual(
      expect.arrayContaining([
        "Python",
        "C++",
        "Machine Learning",
        "Deep Learning",
        "Natural Language Processing",
      ]),
    );
  });

  it("flags Publications as the honest gap (cannot be tailored away)", () => {
    expect(r.missing).toContain("Publications");
  });

  it("scores high-but-not-perfect, reflecting the real ceiling", () => {
    expect(r.score).toBeGreaterThan(60);
    expect(r.score).toBeLessThan(100);
  });
});
