"use server";

import { getFallbackChatProvider } from "@/lib/provider-registry";
import { tailorResume } from "@/lib/tailor-engine";
import type { ScoreResult } from "@/lib/score-engine";

export type TailorActionResult =
  | {
      ok: true;
      providerLabel: string;
      tailoredText: string;
      before: ScoreResult;
      after: ScoreResult;
      addedSkills: string[];
    }
  | { ok: false; reason: "no_provider" }
  | { ok: false; reason: "error"; message: string };

/**
 * Server action: tailor a resume to a JD using whatever AI the user has
 * configured. Runs server-side because provider keys / Ollama live there.
 */
export async function tailorAction(
  resume: string,
  jobDescription: string,
  missingSkills: string[] = [],
  providerId?: string,
): Promise<TailorActionResult> {
  const provider = await getFallbackChatProvider(process.env, providerId);
  if (!provider) return { ok: false, reason: "no_provider" };

  try {
    const r = await tailorResume(resume, jobDescription, provider, { missingSkills });
    return {
      ok: true,
      providerLabel: provider.label,
      tailoredText: r.tailoredText,
      before: r.before,
      after: r.after,
      addedSkills: r.addedSkills,
    };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}
