"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { JobPosting } from "@/lib/job-sources/types";
import { Button } from "@/components/ui/button";
import { Card, MetaLabel } from "@/components/ui/card";

const JD_KEY = "jobpacket:jd";

const SOURCES = [
  { id: "naukri", label: "Naukri" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "indeed", label: "Indeed" },
];

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; jobs: JobPosting[] }
  | { status: "needs_setup"; message: string }
  | { status: "error"; message: string };

export default function JobsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("India");
  const [sourceId, setSourceId] = useState("naukri");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function search() {
    if (!query.trim()) return;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId, query, location, limit: 15 }),
      });
      const data = await res.json();
      if (data.ok) setState({ status: "ok", jobs: data.jobs });
      else if (data.reason === "needs_setup")
        setState({ status: "needs_setup", message: data.message });
      else setState({ status: "error", message: data.message ?? "Search failed." });
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  }

  function scoreAgainst(job: JobPosting) {
    window.localStorage.setItem(JD_KEY, job.description || `${job.title} at ${job.company}`);
    router.push("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Find jobs</h1>
        <p className="mt-1 text-sm text-muted">
          Pull live listings from India&rsquo;s boards, then score your resume against any
          of them in one click.
        </p>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <label className="flex-1 space-y-1">
          <MetaLabel>Role / keywords</MetaLabel>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="data analyst"
            className="h-10 w-full rounded-control border border-border bg-canvas px-3 text-sm text-fg outline-none focus:border-border-strong"
          />
        </label>
        <label className="w-40 space-y-1">
          <MetaLabel>Location</MetaLabel>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-10 w-full rounded-control border border-border bg-canvas px-3 text-sm text-fg outline-none focus:border-border-strong"
          />
        </label>
        <label className="w-36 space-y-1">
          <MetaLabel>Source</MetaLabel>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="h-10 w-full rounded-control border border-border bg-canvas px-3 text-sm text-fg outline-none focus:border-border-strong"
          >
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={search} disabled={state.status === "loading"}>
          {state.status === "loading" ? "Searching..." : "Search"}
        </Button>
      </Card>

      {state.status === "needs_setup" && (
        <Card className="space-y-1 border-warn/40">
          <MetaLabel className="text-warn">One-time setup needed</MetaLabel>
          <p className="text-sm text-muted">{state.message}</p>
        </Card>
      )}

      {state.status === "error" && (
        <Card className="border-warn/40 text-sm text-muted">{state.message}</Card>
      )}

      {state.status === "ok" && (
        <div className="space-y-3">
          <MetaLabel>{state.jobs.length} results</MetaLabel>
          {state.jobs.length === 0 && (
            <Card className="text-sm text-faint">No jobs found. Try different keywords.</Card>
          )}
          {state.jobs.map((job) => (
            <Card key={job.externalId} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-fg">{job.title || "Untitled role"}</p>
                <p className="truncate text-sm text-muted">
                  {[job.company, job.location].filter(Boolean).join(" · ")}
                </p>
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-mono text-[11px] text-signal hover:underline"
                  >
                    view original ↗
                  </a>
                )}
              </div>
              <Button size="sm" variant="secondary" onClick={() => scoreAgainst(job)}>
                Score my resume →
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
