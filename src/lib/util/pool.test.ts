import { describe, it, expect } from "vitest";
import { asyncPool, chunk } from "./pool";

describe("chunk", () => {
  it("splits into fixed-size chunks with a remainder", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe("asyncPool", () => {
  it("preserves order and runs every item", async () => {
    const out = await asyncPool(3, [3, 1, 2], async (n) => {
      await new Promise((r) => setTimeout(r, n * 5));
      return n * 10;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await asyncPool(2, [1, 2, 3, 4, 5, 6], async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("handles limit larger than item count", async () => {
    expect(await asyncPool(10, [1, 2], async (n) => n)).toEqual([1, 2]);
  });
});
