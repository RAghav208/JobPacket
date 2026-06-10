import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { checkJobSpy, checkPython, runPython } from "./python";
import type { JobPosting, JobSource, SearchParams } from "./types";

/**
 * Adapter factory for any JobSpy-backed source (Naukri, LinkedIn, Indeed, ...).
 *
 *   search() ─► python jobspy-runner.py --site X ... ─► JSON ─► JobPosting[]
 *
 * The arg-building and output-parsing are pure functions (unit-tested without
 * Python); only search()/isAvailable() touch the subprocess.
 */

const RUNNER = join(dirname(fileURLToPath(import.meta.url)), "jobspy-runner.py");

/** Pure: build the runner argv for a search. */
export function buildRunnerArgs(
  scriptPath: string,
  site: string,
  params: SearchParams,
): string[] {
  const args = [scriptPath, "--site", site, "--query", params.query];
  if (params.location) args.push("--location", params.location);
  args.push("--limit", String(params.limit ?? 20));
  return args;
}

/** Pure: map JobSpy's JSON rows into our JobPosting shape. */
export function parseJobSpyOutput(stdout: string, sourceId: string): JobPosting[] {
  const rows = JSON.parse(stdout) as Array<Record<string, unknown>>;
  if (!Array.isArray(rows)) return [];
  return rows.map((row, i) => {
    const url = str(row["job_url"]);
    return {
      sourceId,
      externalId: url || `${sourceId}-${i}`,
      title: str(row["title"]),
      company: str(row["company"]),
      location: str(row["location"]),
      description: str(row["description"]),
      url,
      postedAt: row["date_posted"] != null ? str(row["date_posted"]) : undefined,
    };
  });
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

export function createJobSpySource(site: string, label: string): JobSource {
  return {
    id: site,
    label,
    requiresPython: true,

    async isAvailable(): Promise<boolean> {
      return (await checkPython()) && (await checkJobSpy());
    },

    async search(params: SearchParams): Promise<JobPosting[]> {
      const args = buildRunnerArgs(RUNNER, site, params);
      const res = await runPython(args, { timeoutMs: 60_000 });
      if (res.code !== 0) {
        let detail = res.stderr.trim();
        try {
          const parsed = JSON.parse(res.stderr) as { error?: string; detail?: string };
          if (parsed.error === "jobspy_not_installed") {
            detail = "JobSpy is not installed. Run: pip install python-jobspy";
          } else if (parsed.detail) {
            detail = parsed.detail;
          }
        } catch {
          /* stderr was not JSON; use it raw */
        }
        throw new Error(`${label} search failed: ${detail || `exit ${res.code}`}`);
      }
      return parseJobSpyOutput(res.stdout, site);
    },
  };
}
