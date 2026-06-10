"use server";

import { getFallbackChatProvider } from "@/lib/provider-registry";
import { extractJdSkillsBatch } from "@/lib/skills/extract-skills";
import { matchSkills } from "@/lib/skills/match";
import { detectSkills, defaultVocabulary } from "@/lib/score-engine";
import { cvHash as textHash } from "@/lib/db/hash";
import { getJdSkillsCached, saveJdSkillsCached } from "@/lib/db/jd-cache";
import { asyncPool, chunk } from "@/lib/util/pool";

export interface JobToScore {
  id: string;
  description: string;
}

export interface ScoredJob {
  id: string;
  score: number;
  matched: string[];
  missing: string[];
}

export interface ScoreJobsResult {
  source: "ai" | "rules";
  scored: ScoredJob[];
}

/** JDs per AI call — keeps each batched prompt small enough to stay accurate. */
const CHUNK_SIZE = 15;
/** Max concurrent AI calls (each CLI-agent call is a separate process). */
const CONCURRENCY = 3;

/**
 * Score ALL given jobs against the CV's skills, ranked best-fit first.
 *
 * Speed model:
 *  1. CACHE — JD skills are cached in SQLite by description hash, so a JD is
 *     extracted by AI at most ONCE ever. Repeat searches skip AI entirely.
 *  2. PARALLEL — uncached JDs go to the AI in CHUNK_SIZE batches, up to
 *     CONCURRENCY at a time (not sequentially).
 *  3. Matching stays deterministic (matchSkills) — honest and instant.
 * A failed chunk (or no agent) falls back to keyword detection for those jobs.
 */
export async function scoreJobsAction(
  cvSkills: string[],
  jobs: JobToScore[],
  providerId?: string,
): Promise<ScoreJobsResult> {
  if (jobs.length === 0) return { source: "rules", scored: [] };

  const keywordSkills = (j: JobToScore) => [
    ...detectSkills(j.description, defaultVocabulary).keys(),
  ];

  const lists: string[][] = new Array(jobs.length);
  let usedAi = false;

  // 1) Cache pass — collect indexes that still need extraction.
  const uncached: number[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const desc = jobs[i]!.description;
    const cached = desc.trim() ? getJdSkillsCached(textHash(desc)) : null;
    if (cached) {
      lists[i] = cached;
      usedAi = true; // cache only ever holds AI extractions
    } else {
      uncached.push(i);
    }
  }

  // 2) AI pass on uncached JDs — chunked, in parallel.
  const provider = uncached.length
    ? await getFallbackChatProvider(process.env, providerId)
    : null;

  if (provider && uncached.length) {
    const chunks = chunk(uncached, CHUNK_SIZE);
    await asyncPool(CONCURRENCY, chunks, async (idxs) => {
      try {
        const out = await extractJdSkillsBatch(
          idxs.map((i) => jobs[i]!.description),
          provider,
        );
        idxs.forEach((jobIdx, k) => {
          const skills = out[k] ?? [];
          lists[jobIdx] = skills;
          const desc = jobs[jobIdx]!.description;
          if (desc.trim() && skills.length) saveJdSkillsCached(textHash(desc), skills);
        });
        usedAi = true;
      } catch {
        for (const jobIdx of idxs) lists[jobIdx] = keywordSkills(jobs[jobIdx]!);
      }
    });
  } else {
    for (const jobIdx of uncached) lists[jobIdx] = keywordSkills(jobs[jobIdx]!);
  }

  // 3) Deterministic match + rank.
  const scored = jobs
    .map((j, i) => {
      const r = matchSkills(cvSkills, lists[i] ?? []);
      return {
        id: j.id,
        score: r.score,
        matched: r.matched.map((m) => m.skill),
        missing: r.missing,
      };
    })
    .sort((a, b) => b.score - a.score);

  return { source: usedAi ? "ai" : "rules", scored };
}
