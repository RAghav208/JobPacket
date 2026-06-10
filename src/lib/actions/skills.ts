"use server";

import { getFallbackChatProvider } from "@/lib/provider-registry";
import { extractSkills } from "@/lib/skills/extract-skills";
import { detectSkills, defaultVocabulary } from "@/lib/score-engine";

export interface SkillExtractResult {
  source: "ai" | "rules";
  providerLabel?: string;
  skills: string[];
}

/**
 * Extract the CV's skills. Uses an installed AI agent (accurate, current) when
 * available, else the small deterministic detector as a fallback.
 */
export async function extractCvSkillsAction(
  cv: string,
  providerId?: string,
): Promise<SkillExtractResult> {
  const provider = await getFallbackChatProvider(process.env, providerId);
  if (provider) {
    try {
      const skills = await extractSkills(cv, provider, "cv");
      if (skills.length > 0) {
        return { source: "ai", providerLabel: provider.label, skills };
      }
    } catch {
      /* fall through to rule-based */
    }
  }
  return { source: "rules", skills: [...detectSkills(cv, defaultVocabulary).keys()] };
}
