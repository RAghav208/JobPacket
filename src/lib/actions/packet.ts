"use server";

import { getFallbackChatProvider } from "@/lib/provider-registry";
import { buildPacket, buildCoverLetterPrompt, type JobPacket } from "@/lib/packet";
import {
  cvHash,
  getPacket,
  savePacket,
  listPackets,
  type PacketRecord,
} from "@/lib/db/packets";
import type { JobPosting } from "@/lib/job-sources/types";

export type BuildPacketResult =
  | { ok: true; providerLabel: string; packet: JobPacket }
  | { ok: false; reason: "no_provider" }
  | { ok: false; reason: "error"; message: string };

/**
 * Build the application packet for one approved job: tailored resume + cover
 * letter (gap comes from the Stage-3 score already shown). Uses the user's
 * configured AI agent.
 */
export async function buildPacketAction(
  cv: string,
  job: JobPosting,
  providerId?: string,
): Promise<BuildPacketResult> {
  const provider = await getFallbackChatProvider(process.env, providerId);
  if (!provider) return { ok: false, reason: "no_provider" };

  try {
    const packet = await buildPacket(cv, job, provider);
    return { ok: true, providerLabel: provider.label, packet };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}

export type CoverLetterResult =
  | { ok: true; coverLetter: string }
  | { ok: false; reason: "no_provider" }
  | { ok: false; reason: "error"; message: string };

/** Cover letter only — separate action so the UI can show it as its own step. */
export async function coverLetterAction(
  cv: string,
  job: JobPosting,
  providerId?: string,
): Promise<CoverLetterResult> {
  const provider = await getFallbackChatProvider(process.env, providerId);
  if (!provider) return { ok: false, reason: "no_provider" };
  try {
    const coverLetter = (await provider.complete(buildCoverLetterPrompt(cv, job))).trim();
    return { ok: true, coverLetter };
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

/** Return the saved packet for this CV+job, or null (the cache check before building). */
export async function getSavedPacketAction(
  cv: string,
  job: JobPosting,
): Promise<PacketRecord | null> {
  return getPacket(cvHash(cv), job.externalId);
}

export interface SavePacketActionInput {
  job: JobPosting;
  score: number | null;
  matched: string[];
  missing: string[];
  tailoredResume: string;
  coverLetter: string;
  addedSkills: string[];
  learningPlan?: string;
  companyResearch?: string;
}

/** Persist a built packet so it's never regenerated and can be viewed anytime. */
export async function savePacketAction(cv: string, input: SavePacketActionInput): Promise<void> {
  savePacket({ cvHash: cvHash(cv), jobId: input.job.externalId, ...input });
}

/** All saved packets, newest first (for the "My Packets" history). */
export async function listPacketsAction(): Promise<PacketRecord[]> {
  return listPackets();
}

/** Of the given job ids, which already have a saved packet for this CV. */
export async function builtJobIdsAction(cv: string, jobIds: string[]): Promise<string[]> {
  const h = cvHash(cv);
  return jobIds.filter((id) => getPacket(h, id) !== null);
}
