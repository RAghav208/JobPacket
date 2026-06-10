import { describe, it, expect } from "vitest";
import { normalizeForPdf } from "./resume-pdf";

describe("normalizeForPdf", () => {
  it("maps smart quotes and dashes to ASCII", () => {
    expect(normalizeForPdf("“hi” ‘there’ — done")).toBe('"hi" \'there\' - done');
  });
  it("maps bullets, ellipsis, and nbsp", () => {
    expect(normalizeForPdf("• item… end")).toBe("- item... end");
  });
  it("leaves plain ASCII untouched", () => {
    expect(normalizeForPdf("Python, SQL - 5 years")).toBe("Python, SQL - 5 years");
  });
});
