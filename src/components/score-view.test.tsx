import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScoreBar, ScoreView } from "./score-view";
import type { ScoreResult } from "@/lib/score-engine";

afterEach(cleanup);

describe("ScoreBar", () => {
  it("shows the score percentage", () => {
    render(<ScoreBar score={73} />);
    expect(screen.getByText("73%")).toBeTruthy();
  });
});

describe("ScoreView", () => {
  const result: ScoreResult = {
    score: 67,
    matched: [
      { skill: "Python", matchedTerm: "Python", method: "exact" },
      { skill: "JavaScript", matchedTerm: "JS", method: "synonym" },
    ],
    missing: ["SQL"],
    jdSkills: ["Python", "JavaScript", "SQL"],
    explanation: "Matched 2 of 3 skills this job asks for. Missing: SQL.",
  };

  it("renders the score, counts, and a missing skill", () => {
    render(<ScoreView result={result} />);
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText(/Matched \(2\)/)).toBeTruthy();
    expect(screen.getByText(/Missing \(1\)/)).toBeTruthy();
    expect(screen.getByText("SQL")).toBeTruthy();
    expect(screen.getByText("Python")).toBeTruthy();
  });

  it("shows synonym evidence for a fuzzy match", () => {
    render(<ScoreView result={result} />);
    // matchedTerm "JS" is shown as the evidence for the JavaScript match.
    expect(screen.getByText(/JS/)).toBeTruthy();
  });
});
