import { describe, it, expect } from "vitest";
import { cvHash } from "./hash";

describe("cvHash", () => {
  it("is stable and ignores surrounding whitespace", () => {
    expect(cvHash("  hello ")).toBe(cvHash("hello"));
  });
  it("differs for different CVs", () => {
    expect(cvHash("a")).not.toBe(cvHash("b"));
  });
  it("is a short hex string", () => {
    expect(cvHash("x")).toMatch(/^[0-9a-f]{16}$/);
  });
});
