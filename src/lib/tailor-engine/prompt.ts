import type { ChatMessage } from "../provider-registry/types";
import type { ScoreResult } from "../score-engine/types";

/**
 * Build the tailoring prompt. Pure — no network, no provider. Tested directly.
 *
 * The guardrails here are the FIRST line of honesty defense (the second is the
 * programmatic added-skills check after generation). The model is told to
 * surface only genuinely-supported skills and to never invent experience.
 */
export function buildTailoringPrompt(
  resumeText: string,
  jobDescription: string,
  score: ScoreResult,
): ChatMessage[] {
  const missing = score.missing.length ? score.missing.join(", ") : "(none)";

  const system = [
    "You are a resume editor that helps a candidate pass ATS keyword screening HONESTLY.",
    "Rules you must never break:",
    "1. NEVER invent experience, skills, employers, dates, or achievements the candidate does not have.",
    "2. You may RE-SURFACE skills the candidate genuinely demonstrates but expressed in different words,",
    "   rephrasing them using the job description's terminology.",
    "3. If the candidate clearly lacks a required skill, LEAVE IT MISSING. Do not paper over a real gap.",
    "4. Preserve the candidate's real facts. Improve wording, ordering, and keyword surfacing only.",
    "Return ONLY the revised resume text. No commentary, no markdown fences.",
  ].join("\n");

  const user = [
    "JOB DESCRIPTION:",
    jobDescription.trim(),
    "",
    `SKILLS THE JOB WANTS THAT ARE NOT YET VISIBLE ON THE RESUME: ${missing}`,
    "(Only surface the ones the candidate's experience genuinely supports. Skip the rest.)",
    "",
    "CURRENT RESUME:",
    resumeText.trim(),
    "",
    "Rewrite the resume to honestly surface genuinely-supported skills using the job's terminology.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
