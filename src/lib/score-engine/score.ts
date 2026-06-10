import defaultSynonyms from "./synonyms.json";
import { detectSkills } from "./extract";
import type {
  ScoreOptions,
  ScoreResult,
  SkillMatch,
  SkillVocabulary,
} from "./types";

export const defaultVocabulary: SkillVocabulary =
  defaultSynonyms as SkillVocabulary;

/**
 * Score a resume against a job description.
 *
 *   score = round(100 * matched / skills-the-JD-asks-for)
 *
 * HONEST CEILING: a skill the JD requires but the resume does not evidence
 * always lands in `missing` and can never be counted as present. The score
 * therefore cannot exceed what the resume truthfully supports. Refusing to
 * inflate is the feature, not a limitation.
 *
 *        resumeText ─┐
 *                    ├─► detectSkills ─► intersect with JD skills ─► matched / missing
 *   jobDescription ──┘                                                      │
 *                                                                           ▼
 *                                                         score + explainable lists
 */
export function scoreResume(
  resumeText: string,
  jobDescription: string,
  options: ScoreOptions = {},
): ScoreResult {
  const vocabulary = options.vocabulary ?? defaultVocabulary;

  const jdDetected = detectSkills(jobDescription, vocabulary);
  const resumeDetected = detectSkills(resumeText, vocabulary);

  const jdSkills = [...jdDetected.keys()];
  const matched: SkillMatch[] = [];
  const missing: string[] = [];

  for (const skill of jdSkills) {
    const hit = resumeDetected.get(skill);
    if (hit) {
      matched.push({ skill, matchedTerm: hit.term, method: hit.method });
    } else {
      missing.push(skill);
    }
  }

  const score =
    jdSkills.length === 0
      ? 0
      : Math.round((100 * matched.length) / jdSkills.length);

  const explanation =
    jdSkills.length === 0
      ? "No known skills detected in this job description."
      : `Matched ${matched.length} of ${jdSkills.length} skills this job asks for.` +
        (missing.length ? ` Missing: ${missing.join(", ")}.` : "");

  return { score, matched, missing, jdSkills, explanation };
}
