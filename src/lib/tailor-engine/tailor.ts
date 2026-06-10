import { scoreResume } from "../score-engine/score";
import { detectSkills } from "../score-engine/extract";
import { defaultVocabulary } from "../score-engine/score";
import type { ScoreResult, SkillVocabulary } from "../score-engine/types";
import type { ChatProvider } from "../provider-registry/types";
import { buildTailoringPrompt } from "./prompt";

export interface TailorOptions {
  vocabulary?: SkillVocabulary;
}

export interface TailorResult {
  /** The rewritten resume text from the provider. */
  tailoredText: string;
  /** Score of the ORIGINAL resume vs the JD. */
  before: ScoreResult;
  /** Score of the TAILORED resume vs the JD (recomputed by the same honest engine). */
  after: ScoreResult;
  /**
   * Skills that appear in the tailored resume but were NOT in the original.
   * These are NOT auto-trusted — the UI must ask the candidate to confirm each
   * is true before counting it. This is the honest ceiling enforced in code:
   * the tool never silently inflates, it asks.
   */
  addedSkills: string[];
}

/**
 * Tailor a resume to a job description, then re-score honestly.
 *
 *   original ─► score (before) ─► prompt ─► provider ─► tailored ─► score (after)
 *                                                          │
 *                                            added skills (need user confirmation)
 *
 * The provider is injected (any ChatProvider), so this is fully testable with a
 * fake — no network, no key.
 */
export async function tailorResume(
  resumeText: string,
  jobDescription: string,
  provider: ChatProvider,
  opts: TailorOptions = {},
): Promise<TailorResult> {
  const vocabulary = opts.vocabulary ?? defaultVocabulary;

  const before = scoreResume(resumeText, jobDescription, { vocabulary });

  const messages = buildTailoringPrompt(resumeText, jobDescription, before);
  const tailoredText = (await provider.complete(messages)).trim();

  const after = scoreResume(tailoredText, jobDescription, { vocabulary });

  const originalSkills = new Set(detectSkills(resumeText, vocabulary).keys());
  const tailoredSkills = new Set(detectSkills(tailoredText, vocabulary).keys());
  const addedSkills = [...tailoredSkills].filter((s) => !originalSkills.has(s));

  return { tailoredText, before, after, addedSkills };
}
