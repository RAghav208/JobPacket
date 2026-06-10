import { createJobSpySource } from "./jobspy-adapter";
import { createAtsSource } from "./ats";
import { createAdzunaSource } from "./adzuna";
import { createJSearchSource } from "./jsearch";
import type { JobSource } from "./types";

/**
 * The registry of available job sources, reliable (stable-API) ones first.
 *
 * - ATS + Adzuna: pure-TS APIs, no Python, return full JDs, don't break on HTML.
 * - JobSpy boards (Naukri/LinkedIn/Indeed): scraped — broad but fragile + need Python.
 * The UI and search route don't care how a source is implemented.
 */
export const JOB_SOURCES: JobSource[] = [
  createAtsSource(),
  createAdzunaSource(),
  createJSearchSource(),
  createJobSpySource("naukri", "Naukri (scraped)"),
  createJobSpySource("linkedin", "LinkedIn (scraped)"),
  createJobSpySource("indeed", "Indeed (scraped)"),
];

export function getJobSource(id: string): JobSource | undefined {
  return JOB_SOURCES.find((s) => s.id === id);
}

export {
  buildRunnerArgs,
  parseJobSpyOutput,
  createJobSpySource,
} from "./jobspy-adapter";
export { checkPython, checkJobSpy } from "./python";
export type { JobPosting, JobSource, SearchParams } from "./types";
