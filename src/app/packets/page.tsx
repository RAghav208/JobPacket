"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPacketsAction } from "@/lib/actions/packet";
import type { PacketRecord } from "@/lib/db/packets";
import { Card, MetaLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadResumePdf } from "@/lib/pdf/resume-pdf";

export default function PacketsHistoryPage() {
  const [packets, setPackets] = useState<PacketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    listPacketsAction()
      .then(setPackets)
      .catch(() => setPackets([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">My packets</h1>
        <Link href="/packet">
          <Button size="sm" variant="secondary">
            Build a new one →
          </Button>
        </Link>
      </div>

      {loading && <Card className="text-sm text-muted">Loading your saved packets...</Card>}

      {!loading && packets.length === 0 && (
        <Card className="text-sm text-faint">
          No packets yet. Build one from a job in the wizard — it&rsquo;ll be saved here
          automatically and never regenerated.
        </Card>
      )}

      {packets.map((p) => {
        const open = openId === p.id;
        const tone =
          p.score == null
            ? "text-faint border-border"
            : p.score >= 75
              ? "text-good border-good/40 bg-good-weak/40"
              : p.score >= 45
                ? "text-signal border-signal/40 bg-signal-weak/40"
                : "text-warn border-warn/40 bg-warn-weak/40";
        return (
          <Card key={p.id} className="space-y-3">
            <button
              className="flex w-full items-start justify-between gap-4 text-left"
              onClick={() => setOpenId(open ? null : p.id)}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-fg">{p.job.title || "Role"}</p>
                <p className="truncate text-sm text-muted">
                  {[p.job.company, p.job.location].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-0.5 font-mono text-[10.5px] text-faint">
                  {new Date(p.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[12px] font-semibold ${tone}`}>
                {p.score == null ? "—" : `${p.score}%`}
              </span>
            </button>

            {open && (
              <div className="space-y-4 border-t border-border pt-3">
                {(p.matched.length > 0 || p.missing.length > 0) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <MetaLabel className="mb-1">Matched ({p.matched.length})</MetaLabel>
                      <p className="text-sm text-fg">{p.matched.join(", ") || "—"}</p>
                    </div>
                    <div>
                      <MetaLabel className="mb-1">Missing ({p.missing.length})</MetaLabel>
                      <p className="text-sm text-fg">{p.missing.join(", ") || "—"}</p>
                    </div>
                  </div>
                )}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <MetaLabel>Tailored résumé</MetaLabel>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        downloadResumePdf({
                          resumeText: p.tailoredResume,
                          jobTitle: p.job.title,
                          company: p.job.company,
                        })
                      }
                    >
                      Download ATS PDF
                    </Button>
                  </div>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-control border border-border bg-canvas p-3 font-mono text-[13px] text-fg">
                    {p.tailoredResume}
                  </pre>
                </div>
                <div>
                  <MetaLabel className="mb-1">Cover letter</MetaLabel>
                  {p.coverLetter ? (
                    <pre className="whitespace-pre-wrap rounded-control border border-border bg-canvas p-3 text-[13px] text-fg">
                      {p.coverLetter}
                    </pre>
                  ) : (
                    <p className="text-sm text-faint">Not generated.</p>
                  )}
                </div>
                {p.learningPlan && (
                  <div>
                    <MetaLabel className="mb-1">Skills to work on</MetaLabel>
                    <pre className="whitespace-pre-wrap rounded-control border border-border bg-canvas p-3 text-[13px] text-fg">
                      {p.learningPlan}
                    </pre>
                  </div>
                )}
                {p.companyResearch && (
                  <div>
                    <MetaLabel className="mb-1">Company research</MetaLabel>
                    <p className="whitespace-pre-wrap text-sm text-fg">{p.companyResearch}</p>
                  </div>
                )}
                {p.job.url && (
                  <a
                    href={p.job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-mono text-[11px] text-signal hover:underline"
                  >
                    view original posting ↗
                  </a>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
