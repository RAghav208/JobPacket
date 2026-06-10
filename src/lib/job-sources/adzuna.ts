import type { JobPosting, JobSource, SearchParams } from "./types";

/**
 * Adzuna job source — a stable aggregator API with broad India coverage.
 * Pure TypeScript fetch (no Python), returns the JD per job, doesn't break on
 * HTML changes. Needs a free app_id + app_key from adzuna.com/developer, set as
 * ADZUNA_APP_ID / ADZUNA_APP_KEY. Unavailable (gracefully) without them.
 */

export function mapAdzunaJob(raw: Record<string, unknown>): JobPosting {
  const company = raw["company"] as { display_name?: string } | undefined;
  const loc = raw["location"] as { display_name?: string } | undefined;
  return {
    sourceId: "adzuna",
    externalId: String(raw["id"] ?? raw["redirect_url"] ?? ""),
    title: String(raw["title"] ?? ""),
    company: company?.display_name ?? "",
    location: loc?.display_name ?? "",
    description: String(raw["description"] ?? ""),
    url: String(raw["redirect_url"] ?? ""),
    postedAt: raw["created"] ? String(raw["created"]) : undefined,
  };
}

export function createAdzunaSource(
  env: Record<string, string | undefined> = process.env,
): JobSource {
  const appId = () => env.ADZUNA_APP_ID;
  const appKey = () => env.ADZUNA_APP_KEY;

  return {
    id: "adzuna",
    label: "Adzuna (India)",
    requiresPython: false,
    async isAvailable() {
      return Boolean(appId() && appKey());
    },
    async search(params: SearchParams): Promise<JobPosting[]> {
      const id = appId();
      const key = appKey();
      if (!id || !key) {
        throw new Error(
          "Adzuna needs a free API key. Set ADZUNA_APP_ID and ADZUNA_APP_KEY (from adzuna.com/developer).",
        );
      }
      const limit = params.limit ?? 20;
      const url =
        `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${encodeURIComponent(id)}` +
        `&app_key=${encodeURIComponent(key)}&results_per_page=${limit}` +
        `&what=${encodeURIComponent(params.query)}` +
        (params.location ? `&where=${encodeURIComponent(params.location)}` : "") +
        `&content-type=application/json`;

      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`Adzuna request failed: HTTP ${res.status}`);
      const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
      return (data.results ?? []).map(mapAdzunaJob);
    },
  };
}
