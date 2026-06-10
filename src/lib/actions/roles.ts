"use server";

import { getFallbackChatProvider } from "@/lib/provider-registry";
import { buildRolePrompt, parseRoles } from "@/lib/roles/extract-ai";
import { suggestRoles } from "@/lib/roles/roles";

export interface RoleSuggestion {
  role: string;
  /** Supporting skills (rule-based only); empty for AI suggestions. */
  matched: string[];
}

export interface RoleSuggestResult {
  source: "ai" | "rules";
  /** Which agent produced the AI suggestions (for display). */
  providerLabel?: string;
  roles: RoleSuggestion[];
}

/**
 * Suggest roles from a CV.
 * Uses an installed AI agent (Claude/Codex/Gemini CLI) or API key when available,
 * falling back to the deterministic skill-based suggester otherwise.
 * `providerId` lets the UI pin a specific agent; omit for auto + fall-through.
 */
export async function suggestRolesAction(
  cv: string,
  providerId?: string,
): Promise<RoleSuggestResult> {
  const provider = await getFallbackChatProvider(process.env, providerId);
  if (provider) {
    try {
      const raw = await provider.complete(buildRolePrompt(cv));
      const roles = parseRoles(raw);
      if (roles.length > 0) {
        return {
          source: "ai",
          providerLabel: provider.label,
          roles: roles.map((role) => ({ role, matched: [] })),
        };
      }
    } catch {
      /* fall through to rule-based */
    }
  }
  return { source: "rules", roles: suggestRoles(cv) };
}
