import { tailorResume } from "../tailor-engine/tailor";
import type { JobPosting } from "../job-sources/types";
import type { ChatProvider } from "../provider-registry/types";
import type { ScoreResult } from "../score-engine/types";
import { buildCoverLetterPrompt } from "./cover-letter";

/**
 * The complete packet for one job application.
 *
 *   CV + approved posting ─► tailorResume ─► { before, after, tailored, addedSkills }
 *                        └─► cover letter (best-effort)
 *
 * Everything honest: the score is recomputed by the engine, added skills are
 * surfaced for confirmation, and the cover letter shares the no-fabrication rule.
 */
export interface JobPacket {
  job: JobPosting;
  before: ScoreResult;
  after: ScoreResult;
  tailoredResume: string;
  /** Skills the tailored resume added vs the original — confirm before using. */
  addedSkills: string[];
  /** Cover letter, or "" if generation failed (the rest of the packet still stands). */
  coverLetter: string;
}

export async function buildPacket(
  cv: string,
  job: JobPosting,
  provider: ChatProvider,
): Promise<JobPacket> {
  const tailored = await tailorResume(cv, job.description || `${job.title} ${job.company}`, provider);

  // Cover letter is best-effort: a failure here must not lose the tailored resume.
  let coverLetter = "";
  try {
    coverLetter = (await provider.complete(buildCoverLetterPrompt(cv, job))).trim();
  } catch {
    coverLetter = "";
  }

  return {
    job,
    before: tailored.before,
    after: tailored.after,
    tailoredResume: tailored.tailoredText,
    addedSkills: tailored.addedSkills,
    coverLetter,
  };
}

/** Render a packet as a single downloadable Markdown document. */
export function packetToMarkdown(p: JobPacket): string {
  const lines = [
    `# Application Packet — ${p.job.title || "Role"}${p.job.company ? ` @ ${p.job.company}` : ""}`,
    "",
    p.job.location ? `**Location:** ${p.job.location}` : "",
    p.job.url ? `**Posting:** ${p.job.url}` : "",
    "",
    `**Match:** ${p.before.score}% → ${p.after.score}% after tailoring`,
    p.addedSkills.length
      ? `**Confirm before using (skills tailoring added):** ${p.addedSkills.join(", ")}`
      : "",
    "",
    "## Tailored Resume",
    "",
    p.tailoredResume,
    "",
    "## Cover Letter",
    "",
    p.coverLetter || "_(not generated)_",
    "",
    "## Job Description",
    "",
    p.job.description || "_(not captured)_",
    "",
  ];
  return lines.filter((l) => l !== "").join("\n");
}
