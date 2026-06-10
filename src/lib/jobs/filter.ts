import type { JobPosting } from "../job-sources/types";

/**
 * Pure job-list filtering/sorting helpers for the wizard's Jobs step.
 * Date parsing is defensive: sources emit ISO strings, bare dates, or nothing.
 */

/** Parse a posting date to epoch ms, or null if absent/unparseable. */
export function parsePostedAt(postedAt?: string): number | null {
  if (!postedAt) return null;
  const t = Date.parse(postedAt);
  return Number.isNaN(t) ? null : t;
}

/**
 * Is the posting within the last `days` days?
 * Unknown dates are EXCLUDED when a window is active — "fresh jobs only" must
 * not silently include undated ones.
 */
export function isPostedWithin(postedAt: string | undefined, days: number, now = Date.now()): boolean {
  const t = parsePostedAt(postedAt);
  if (t === null) return false;
  return now - t <= days * 24 * 60 * 60 * 1000;
}

export type PostedWindow = "any" | "day" | "week" | "month";

export const POSTED_WINDOW_DAYS: Record<Exclude<PostedWindow, "any">, number> = {
  day: 1,
  week: 7,
  month: 31,
};

export type JobSortBy = "fit" | "newest";

export interface JobFilterOptions {
  postedWithin: PostedWindow;
  minScore: number;
  sortBy: JobSortBy;
}

/** Filter + sort the pool. `scoreOf` maps externalId → match score (0 if unscored). */
export function filterAndSortJobs(
  jobs: JobPosting[],
  scoreOf: (externalId: string) => number,
  opts: JobFilterOptions,
  now = Date.now(),
): JobPosting[] {
  let out = jobs;

  if (opts.postedWithin !== "any") {
    const days = POSTED_WINDOW_DAYS[opts.postedWithin];
    out = out.filter((j) => isPostedWithin(j.postedAt, days, now));
  }
  if (opts.minScore > 0) {
    out = out.filter((j) => scoreOf(j.externalId) >= opts.minScore);
  }

  return [...out].sort((a, b) => {
    if (opts.sortBy === "newest") {
      const ta = parsePostedAt(a.postedAt) ?? -Infinity; // undated last
      const tb = parsePostedAt(b.postedAt) ?? -Infinity;
      if (tb !== ta) return tb - ta;
      return scoreOf(b.externalId) - scoreOf(a.externalId); // tiebreak by fit
    }
    const diff = scoreOf(b.externalId) - scoreOf(a.externalId);
    if (diff !== 0) return diff;
    return (parsePostedAt(b.postedAt) ?? -Infinity) - (parsePostedAt(a.postedAt) ?? -Infinity);
  });
}
