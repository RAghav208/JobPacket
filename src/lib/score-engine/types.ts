/**
 * Score engine public types.
 *
 * The engine is a PURE module: no Next.js, no DB, no LLM, no network.
 * Input is two strings; output is a fully explainable score object.
 * This is the core IP and the most heavily tested part of JobPacket.
 */

/** How a required skill was matched against the resume. */
export type MatchMethod = "exact" | "synonym" | "embedding";

/** A single skill the job asks for that WAS found on the resume. */
export interface SkillMatch {
  /** Canonical skill name as declared in the vocabulary, e.g. "JavaScript". */
  skill: string;
  /** The literal term found in the resume, e.g. "JS". */
  matchedTerm: string;
  /** Why it counted as a match. "exact" = same word; "synonym" = alias from the map. */
  method: MatchMethod;
}

/**
 * canonical skill name -> list of lower-cased synonyms.
 * The canonical name itself is always matchable; synonyms are extra aliases.
 */
export type SkillVocabulary = Record<string, string[]>;

export interface ScoreOptions {
  /** Override the default skill vocabulary (e.g. a role-specific or India-tuned set). */
  vocabulary?: SkillVocabulary;
}

/**
 * The explainable result. The matched/missing lists are MANDATORY output —
 * the number alone never ships without them. That explainability is the
 * trust mechanism validated during dogfooding.
 */
export interface ScoreResult {
  /** 0-100. matched / total-skills-the-JD-asks-for, rounded. */
  score: number;
  /** Skills the JD asks for that the resume evidences. */
  matched: SkillMatch[];
  /** Skills the JD asks for that the resume does NOT evidence. Honest, never inflated. */
  missing: string[];
  /** Every canonical skill detected in the job description. */
  jdSkills: string[];
  /** One-line human-readable summary. */
  explanation: string;
}
