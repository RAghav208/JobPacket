import type { ChatMessage } from "../provider-registry/types";

/**
 * Build the prompt for a skills learning plan that closes the gaps for a job
 * WITHIN the user's chosen timeframe. Pure — tested directly. The model gets
 * the REAL missing skills (from the deterministic match), so the plan targets
 * actual gaps, not invented ones.
 */
export function buildLearningPlanPrompt(
  missingSkills: string[],
  jobTitle?: string,
  timeframe?: string,
): ChatMessage[] {
  const skills = missingSkills.length
    ? missingSkills.join(", ")
    : "(no specific gaps — suggest the highest-impact skills for this role)";
  const window = timeframe ?? "1 month";

  const system = [
    "You are a practical, no-nonsense career coach for job seekers in India.",
    `Write a learning plan the candidate can ACTUALLY complete in ${window} — to be ready`,
    "to apply and interview for the target role by the end of that window.",
    "Pacing rules:",
    `- The TOTAL plan must fit inside ${window}. Lay it out as a week-by-week (or day-by-day`,
    "  for short windows) schedule with rough hours.",
    "- If there are too many gaps for the window, ruthlessly prioritize: cover what matters",
    "  most for THIS role first, and explicitly list what to skip for now and why.",
    "For EACH skill you include give exactly: (1) why it matters for this role — one line;",
    "(2) the fastest credible way to learn it in the time available, preferring FREE resources",
    "(official docs, freeCodeCamp, Kaggle, NeetCode, YouTube, MDN) — name them;",
    "(3) one small portfolio project that proves it (sized to fit the schedule).",
    "Be concrete and tight. No fluff. Return clean, readable Markdown.",
  ].join("\n");

  const user = [
    `TARGET ROLE: ${jobTitle ?? "the role"}`,
    `TIMEFRAME TO BE JOB-READY: ${window}`,
    `SKILL GAPS TO CLOSE: ${skills}`,
    "",
    "Write the learning plan.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
