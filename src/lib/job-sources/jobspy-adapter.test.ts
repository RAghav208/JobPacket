import { describe, it, expect } from "vitest";
import {
  buildRunnerArgs,
  parseJobSpyOutput,
  createJobSpySource,
} from "./jobspy-adapter";

describe("buildRunnerArgs", () => {
  it("builds minimal args with a default limit", () => {
    const args = buildRunnerArgs("/r.py", "naukri", { query: "data analyst" });
    expect(args).toEqual([
      "/r.py",
      "--site",
      "naukri",
      "--query",
      "data analyst",
      "--limit",
      "20",
    ]);
  });

  it("includes location and a custom limit when provided", () => {
    const args = buildRunnerArgs("/r.py", "linkedin", {
      query: "ml engineer",
      location: "Bengaluru",
      limit: 5,
    });
    expect(args).toContain("--location");
    expect(args).toContain("Bengaluru");
    expect(args.at(-1)).toBe("5");
  });

  it("does not inject a location flag when none is given", () => {
    const args = buildRunnerArgs("/r.py", "indeed", { query: "qa" });
    expect(args).not.toContain("--location");
  });
});

describe("parseJobSpyOutput", () => {
  it("maps JobSpy rows into JobPosting shape", () => {
    const stdout = JSON.stringify([
      {
        title: "Data Analyst",
        company: "Acme",
        location: "Bengaluru",
        description: "SQL and Python required.",
        job_url: "https://naukri.com/job/123",
        date_posted: "2026-06-01",
      },
    ]);
    const [job] = parseJobSpyOutput(stdout, "naukri");
    expect(job).toMatchObject({
      sourceId: "naukri",
      externalId: "https://naukri.com/job/123",
      title: "Data Analyst",
      company: "Acme",
      url: "https://naukri.com/job/123",
      postedAt: "2026-06-01",
    });
  });

  it("falls back to a synthetic externalId when job_url is missing", () => {
    const stdout = JSON.stringify([{ title: "X", company: "Y", location: "Z", description: "" }]);
    const [job] = parseJobSpyOutput(stdout, "indeed");
    expect(job?.externalId).toBe("indeed-0");
  });

  it("coerces nulls to empty strings and handles an empty array", () => {
    expect(parseJobSpyOutput("[]", "naukri")).toEqual([]);
    const [job] = parseJobSpyOutput(
      JSON.stringify([{ title: null, company: null, location: null, description: null, job_url: null }]),
      "naukri",
    );
    expect(job?.title).toBe("");
  });
});

describe("createJobSpySource", () => {
  it("produces a JobSource that declares its Python dependency", () => {
    const src = createJobSpySource("naukri", "Naukri");
    expect(src.id).toBe("naukri");
    expect(src.label).toBe("Naukri");
    expect(src.requiresPython).toBe(true);
    expect(typeof src.search).toBe("function");
    expect(typeof src.isAvailable).toBe("function");
  });
});
