import type { ChatMessage, ChatProvider } from "../provider-registry/types";

/**
 * AI role extraction: read the whole CV and suggest job-search titles.
 *
 * The prompt builder and the (robust) output parser are pure and tested; only
 * extractRolesAI touches the provider. Callers fall back to the rule-based
 * `suggestRoles` when no provider is configured or this returns nothing.
 */

export function buildRolePrompt(cv: string): ChatMessage[] {
  const system = [
    "You suggest job-search role titles for a candidate based on their CV.",
    "Return 3 to 6 realistic, specific job titles they should search for on Indian job",
    "boards (Naukri, LinkedIn). Use standard market titles people actually search.",
    'Return ONLY a JSON array of strings. Example: ["Data Analyst", "Business Analyst"]',
    "No commentary, no markdown.",
  ].join("\n");

  const user = `CANDIDATE CV:\n${cv.trim()}\n\nSuggest the job titles as a JSON array.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Parse role titles from a model response. Tolerant of JSON arrays, bullets, or plain lines. */
export function parseRoles(raw: string, max = 6): string[] {
  let items: string[] = [];

  const arr = raw.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      const parsed = JSON.parse(arr[0]);
      if (Array.isArray(parsed)) items = parsed.map((x) => String(x));
    } catch {
      /* not valid JSON — fall through to line parsing */
    }
  }
  if (items.length === 0) {
    items = raw.split(/\r?\n/).map((l) =>
      l
        .replace(/^[\s\-*•\d.)]+/, "") // leading bullets / numbering
        .replace(/^["']+|["',]+$/g, "") // wrapping quotes / trailing commas
        .trim(),
    );
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const t = item.trim();
    if (!t || t.length > 60) continue; // titles are short; drop stray sentences
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export async function extractRolesAI(cv: string, provider: ChatProvider): Promise<string[]> {
  const raw = await provider.complete(buildRolePrompt(cv));
  return parseRoles(raw);
}
