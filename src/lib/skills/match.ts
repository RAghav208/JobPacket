import synonyms from "../score-engine/synonyms.json";
import type { ScoreResult, SkillMatch } from "../score-engine/types";

/**
 * Deterministic skill matching between two explicit skill lists (AI-extracted).
 *
 * This is what keeps scoring honest and reproducible even though extraction is
 * AI-driven: matching is pure string logic. A required skill the CV doesn't have
 * is always "missing" — the score can never exceed what the CV list supports.
 *
 * synonyms.json is reused here ONLY to normalize aliases (JS → JavaScript), not
 * as the universe of skills. The universe comes from the AI extraction.
 */

const ALIAS_TO_CANON = new Map<string, string>();
for (const [canon, syns] of Object.entries(synonyms as Record<string, string[]>)) {
  ALIAS_TO_CANON.set(canon.toLowerCase(), canon);
  for (const s of syns) ALIAS_TO_CANON.set(String(s).toLowerCase(), canon);
}

/** Map a free-form skill string to a canonical display name (alias-aware). */
export function normalizeSkill(s: string): string {
  const key = s.trim().toLowerCase();
  return ALIAS_TO_CANON.get(key) ?? s.trim();
}

export function matchSkills(cvSkills: string[], jdSkills: string[]): ScoreResult {
  const cv = new Map<string, string>(); // normalizedLower -> canonical display
  for (const s of cvSkills) {
    const n = normalizeSkill(s);
    if (n) cv.set(n.toLowerCase(), n);
  }

  const matched: SkillMatch[] = [];
  const missing: string[] = [];
  const jdCanon: string[] = [];
  const seen = new Set<string>();

  for (const j of jdSkills) {
    const n = normalizeSkill(j);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    jdCanon.push(n);

    const hit = cv.get(key);
    if (hit) matched.push({ skill: n, matchedTerm: hit, method: "exact" });
    else missing.push(n);
  }

  const total = matched.length + missing.length;
  const score = total === 0 ? 0 : Math.round((100 * matched.length) / total);
  const explanation =
    total === 0
      ? "No skills detected in the job description."
      : `Matched ${matched.length} of ${total} skills this job asks for.` +
        (missing.length ? ` Missing: ${missing.join(", ")}.` : "");

  return { score, matched, missing, jdSkills: jdCanon, explanation };
}
