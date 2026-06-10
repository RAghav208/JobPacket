import { getJobSource, JOB_SOURCES } from "@/lib/job-sources";

export interface SearchRequestBody {
  sourceId?: string;
  query?: string;
  location?: string;
  limit?: number;
}

/**
 * POST /api/search — run one job source.
 *
 * Returns a structured `needs_setup` instead of crashing when Python/JobSpy
 * isn't installed, so the UI can show a setup card. Errors are surfaced, never
 * swallowed.
 */
export async function POST(req: Request) {
  let body: SearchRequestBody;
  try {
    body = (await req.json()) as SearchRequestBody;
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const { sourceId, query, location, limit } = body;
  if (!sourceId || !query?.trim()) {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const source = getJobSource(sourceId);
  if (!source) {
    return Response.json({ ok: false, reason: "unknown_source" }, { status: 400 });
  }

  if (!(await source.isAvailable())) {
    return Response.json({
      ok: false,
      reason: "needs_setup",
      message:
        "This source needs Python + JobSpy. Install Python, then run: pip install python-jobspy",
    });
  }

  try {
    // Clamp client-supplied limit to a sane range (avoid an unbounded request).
    const safeLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 15)));
    const jobs = await source.search({ query, location, limit: safeLimit });
    return Response.json({ ok: true, jobs });
  } catch (e) {
    return Response.json({ ok: false, reason: "error", message: (e as Error).message });
  }
}

/**
 * GET /api/search — list sources with availability so the UI can auto-search the
 * reliable, configured ones. Python (scraper) sources are reported but marked
 * unavailable for auto-search (they're opt-in) — we never spawn Python here.
 */
export async function GET() {
  const sources = await Promise.all(
    JOB_SOURCES.map(async (s) => ({
      id: s.id,
      label: s.label,
      requiresPython: s.requiresPython,
      available: s.requiresPython ? false : await s.isAvailable(),
    })),
  );
  return Response.json({ sources });
}
