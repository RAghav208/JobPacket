import type { ChatMessage } from "../provider-registry/types";

/**
 * Honest company research: fetch real public text (Wikipedia, then DuckDuckGo),
 * and have the AI summarize ONLY that. No source text → we say so rather than
 * letting the model invent facts (most small Indian companies aren't in these
 * sources, and that's the honest answer). No API key, stable, doesn't break.
 */

export interface CompanySource {
  text: string;
  source: string;
}

/** Fetch verified public text about a company. Never throws; returns null if nothing found. */
export async function fetchCompanySource(company: string): Promise<CompanySource | null> {
  const name = company.trim();
  if (!name) return null;

  // 1) Wikipedia REST summary.
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const j = (await res.json()) as { extract?: string; type?: string };
      if (j.extract && j.type !== "disambiguation" && j.extract.trim().length > 40) {
        return { text: j.extract.trim(), source: "Wikipedia" };
      }
    }
  } catch {
    /* ignore, try next */
  }

  // 2) DuckDuckGo Instant Answer.
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(name + " company")}&format=json&no_html=1&skip_disambig=1`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const j = (await res.json()) as { AbstractText?: string };
      if (j.AbstractText && j.AbstractText.trim().length > 40) {
        return { text: j.AbstractText.trim(), source: "DuckDuckGo" };
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** Prompt to summarize ONLY the fetched source text for a job applicant. Pure. */
export function buildCompanySummaryPrompt(company: string, sourceText: string): ChatMessage[] {
  const system = [
    "You brief a job applicant on a company using ONLY the provided source text.",
    "Never add facts that aren't in the source. If the source is thin, say what's known",
    "and note the rest should be verified on the company's site/LinkedIn.",
    "4-6 sentences: what they do, size/stage if stated, and anything useful to know before",
    "an interview. Plain, factual, no hype.",
  ].join("\n");

  const user = `COMPANY: ${company}\n\nVERIFIED SOURCE TEXT:\n${sourceText}\n\nWrite the brief.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export const noCompanyInfo = (company: string): string =>
  `No verified public information was found for ${company} in open sources. ` +
  `Check their official website and LinkedIn directly before your interview.`;
