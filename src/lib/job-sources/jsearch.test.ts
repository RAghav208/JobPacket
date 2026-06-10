import { describe, it, expect } from "vitest";
import { mapJSearchJob, createJSearchSource } from "./jsearch";

describe("mapJSearchJob", () => {
  it("maps a JSearch result with composed location", () => {
    const job = mapJSearchJob({
      job_id: "abc",
      job_title: "Data Analyst",
      employer_name: "Acme",
      job_city: "Bengaluru",
      job_state: "Karnataka",
      job_country: "IN",
      job_description: "SQL, Python, dashboards.",
      job_apply_link: "https://x/abc",
      job_posted_at_datetime_utc: "2026-06-02T00:00:00Z",
    });
    expect(job).toMatchObject({
      sourceId: "jsearch",
      externalId: "abc",
      title: "Data Analyst",
      company: "Acme",
      location: "Bengaluru, Karnataka, IN",
      description: "SQL, Python, dashboards.",
      url: "https://x/abc",
    });
  });
});

describe("createJSearchSource", () => {
  it("is unavailable without a key and throws a helpful error on search", async () => {
    const src = createJSearchSource({});
    expect(await src.isAvailable()).toBe(false);
    await expect(src.search({ query: "x" })).rejects.toThrow(/RapidAPI key/i);
  });

  it("is available when RAPIDAPI_KEY is set", async () => {
    const src = createJSearchSource({ RAPIDAPI_KEY: "k" });
    expect(await src.isAvailable()).toBe(true);
  });
});
