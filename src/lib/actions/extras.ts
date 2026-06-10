"use server";

import { getFallbackChatProvider } from "@/lib/provider-registry";
import { buildLearningPlanPrompt } from "@/lib/learning/plan";
import {
  fetchCompanySource,
  buildCompanySummaryPrompt,
  noCompanyInfo,
} from "@/lib/research/company";

export type LearningPlanResult =
  | { ok: true; plan: string }
  | { ok: false; reason: "no_provider" }
  | { ok: false; reason: "error"; message: string };

/** Generate a learning plan for the job's missing skills, paced to the user's timeframe. */
export async function learningPlanAction(
  missingSkills: string[],
  jobTitle: string | undefined,
  timeframe: string,
  providerId?: string,
): Promise<LearningPlanResult> {
  const provider = await getFallbackChatProvider(process.env, providerId);
  if (!provider) return { ok: false, reason: "no_provider" };
  try {
    const plan = (
      await provider.complete(buildLearningPlanPrompt(missingSkills, jobTitle, timeframe))
    ).trim();
    return { ok: true, plan };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}

export type CompanyResearchResult =
  | { ok: true; research: string; source: string }
  | { ok: false; reason: "error"; message: string };

/**
 * Honest company research: fetch verified public text, AI summarizes only that;
 * if nothing is found, say so (never invent). Always "ok" — "no info" is a valid
 * honest result, not an error.
 */
export async function companyResearchAction(
  company: string,
  providerId?: string,
): Promise<CompanyResearchResult> {
  try {
    const src = await fetchCompanySource(company);
    if (!src) return { ok: true, research: noCompanyInfo(company), source: "none" };

    const provider = await getFallbackChatProvider(process.env, providerId);
    if (!provider) {
      // No AI — return the raw verified text with attribution.
      return { ok: true, research: `${src.text}\n\n(Source: ${src.source})`, source: src.source };
    }
    try {
      const research = (await provider.complete(buildCompanySummaryPrompt(company, src.text))).trim();
      return { ok: true, research, source: src.source };
    } catch {
      return { ok: true, research: `${src.text}\n\n(Source: ${src.source})`, source: src.source };
    }
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}
