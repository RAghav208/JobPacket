import { describe, it, expect } from "vitest";
import { tailorResume } from "./tailor";
import { buildTailoringPrompt } from "./prompt";
import { scoreResume } from "../score-engine/score";
import type { ChatProvider, ChatMessage } from "../provider-registry/types";

/** A fake provider that returns a fixed string, so we test the flow with no network. */
function fakeProvider(reply: string): ChatProvider {
  return {
    id: "ollama",
    label: "fake",
    complete: async (_messages: ChatMessage[]) => reply,
  };
}

describe("buildTailoringPrompt", () => {
  const score = scoreResume("Python.", "Want Python, Kubernetes.");
  const [system, user] = buildTailoringPrompt("Python.", "Want Python, Kubernetes.", score);

  it("forbids fabrication in the system prompt", () => {
    expect(system?.content.toLowerCase()).toContain("never invent");
  });

  it("tells the model which skills are missing", () => {
    expect(user?.content).toContain("Kubernetes");
  });

  it("includes the resume and the job description", () => {
    expect(user?.content).toContain("Python.");
    expect(user?.content).toContain("Want Python");
  });
});

describe("tailorResume — the gap closing", () => {
  it("raises the score when the provider surfaces a genuinely-held skill", async () => {
    const resume = "I build neural nets and train models in Python.";
    const jd = "Need Python and Deep Learning.";
    // Candidate clearly does deep learning ("neural nets") but never wrote the words.
    const tailored = "Python developer with hands-on Deep Learning (neural networks) experience.";

    const r = await tailorResume(resume, jd, fakeProvider(tailored));

    expect(r.before.score).toBeLessThan(r.after.score);
    expect(r.after.matched.map((m) => m.skill)).toContain("Deep Learning");
    expect(r.addedSkills).toContain("Deep Learning");
  });

  it("flags ANY newly-added skill for confirmation (even a dishonest one)", async () => {
    const resume = "Python developer.";
    const jd = "Need Python and Kubernetes.";
    // A lying model bolts on Kubernetes the candidate never mentioned.
    const tailored = "Python and Kubernetes expert.";

    const r = await tailorResume(resume, jd, fakeProvider(tailored));

    // The tool does not silently trust it — it surfaces it for the user to confirm.
    expect(r.addedSkills).toContain("Kubernetes");
  });

  it("reports no added skills when the rewrite only rephrases existing content", async () => {
    const resume = "Python and Machine Learning.";
    const jd = "Need Python and Machine Learning.";
    const tailored = "Experienced in Python and Machine Learning.";

    const r = await tailorResume(resume, jd, fakeProvider(tailored));

    expect(r.addedSkills).toEqual([]);
    expect(r.after.score).toBe(r.before.score);
  });
});
