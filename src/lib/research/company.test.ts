import { describe, it, expect } from "vitest";
import { buildCompanySummaryPrompt, noCompanyInfo } from "./company";

describe("buildCompanySummaryPrompt", () => {
  it("constrains the model to the source text only", () => {
    const [system, user] = buildCompanySummaryPrompt("Acme", "Acme makes widgets.");
    expect(system?.content.toLowerCase()).toContain("only the provided source");
    expect(system?.content.toLowerCase()).toContain("never add facts");
    expect(user?.content).toContain("Acme makes widgets.");
  });
});

describe("noCompanyInfo", () => {
  it("names the company and points to official sources", () => {
    const msg = noCompanyInfo("TinyStartup");
    expect(msg).toContain("TinyStartup");
    expect(msg.toLowerCase()).toContain("linkedin");
  });
});
