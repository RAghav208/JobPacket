import { describe, it, expect } from "vitest";
import { parsePostedAt, isPostedWithin, filterAndSortJobs } from "./filter";
import type { JobPosting } from "../job-sources/types";

const NOW = Date.parse("2026-06-10T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();

function job(id: string, postedAt?: string): JobPosting {
  return {
    sourceId: "ats",
    externalId: id,
    title: id,
    company: "Acme",
    location: "India",
    description: "",
    url: "",
    postedAt,
  };
}

describe("parsePostedAt", () => {
  it("parses ISO and bare dates, rejects garbage/absent", () => {
    expect(parsePostedAt("2026-06-01")).not.toBeNull();
    expect(parsePostedAt("2026-06-01T10:00:00Z")).not.toBeNull();
    expect(parsePostedAt("not a date")).toBeNull();
    expect(parsePostedAt(undefined)).toBeNull();
  });
});

describe("isPostedWithin", () => {
  it("includes inside the window, excludes outside", () => {
    expect(isPostedWithin(daysAgo(3), 7, NOW)).toBe(true);
    expect(isPostedWithin(daysAgo(10), 7, NOW)).toBe(false);
  });
  it("excludes unknown dates when a window is active", () => {
    expect(isPostedWithin(undefined, 7, NOW)).toBe(false);
  });
});

describe("filterAndSortJobs", () => {
  const jobs = [job("old", daysAgo(20)), job("fresh", daysAgo(2)), job("undated"), job("mid", daysAgo(5))];
  const scores: Record<string, number> = { old: 90, fresh: 60, undated: 80, mid: 40 };
  const scoreOf = (id: string) => scores[id] ?? 0;

  it("'week' window keeps only fresh+mid (drops old and undated)", () => {
    const out = filterAndSortJobs(jobs, scoreOf, { postedWithin: "week", minScore: 0, sortBy: "fit" }, NOW);
    expect(out.map((j) => j.externalId)).toEqual(["fresh", "mid"]);
  });

  it("minScore filters low matches", () => {
    const out = filterAndSortJobs(jobs, scoreOf, { postedWithin: "any", minScore: 75, sortBy: "fit" }, NOW);
    expect(out.map((j) => j.externalId)).toEqual(["old", "undated"]);
  });

  it("sorts by fit (desc) and by newest with undated last", () => {
    const fit = filterAndSortJobs(jobs, scoreOf, { postedWithin: "any", minScore: 0, sortBy: "fit" }, NOW);
    expect(fit.map((j) => j.externalId)).toEqual(["old", "undated", "fresh", "mid"]);

    const newest = filterAndSortJobs(jobs, scoreOf, { postedWithin: "any", minScore: 0, sortBy: "newest" }, NOW);
    expect(newest.map((j) => j.externalId)).toEqual(["fresh", "mid", "old", "undated"]);
  });
});
