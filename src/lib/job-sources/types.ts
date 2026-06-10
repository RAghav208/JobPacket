/**
 * Job source adapter contract.
 *
 * Every place jobs come from (Naukri/LinkedIn/Indeed via JobSpy, Internshala,
 * company career pages) implements JobSource. One adapter breaking never breaks
 * the others, and scraping is gated behind isAvailable() so the core
 * score+tailor flow runs with zero Python.
 */

export interface JobPosting {
  /** Which adapter produced this, e.g. "naukri". */
  sourceId: string;
  /** Stable id on the source (usually the posting URL). */
  externalId: string;
  title: string;
  company: string;
  location: string;
  /** Full job-description text — the thing the score engine scores against. */
  description: string;
  url: string;
  postedAt?: string;
}

export interface SearchParams {
  query: string;
  location?: string;
  experience?: string;
  limit?: number;
}

export interface JobSource {
  id: string;
  label: string;
  /** True if this adapter shells out to Python/JobSpy (drives the setup card). */
  requiresPython: boolean;
  /** Cheap readiness check; false → the UI offers setup instead of crashing. */
  isAvailable(): Promise<boolean>;
  search(params: SearchParams): Promise<JobPosting[]>;
}
