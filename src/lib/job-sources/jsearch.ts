import type { JobPosting, JobSource, SearchParams } from "./types";

/**
 * JSearch job source (RapidAPI) — aggregates Google for Jobs, which indexes
 * LinkedIn, Indeed, and many India job boards. Stable API, full JDs, pure TS
 * (no Python, no scraping). Needs a free RapidAPI key set as RAPIDAPI_KEY
 * (rapidapi.com → subscribe to "JSearch", free tier). Unavailable without it.
 */

export function mapJSearchJob(raw: Record<string, unknown>): JobPosting {
  const loc = [raw["job_city"], raw["job_state"], raw["job_country"]]
    .map((x) => (x == null ? "" : String(x)))
    .filter(Boolean)
    .join(", ");
  const url = String(raw["job_apply_link"] ?? "");
  return {
    sourceId: "jsearch",
    externalId: String(raw["job_id"] ?? url),
    title: String(raw["job_title"] ?? ""),
    company: String(raw["employer_name"] ?? ""),
    location: loc,
    description: String(raw["job_description"] ?? ""),
    url,
    postedAt: raw["job_posted_at_datetime_utc"]
      ? String(raw["job_posted_at_datetime_utc"])
      : undefined,
  };
}

export function createJSearchSource(
  env: Record<string, string | undefined> = process.env,
): JobSource {
  const key = () => env.RAPIDAPI_KEY;

  return {
    id: "jsearch",
    label: "JSearch (LinkedIn/Indeed via Google)",
    requiresPython: false,
    async isAvailable() {
      return Boolean(key());
    },
    async search(params: SearchParams): Promise<JobPosting[]> {
      const k = key();
      if (!k) {
        throw new Error(
          "JSearch needs a free RapidAPI key. Set RAPIDAPI_KEY (rapidapi.com → subscribe to JSearch).",
        );
      }
      const location = params.location || "India";
      const query = `${params.query} in ${location}`;
      const url =
        `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}` +
        `&page=1&num_pages=1&country=in`;

      const res = await fetch(url, {
        headers: { "X-RapidAPI-Key": k, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
      });
      if (!res.ok) throw new Error(`JSearch request failed: HTTP ${res.status}`);
      const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
      return (data.data ?? []).slice(0, params.limit ?? 20).map(mapJSearchJob);
    },
  };
}
