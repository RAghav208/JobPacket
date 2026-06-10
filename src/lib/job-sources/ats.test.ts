import { describe, it, expect } from "vitest";
import { stripHtml, matchesQuery, matchesLocation, mapGreenhouseJob, mapLeverJob } from "./ats";
import { mapAdzunaJob } from "./adzuna";

describe("stripHtml", () => {
  it("removes tags and decodes basic entities", () => {
    expect(stripHtml("<p>Python &amp; SQL</p><br/>Remote")).toBe("Python & SQL Remote");
  });
  it("drops script/style blocks", () => {
    expect(stripHtml("<style>x{}</style>Hi<script>bad()</script> there")).toBe("Hi there");
  });
});

describe("matchesQuery", () => {
  const job = { title: "Senior Data Scientist" };
  it("matches when all query words are in the title", () => {
    expect(matchesQuery(job, "data scientist")).toBe(true);
  });
  it("does NOT match on body-only terms (title-only, avoids noise)", () => {
    expect(matchesQuery(job, "python sql")).toBe(false);
  });
  it("rejects when a title word is absent", () => {
    expect(matchesQuery(job, "frontend react")).toBe(false);
  });
  it("empty query matches everything", () => {
    expect(matchesQuery(job, "")).toBe(true);
  });
});

describe("matchesLocation", () => {
  it("no wanted location → keep everything", () => {
    expect(matchesLocation("San Francisco, CA")).toBe(true);
  });
  it("keeps the wanted region, global-remote, and unknown locations", () => {
    expect(matchesLocation("Bengaluru, India", "India")).toBe(true);
    expect(matchesLocation("Remote", "India")).toBe(true);
    expect(matchesLocation("Remote - Global", "India")).toBe(true);
    expect(matchesLocation("", "India")).toBe(true);
  });
  it("drops region-locked-elsewhere and clearly different locations", () => {
    expect(matchesLocation("Remote - US", "India")).toBe(false);
    expect(matchesLocation("San Francisco, CA", "India")).toBe(false);
  });
});

describe("mapGreenhouseJob", () => {
  it("maps a Greenhouse row, stripping HTML from content", () => {
    const job = mapGreenhouseJob(
      {
        title: "ML Engineer",
        company_name: "Stripe",
        location: { name: "Bengaluru" },
        content: "<p>Build <b>ML</b> systems</p>",
        absolute_url: "https://job/1",
        updated_at: "2026-06-01",
      },
      "Stripe",
    );
    expect(job).toMatchObject({
      sourceId: "ats",
      externalId: "https://job/1",
      title: "ML Engineer",
      company: "Stripe",
      location: "Bengaluru",
      description: "Build ML systems",
      url: "https://job/1",
    });
  });
});

describe("mapLeverJob", () => {
  it("prefers descriptionPlain and uses the registry company name", () => {
    const job = mapLeverJob(
      {
        text: "Backend Engineer",
        descriptionPlain: "Go and Postgres.",
        categories: { location: "Remote" },
        hostedUrl: "https://lever/2",
        id: "2",
      },
      "Acme",
    );
    expect(job).toMatchObject({
      title: "Backend Engineer",
      company: "Acme",
      location: "Remote",
      description: "Go and Postgres.",
      url: "https://lever/2",
    });
  });
});

describe("mapAdzunaJob", () => {
  it("maps an Adzuna result", () => {
    const job = mapAdzunaJob({
      id: "99",
      title: "Data Analyst",
      company: { display_name: "Acme" },
      location: { display_name: "Mumbai" },
      description: "SQL and Excel.",
      redirect_url: "https://adzuna/99",
      created: "2026-06-02",
    });
    expect(job).toMatchObject({
      sourceId: "adzuna",
      externalId: "99",
      company: "Acme",
      location: "Mumbai",
      description: "SQL and Excel.",
    });
  });
});
