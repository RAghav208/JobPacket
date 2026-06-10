import { createHash } from "node:crypto";

/** Stable short hash of a CV, so the same résumé reuses its saved packets. Pure. */
export function cvHash(cv: string): string {
  return createHash("sha256").update(cv.trim()).digest("hex").slice(0, 16);
}
