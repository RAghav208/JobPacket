"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { scoreResume } from "@/lib/score-engine";
import { tailorAction, type TailorActionResult } from "@/lib/actions/tailor";
import { Button } from "@/components/ui/button";
import { Card, MetaLabel } from "@/components/ui/card";
import { ScoreView, ScoreBar } from "@/components/score-view";

const JD_KEY = "jobpacket:jd";

export default function GapPage() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [tailor, setTailor] = useState<TailorActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Prefill the JD if the user came from a job listing on /jobs.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(JD_KEY) : null;
    if (stored) {
      setJd(stored);
      window.localStorage.removeItem(JD_KEY);
    }
  }, []);

  // Scoring is pure and instant — no server round-trip.
  const result = useMemo(
    () => (resume.trim() && jd.trim() ? scoreResume(resume, jd) : null),
    [resume, jd],
  );

  function runTailor() {
    setTailor(null);
    startTransition(async () => setTailor(await tailorAction(resume, jd, result?.missing ?? [])));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">See the gap</h1>
        <p className="mt-1 text-sm text-muted">
          Paste your resume and a job description. JobPacket shows what an ATS sees —
          the skills you match, the ones you&rsquo;re missing, and an honest score.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <MetaLabel>Your resume</MetaLabel>
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            placeholder="Paste your resume text..."
            className="h-56 w-full resize-y rounded-control border border-border bg-canvas p-3 font-mono text-[13px] text-fg outline-none focus:border-border-strong"
          />
        </Card>
        <Card className="space-y-2">
          <MetaLabel>Job description</MetaLabel>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste a job description (or pick one from Find Jobs)..."
            className="h-56 w-full resize-y rounded-control border border-border bg-canvas p-3 font-mono text-[13px] text-fg outline-none focus:border-border-strong"
          />
        </Card>
      </div>

      {result ? (
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <MetaLabel>The gap</MetaLabel>
            <Button size="sm" onClick={runTailor} disabled={pending}>
              {pending ? "Tailoring..." : "Tailor with AI"}
            </Button>
          </div>
          <ScoreView result={result} />
        </Card>
      ) : (
        <Card className="text-sm text-faint">
          Fill in both boxes to see your score.
        </Card>
      )}

      {tailor && <TailorResult tailor={tailor} />}
    </div>
  );
}

function TailorResult({ tailor }: { tailor: TailorActionResult }) {
  if (!tailor.ok) {
    return (
      <Card className="space-y-2 border-warn/40">
        <MetaLabel>Tailoring unavailable</MetaLabel>
        {tailor.reason === "no_provider" ? (
          <p className="text-sm text-muted">
            No AI provider found. JobPacket uses what you already have — start Ollama,
            or set <code className="font-mono">ANTHROPIC_API_KEY</code> /{" "}
            <code className="font-mono">OPENAI_API_KEY</code> /{" "}
            <code className="font-mono">GEMINI_API_KEY</code>, then try again.
          </p>
        ) : (
          <p className="text-sm text-muted">Tailoring failed: {tailor.message}</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <MetaLabel>Closing the gap · {tailor.providerLabel}</MetaLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-muted">Before</p>
          <ScoreBar score={tailor.before.score} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">After</p>
          <ScoreBar score={tailor.after.score} />
        </div>
      </div>

      {tailor.addedSkills.length > 0 && (
        <div className="rounded-control border border-warn/40 bg-warn-weak/40 p-3">
          <MetaLabel className="mb-1 text-warn">Confirm before you use these</MetaLabel>
          <p className="text-sm text-muted">
            Tailoring surfaced these skills. The score above counts them — keep only the
            ones you genuinely have:
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {tailor.addedSkills.map((s) => (
              <li
                key={s}
                className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-fg"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <MetaLabel className="mb-2">Tailored resume</MetaLabel>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-control border border-border bg-canvas p-3 font-mono text-[13px] text-fg">
          {tailor.tailoredText}
        </pre>
      </div>
    </Card>
  );
}
