import type { ChatMessage, ChatProvider } from "../provider-registry/types";

/**
 * AI skill extraction — pull an explicit skill list from a CV or a job description.
 *
 * The model only EXTRACTS (lists what's there); it never scores. Scoring is done
 * deterministically in match.ts against these lists, so the honest ceiling holds.
 * Prompt builder + parser are pure and tested; extractSkills touches the provider.
 */

export function buildSkillPrompt(text: string, kind: "cv" | "jd" = "cv"): ChatMessage[] {
  const what =
    kind === "cv"
      ? "the candidate explicitly demonstrates or lists in this resume"
      : "this job description explicitly requires or asks for";

  const system = [
    "You extract technical and professional skills from text.",
    `List ONLY skills ${what}. Never infer or add skills that aren't clearly supported.`,
    "Use standard, canonical names (e.g. 'JavaScript' not 'JS', 'scikit-learn' not 'sklearn').",
    "Include languages, frameworks, libraries, tools, platforms, and well-defined methods.",
    "Exclude vague soft phrases like 'hard worker' or 'team player'.",
    'Return ONLY a JSON array of strings. Example: ["Python", "SQL", "Machine Learning"]',
  ].join("\n");

  const user = `${kind === "cv" ? "RESUME" : "JOB DESCRIPTION"}:\n${text.trim()}\n\nReturn the skills as a JSON array.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Tolerant parser: JSON array, or bullet/numbered lines. Dedupes, trims, caps. */
export function parseSkillList(raw: string, max = 40): string[] {
  let items: string[] = [];

  const arr = raw.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      const parsed = JSON.parse(arr[0]);
      if (Array.isArray(parsed)) items = parsed.map((x) => String(x));
    } catch {
      /* fall through */
    }
  }
  if (items.length === 0) {
    items = raw.split(/\r?\n/).map((l) =>
      l.replace(/^[\s\-*•\d.)]+/, "").replace(/^["']+|["',]+$/g, "").trim(),
    );
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const t = item.trim();
    if (!t || t.length > 50) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export async function extractSkills(
  text: string,
  provider: ChatProvider,
  kind: "cv" | "jd" = "cv",
): Promise<string[]> {
  return parseSkillList(await provider.complete(buildSkillPrompt(text, kind)));
}

// ── Batched JD extraction (score many jobs in ONE call) ───────────────────────

/** One prompt that asks for required skills of every job, as an array-of-arrays. */
export function buildBatchSkillPrompt(jds: string[], maxCharsPerJd = 1500): ChatMessage[] {
  const system = [
    "You extract the REQUIRED skills from job descriptions.",
    "For each numbered job, list the skills it explicitly requires (languages, frameworks,",
    "libraries, tools, platforms, methods). Use canonical names. Never invent requirements.",
    "Return ONLY a JSON array of arrays — element i is the skills for JOB i, in order.",
    'Example: [["Python","SQL"],["React","TypeScript"]]',
  ].join("\n");

  const body = jds
    .map((d, i) => `JOB ${i}:\n${(d || "").trim().slice(0, maxCharsPerJd)}`)
    .join("\n\n");

  return [
    { role: "system", content: system },
    { role: "user", content: body },
  ];
}

/** Parse an array-of-arrays response into exactly `count` skill lists. */
export function parseBatchSkills(raw: string, count: number): string[][] {
  let parsed: unknown = null;
  const arr = raw.match(/\[[\s\S]*\]/);
  try {
    parsed = JSON.parse(arr ? arr[0] : raw);
  } catch {
    parsed = null;
  }

  const result: string[][] = [];
  for (let i = 0; i < count; i++) {
    const item = Array.isArray(parsed) ? (parsed as unknown[])[i] : undefined;
    result.push(
      Array.isArray(item)
        ? item.map((x) => String(x).trim()).filter((s) => s.length > 0 && s.length <= 50)
        : [],
    );
  }
  return result;
}

export async function extractJdSkillsBatch(
  jds: string[],
  provider: ChatProvider,
): Promise<string[][]> {
  if (jds.length === 0) return [];
  const raw = await provider.complete(buildBatchSkillPrompt(jds));
  return parseBatchSkills(raw, jds.length);
}
