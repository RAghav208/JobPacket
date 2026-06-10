import companiesData from "./ats-companies.json";
import type { JobPosting, JobSource, SearchParams } from "./types";

/**
 * ATS job source — reads the PUBLIC JSON APIs of hiring platforms (Greenhouse,
 * Lever, Ashby) directly. These are stable API contracts, not scraped HTML, so
 * they don't break, need no key, no Python, and return the full JD.
 *
 * It queries a curated list of company boards (ats-companies.json, PR-friendly)
 * and filters postings by the user's role keywords. Coverage = companies on
 * those platforms (lots of tech/startups). One company's board failing never
 * breaks the rest (Promise.allSettled).
 */

interface AtsCompany {
  name: string;
  provider: "greenhouse" | "lever" | "ashby";
  token: string;
}

export const ATS_COMPANIES = companiesData as AtsCompany[];

/** Strip HTML to readable text (Greenhouse/Ashby return JD as HTML). Pure. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Does the posting's TITLE match the role query? (Title-only = relevant; body match pulled in noise.) Pure. */
export function matchesQuery(job: Pick<JobPosting, "title">, query: string): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const title = job.title.toLowerCase();
  return words.every((w) => title.includes(w));
}

/**
 * Keep jobs in the wanted location, plus globally-remote and unknown-location
 * roles. Region-locked remote elsewhere (e.g. "Remote - US" for an India search)
 * is dropped as noise. Pure.
 */
export function matchesLocation(jobLocation: string, wanted?: string): boolean {
  if (!wanted) return true;
  const loc = jobLocation.toLowerCase().trim();
  if (!loc) return true; // unknown — don't exclude

  const words = wanted.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.some((w) => loc.includes(w))) return true; // wanted region/city present

  // Truly global remote (not pinned to another country) is fine.
  if (/^remote$/.test(loc)) return true;
  if (/\bremote\b/.test(loc) && /(global|anywhere|worldwide)/.test(loc)) return true;

  return false;
}

// ── Pure mappers (unit-tested) ────────────────────────────────────────────────

export function mapGreenhouseJob(raw: Record<string, unknown>, company: string): JobPosting {
  const loc = raw["location"] as { name?: string } | undefined;
  const url = String(raw["absolute_url"] ?? "");
  return {
    sourceId: "ats",
    externalId: url || `greenhouse-${String(raw["id"] ?? "")}`,
    title: String(raw["title"] ?? ""),
    company: String(raw["company_name"] ?? company),
    location: loc?.name ?? "",
    description: stripHtml(String(raw["content"] ?? "")),
    url,
    postedAt: raw["updated_at"] ? String(raw["updated_at"]) : undefined,
  };
}

export function mapLeverJob(raw: Record<string, unknown>, company: string): JobPosting {
  const cats = raw["categories"] as { location?: string } | undefined;
  const url = String(raw["hostedUrl"] ?? "");
  const descHtml = String(raw["description"] ?? "");
  return {
    sourceId: "ats",
    externalId: url || `lever-${String(raw["id"] ?? "")}`,
    title: String(raw["text"] ?? ""),
    company,
    location: cats?.location ?? "",
    description: String(raw["descriptionPlain"] ?? "") || stripHtml(descHtml),
    url,
    postedAt: raw["createdAt"] ? new Date(Number(raw["createdAt"])).toISOString() : undefined,
  };
}

export function mapAshbyJob(raw: Record<string, unknown>, company: string): JobPosting {
  const url = String(raw["jobUrl"] ?? raw["applyUrl"] ?? "");
  return {
    sourceId: "ats",
    externalId: url || `ashby-${String(raw["id"] ?? "")}`,
    title: String(raw["title"] ?? ""),
    company,
    location: String(raw["location"] ?? ""),
    description:
      String(raw["descriptionPlain"] ?? "") || stripHtml(String(raw["descriptionHtml"] ?? "")),
    url,
    postedAt: raw["publishedAt"] ? String(raw["publishedAt"]) : undefined,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchCompany(c: AtsCompany): Promise<JobPosting[]> {
  if (c.provider === "greenhouse") {
    const data = (await fetchJson(
      `https://boards-api.greenhouse.io/v1/boards/${c.token}/jobs?content=true`,
    )) as { jobs?: Array<Record<string, unknown>> };
    return (data.jobs ?? []).map((j) => mapGreenhouseJob(j, c.name));
  }
  if (c.provider === "lever") {
    const data = (await fetchJson(
      `https://api.lever.co/v0/postings/${c.token}?mode=json`,
    )) as Array<Record<string, unknown>>;
    return (Array.isArray(data) ? data : []).map((j) => mapLeverJob(j, c.name));
  }
  // ashby
  const data = (await fetchJson(
    `https://api.ashbyhq.com/posting-api/job-board/${c.token}`,
  )) as { jobs?: Array<Record<string, unknown>> };
  return (data.jobs ?? []).map((j) => mapAshbyJob(j, c.name));
}

export function createAtsSource(): JobSource {
  return {
    id: "ats",
    label: "Company boards (ATS)",
    requiresPython: false,
    async isAvailable() {
      return true; // pure HTTP to public APIs
    },
    async search(params: SearchParams): Promise<JobPosting[]> {
      const limit = params.limit ?? 20;
      const settled = await Promise.allSettled(ATS_COMPANIES.map((c) => fetchCompany(c)));
      const all: JobPosting[] = [];
      for (const r of settled) if (r.status === "fulfilled") all.push(...r.value);

      const matched = all.filter(
        (j) => matchesQuery(j, params.query) && matchesLocation(j.location, params.location),
      );

      // Interleave across companies so one big board (e.g. Stripe) doesn't crowd out the rest.
      const byCompany = new Map<string, JobPosting[]>();
      for (const j of matched) {
        const list = byCompany.get(j.company) ?? [];
        list.push(j);
        byCompany.set(j.company, list);
      }
      const out: JobPosting[] = [];
      let progressed = true;
      while (out.length < limit && progressed) {
        progressed = false;
        for (const list of byCompany.values()) {
          const next = list.shift();
          if (next) {
            out.push(next);
            progressed = true;
            if (out.length >= limit) break;
          }
        }
      }
      return out;
    },
  };
}
