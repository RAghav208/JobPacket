import { scoreResume, defaultVocabulary } from "../score-engine/score";
import type { ScoreResult, SkillVocabulary } from "../score-engine/types";
import type { ChatProvider } from "../provider-registry/types";
import { skillsMentionedIn } from "../skills/match";
import { buildTailoringPrompt } from "./prompt";

export interface TailorOptions {
  vocabulary?: SkillVocabulary;
  /**
   * JD-required skills the résumé is missing. Pass the AI matcher's `missing`
   * list (high quality) where available; falls back to the keyword scorer's.
   */
  missingSkills?: string[];
}

export interface TailorResult {
  tailoredText: string;
  /** Keyword-based before/after — used by the standalone Quick Score page. */
  before: ScoreResult;
  after: ScoreResult;
  /**
   * Of the missing skills, which the rewritten résumé now claims. Surfaced for
   * the user to confirm (the honesty guard) — high recall because it checks an
   * explicit skill list, not a fixed vocabulary.
   */
  addedSkills: string[];
}

export async function tailorResume(
  resumeText: string,
  jobDescription: string,
  provider: ChatProvider,
  opts: TailorOptions = {},
): Promise<TailorResult> {
  const vocabulary = opts.vocabulary ?? defaultVocabulary;
  const before = scoreResume(resumeText, jobDescription, { vocabulary });

  const missingSkills = opts.missingSkills?.length ? opts.missingSkills : before.missing;

  const messages = buildTailoringPrompt(resumeText, jobDescription, missingSkills);
  const tailoredText = (await provider.complete(messages)).trim();

  const after = scoreResume(tailoredText, jobDescription, { vocabulary });
  const addedSkills = skillsMentionedIn(tailoredText, missingSkills);

  return { tailoredText, before, after, addedSkills };
}
