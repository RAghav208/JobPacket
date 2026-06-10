import type { ChatMessage } from "../provider-registry/types";
import type { JobPosting } from "../job-sources/types";

/**
 * Build the cover-letter prompt. Pure — tested directly.
 * Same honesty contract as tailoring: never invent experience.
 */
export function buildCoverLetterPrompt(cv: string, job: JobPosting): ChatMessage[] {
  const system = [
    "You write concise, honest cover letters for job applicants in India.",
    "Rules:",
    "- 120-160 words, first person, professional but warm.",
    "- NEVER invent experience, skills, or achievements not in the resume.",
    "- Reference the specific company and role.",
    "- Plain text only. No placeholders like [Your Name], no markdown, no salutation gaps.",
  ].join("\n");

  const role = [job.title, job.company && `at ${job.company}`].filter(Boolean).join(" ");
  const user = [
    `ROLE: ${role || job.title || "the role"}`,
    job.location ? `LOCATION: ${job.location}` : "",
    "",
    "JOB DESCRIPTION:",
    (job.description || `${job.title} at ${job.company}`).trim(),
    "",
    "CANDIDATE RESUME:",
    cv.trim(),
    "",
    "Write the cover letter now.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
