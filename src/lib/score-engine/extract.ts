import type { MatchMethod, SkillVocabulary } from "./types";

/**
 * Skill detection.
 *
 * Scans text for occurrences of known skills (canonical names + their synonyms)
 * using a boundary-aware match so "Java" does NOT match inside "JavaScript" and
 * "C" does NOT match inside "C++".
 *
 *   boundary = NOT flanked by [A-Za-z0-9+#]
 *
 * That single rule is why the deterministic v1 matcher is immune to the
 * Java≈JavaScript over-match problem that the (future) embedding fallback risks.
 */

export interface Detection {
  /** The literal term matched in the text. */
  term: string;
  method: MatchMethod;
}

/** Characters that, if adjacent to a term, mean it is part of a larger token. */
const BOUNDARY = "A-Za-z0-9+#";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a case-insensitive, boundary-aware matcher for one term. */
function termRegExp(term: string): RegExp {
  const e = escapeRegExp(term);
  return new RegExp(`(?<![${BOUNDARY}])${e}(?![${BOUNDARY}])`, "i");
}

/**
 * Detect which canonical skills appear in `text`.
 * Returns canonical-skill -> the first detection (term + method).
 * Each skill is reported at most once; duplicate mentions do not double-count.
 */
export function detectSkills(
  text: string,
  vocabulary: SkillVocabulary,
): Map<string, Detection> {
  const found = new Map<string, Detection>();

  for (const canonical of Object.keys(vocabulary)) {
    if (found.has(canonical)) continue;

    // The canonical name is an "exact" match; synonyms are "synonym" matches.
    const variants: Array<{ term: string; method: MatchMethod }> = [
      { term: canonical, method: "exact" },
      ...(vocabulary[canonical] ?? []).map((syn) => ({
        term: syn,
        method: "synonym" as const,
      })),
    ];

    for (const { term, method } of variants) {
      if (termRegExp(term).test(text)) {
        found.set(canonical, { term, method });
        break;
      }
    }
  }

  return found;
}
