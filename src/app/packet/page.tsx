"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { detectSkills, defaultVocabulary } from "@/lib/score-engine";
import { suggestRolesAction, type RoleSuggestion } from "@/lib/actions/roles";
import { extractCvSkillsAction } from "@/lib/actions/skills";
import { scoreJobsAction, type ScoredJob } from "@/lib/actions/score-jobs";
import { tailorAction } from "@/lib/actions/tailor";
import {
  coverLetterAction,
  getSavedPacketAction,
  savePacketAction,
  builtJobIdsAction,
} from "@/lib/actions/packet";
import { learningPlanAction, companyResearchAction } from "@/lib/actions/extras";
import { filterAndSortJobs, type PostedWindow, type JobSortBy } from "@/lib/jobs/filter";
import { asyncPool, chunk } from "@/lib/util/pool";
import type { JobPosting } from "@/lib/job-sources/types";
import { Button } from "@/components/ui/button";
import { Card, MetaLabel } from "@/components/ui/card";
import { ScoreBar } from "@/components/score-view";
import { downloadResumePdf } from "@/lib/pdf/resume-pdf";
import { cn } from "@/lib/cn";

const STEPS = ["CV", "Roles", "Jobs", "Packet"] as const;

function Stepper({ active }: { active: number }) {
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px]",
              i === active
                ? "bg-ink text-on-ink"
                : i < active
                  ? "bg-good-weak text-good"
                  : "border border-border text-faint",
            )}
          >
            {i + 1}
          </span>
          <span className={cn(i === active ? "text-fg" : "text-faint")}>{label}</span>
          {i < STEPS.length - 1 && <span className="text-faint">·</span>}
        </li>
      ))}
    </ol>
  );
}

export default function PacketWizard() {
  const [step, setStep] = useState(0);

  // Step 1 — CV
  const [cv, setCv] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 1 — AI-extracted skills (editable)
  const [cvSkills, setCvSkills] = useState<string[]>([]);
  const [scanningSkills, setScanningSkills] = useState(false);
  const [skillSource, setSkillSource] = useState<"ai" | "rules" | null>(null);
  const [skillInput, setSkillInput] = useState("");

  // AI provider picker (detected agents)
  const [providers, setProviders] = useState<Array<{ id: string; label: string }>>([]);
  const [providerId, setProviderId] = useState(""); // "" = Auto (best available + fall-through)

  // Step 2 — Roles
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [roleSource, setRoleSource] = useState<"ai" | "rules" | null>(null);
  const [roleProviderLabel, setRoleProviderLabel] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<RoleSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState("");

  // Step 3 — Jobs
  const [sources, setSources] = useState<
    Array<{ id: string; label: string; available?: boolean; requiresPython?: boolean }>
  >([]);
  const [searchLocation, setSearchLocation] = useState("India");
  const [searchedSources, setSearchedSources] = useState<string[]>([]);
  const [jobsStatus, setJobsStatus] = useState<
    "idle" | "loading" | "scoring" | "ok" | "needs_setup" | "error"
  >("idle");
  const [jobsMessage, setJobsMessage] = useState<string | null>(null);
  const [jobsPool, setJobsPool] = useState<JobPosting[]>([]);
  const [scoreMap, setScoreMap] = useState<Record<string, ScoredJob>>({});
  const [scoreSource, setScoreSource] = useState<"ai" | "rules" | null>(null);
  const [builtJobIds, setBuiltJobIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<JobSortBy>("fit");
  const [postedWithin, setPostedWithin] = useState<PostedWindow>("week");
  const [minScore, setMinScore] = useState(0);
  const [scoreProgress, setScoreProgress] = useState({ done: 0, total: 0 });

  // Step 4 — Packet (progressive: tailor résumé, then cover letter)
  const [approvedJob, setApprovedJob] = useState<JobPosting | null>(null);
  const [approvedScore, setApprovedScore] = useState<ScoredJob | undefined>(undefined);
  const [packetStatus, setPacketStatus] = useState<
    "idle" | "tailoring" | "cover" | "ok" | "error" | "no_provider"
  >("idle");
  const [packetError, setPacketError] = useState<string | null>(null);
  const [tailoredResume, setTailoredResume] = useState("");
  const [packetAddedSkills, setPacketAddedSkills] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [packetFromCache, setPacketFromCache] = useState(false);
  const [learningPlan, setLearningPlan] = useState("");
  const [learningStatus, setLearningStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [planTimeframe, setPlanTimeframe] = useState("1 month");
  const [showJd, setShowJd] = useState(false);
  const [companyResearch, setCompanyResearch] = useState("");
  const [researchStatus, setResearchStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers ?? []))
      .catch(() => setProviders([]));
    fetch("/api/search")
      .then((r) => r.json())
      .then((d) => setSources(d.sources ?? []))
      .catch(() => setSources([]));
  }, []);

  // Tick a live timer while the packet is generating, so the user sees progress.
  useEffect(() => {
    if (packetStatus !== "tailoring" && packetStatus !== "cover") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [packetStatus]);

  const skills = useMemo(
    () => (cv.trim() ? [...detectSkills(cv, defaultVocabulary).keys()] : []),
    [cv],
  );
  const selectedRoles = suggestions.filter((s) => selected.has(s.role)).map((s) => s.role);
  const effectiveCvSkills = cvSkills.length ? cvSkills : skills;
  const rankedJobs = filterAndSortJobs(
    jobsPool,
    (id) => scoreMap[id]?.score ?? 0,
    { postedWithin, minScore, sortBy },
  );

  async function handleFile(file: File) {
    setError(null);
    setParsing(true);
    setFilename(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-cv", { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) setCv(data.text);
      else setError(data.message ?? `Could not read ${file.name}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  async function scanSkills() {
    if (!cv.trim()) return;
    setScanningSkills(true);
    try {
      const r = await extractCvSkillsAction(cv, providerId || undefined);
      setCvSkills(r.skills);
      setSkillSource(r.source);
    } finally {
      setScanningSkills(false);
    }
  }

  function removeSkill(s: string) {
    setCvSkills((prev) => prev.filter((x) => x !== s));
  }

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    setCvSkills((prev) =>
      prev.some((x) => x.toLowerCase() === s.toLowerCase()) ? prev : [...prev, s],
    );
    setSkillInput("");
  }

  async function goToRoles() {
    if (!cv.trim()) return;
    setLoadingRoles(true);
    try {
      const result = await suggestRolesAction(cv, providerId || undefined);
      setSuggestions(result.roles);
      setRoleSource(result.source);
      setRoleProviderLabel(result.providerLabel ?? null);
      setSelected(new Set(result.roles.map((r) => r.role)));
      setStep(1);
    } finally {
      setLoadingRoles(false);
    }
  }

  function toggleRole(role: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function addCustom() {
    const role = customInput.trim();
    if (!role) return;
    if (!suggestions.some((s) => s.role.toLowerCase() === role.toLowerCase())) {
      setSuggestions((prev) => [...prev, { role, matched: [] }]);
    }
    setSelected((prev) => new Set(prev).add(role));
    setCustomInput("");
  }

  function goToJobs() {
    if (selectedRoles.length === 0) return;
    setStep(2);
    void searchAll();
  }

  function mergeJobs(existing: JobPosting[], incoming: JobPosting[]): JobPosting[] {
    const seen = new Set(existing.map((j) => j.externalId));
    return [...existing, ...incoming.filter((j) => !seen.has(j.externalId))];
  }

  /**
   * Auto-search EVERY selected role across EVERY available reliable source, in
   * parallel, then score + rank ALL of them (scoring is chunked server-side).
   */
  async function searchAll() {
    const roles = selectedRoles;
    if (roles.length === 0) return;

    setJobsStatus("loading");
    setJobsMessage(null);

    const fallback = [{ id: "ats", label: "Company boards (ATS)", available: true, requiresPython: false }];
    const targets = (sources.length ? sources : fallback).filter(
      (s) => s.available !== false && !s.requiresPython,
    );
    const useTargets = targets.length ? targets : fallback;
    setSearchedSources(useTargets.map((s) => s.label));

    try {
      // role × source, all in parallel — slowest single call dominates, not the sum.
      const calls = roles.flatMap((role) =>
        useTargets.map((s) =>
          fetch("/api/search", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sourceId: s.id, query: role, location: searchLocation, limit: 25 }),
          })
            .then((r) => r.json())
            .then((d) => (d.ok ? (d.jobs as JobPosting[]) : []))
            .catch(() => []),
        ),
      );

      const groups = await Promise.all(calls);
      let pool: JobPosting[] = [];
      for (const g of groups) pool = mergeJobs(pool, g);
      setJobsPool(pool);

      if (pool.length === 0) {
        setJobsStatus("ok");
        return;
      }

      // Score progressively: chunks of 15, up to 3 in flight, scores fill in
      // as each chunk lands (cached JDs come back near-instantly).
      setJobsStatus("scoring");
      setScoreMap({});
      setScoreProgress({ done: 0, total: pool.length });
      const scoreChunks = chunk(
        pool.map((j) => ({ id: j.externalId, description: j.description })),
        15,
      );
      await asyncPool(3, scoreChunks, async (jobsChunk) => {
        const res = await scoreJobsAction(effectiveCvSkills, jobsChunk, providerId || undefined);
        setScoreMap((prev) => {
          const next = { ...prev };
          for (const s of res.scored) next[s.id] = s;
          return next;
        });
        if (res.source === "ai") setScoreSource("ai");
        else setScoreSource((cur) => cur ?? "rules");
        setScoreProgress((p) => ({ ...p, done: p.done + jobsChunk.length }));
      });
      setJobsStatus("ok");

      // Mark which of these already have a saved packet.
      builtJobIdsAction(cv, pool.map((j) => j.externalId))
        .then((ids) => setBuiltJobIds(new Set(ids)))
        .catch(() => {});
    } catch (e) {
      setJobsStatus("error");
      setJobsMessage((e as Error).message);
    }
  }

  async function approveJob(job: JobPosting) {
    const score = scoreMap[job.externalId];
    setApprovedJob(job);
    setApprovedScore(score);
    setTailoredResume("");
    setCoverLetter("");
    setPacketAddedSkills([]);
    setPacketError(null);
    setPacketFromCache(false);
    setLearningPlan("");
    setLearningStatus("idle");
    setCompanyResearch("");
    setResearchStatus("idle");
    setShowJd(false);
    setElapsed(0);
    setStep(3);

    // Cache check — if we already built this packet, load it instantly (no AI re-run).
    const saved = await getSavedPacketAction(cv, job);
    if (saved) {
      setTailoredResume(saved.tailoredResume);
      setCoverLetter(saved.coverLetter);
      setPacketAddedSkills(saved.addedSkills);
      setLearningPlan(saved.learningPlan);
      setCompanyResearch(saved.companyResearch);
      setPacketFromCache(true);
      setPacketStatus("ok");
      setBuiltJobIds((prev) => new Set(prev).add(job.externalId));
      return;
    }

    // Step 1/2 — tailor the résumé.
    setPacketStatus("tailoring");
    const t = await tailorAction(
      cv,
      job.description || `${job.title} ${job.company}`,
      score?.missing ?? [],
      providerId || undefined,
    );
    if (!t.ok) {
      setPacketStatus(t.reason === "no_provider" ? "no_provider" : "error");
      if (t.reason === "error") setPacketError(t.message);
      return;
    }
    setTailoredResume(t.tailoredText);
    setPacketAddedSkills(t.addedSkills);

    // Step 2/2 — write the cover letter (résumé already visible). A failure here
    // doesn't lose the résumé.
    setPacketStatus("cover");
    const c = await coverLetterAction(cv, job, providerId || undefined);
    const letter = c.ok ? c.coverLetter : "";
    if (letter) setCoverLetter(letter);
    setPacketStatus("ok");

    // Persist so it's never rebuilt and shows up in "My Packets".
    await savePacketAction(cv, {
      job,
      score: score?.score ?? null,
      matched: score?.matched ?? [],
      missing: score?.missing ?? [],
      tailoredResume: t.tailoredText,
      coverLetter: letter,
      addedSkills: t.addedSkills,
    });
    setBuiltJobIds((prev) => new Set(prev).add(job.externalId));
  }

  /** Re-save the current packet with optional extra fields (learning plan / research). */
  async function persistPacket(over: { learningPlan?: string; companyResearch?: string }) {
    if (!approvedJob) return;
    await savePacketAction(cv, {
      job: approvedJob,
      score: approvedScore?.score ?? null,
      matched: approvedScore?.matched ?? [],
      missing: approvedScore?.missing ?? [],
      tailoredResume,
      coverLetter,
      addedSkills: packetAddedSkills,
      learningPlan: over.learningPlan ?? learningPlan,
      companyResearch: over.companyResearch ?? companyResearch,
    });
  }

  async function generateLearningPlan() {
    if (!approvedJob) return;
    setLearningStatus("loading");
    const r = await learningPlanAction(
      approvedScore?.missing ?? [],
      approvedJob.title,
      planTimeframe,
      providerId || undefined,
    );
    if (r.ok) {
      setLearningPlan(r.plan);
      setLearningStatus("ok");
      await persistPacket({ learningPlan: r.plan });
    } else {
      setLearningStatus("error");
    }
  }

  async function researchCompany() {
    if (!approvedJob?.company) return;
    setResearchStatus("loading");
    const r = await companyResearchAction(approvedJob.company, providerId || undefined);
    if (r.ok) {
      setCompanyResearch(r.research);
      setResearchStatus("ok");
      await persistPacket({ companyResearch: r.research });
    } else {
      setResearchStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Build an application packet</h1>
        <Stepper active={step} />
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted">AI agent</span>
          {providers.length > 0 ? (
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="h-8 rounded-control border border-border bg-surface px-2 text-[13px] text-fg outline-none focus:border-border-strong"
            >
              <option value="">Auto (best available)</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-faint">
              none detected — install/login to claude, codex, or gemini, or start Ollama
              (roles fall back to skill-based)
            </span>
          )}
        </div>
      </div>

      {step === 0 && (
        <>
          <Card className="space-y-4">
            <MetaLabel>Step 1 · Your CV</MetaLabel>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-control border border-dashed px-4 py-8 text-center transition-colors",
                dragging ? "border-signal bg-signal-weak/40" : "border-border-strong bg-canvas",
              )}
            >
              <p className="text-sm text-muted">
                {parsing ? "Reading your CV..." : "Drop your CV here (PDF or DOCX)"}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={parsing}>
                Choose file
              </Button>
              {filename && !error && <p className="font-mono text-[11px] text-faint">{filename}</p>}
            </div>

            {error && (
              <p className="rounded-control border border-warn/40 bg-warn-weak/40 p-2 text-sm text-warn">
                {error}
              </p>
            )}

            <div className="space-y-1">
              <MetaLabel>Extracted text — edit if the parse is messy, or paste your CV here</MetaLabel>
              <textarea
                value={cv}
                onChange={(e) => setCv(e.target.value)}
                placeholder="Your CV text appears here after upload, or paste it directly..."
                className="h-64 w-full resize-y rounded-control border border-border bg-canvas p-3 font-mono text-[13px] text-fg outline-none focus:border-border-strong"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <MetaLabel>Skills{cvSkills.length ? ` (${cvSkills.length})` : ""}</MetaLabel>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={scanSkills}
                  disabled={!cv.trim() || scanningSkills}
                >
                  {scanningSkills
                    ? "Scanning..."
                    : cvSkills.length
                      ? "Re-scan with AI"
                      : "Scan skills with AI"}
                </Button>
              </div>

              {cvSkills.length > 0 ? (
                <>
                  <p className="text-[11px] text-faint">
                    {skillSource === "ai"
                      ? "Extracted by AI — remove anything that isn't yours, add anything missing."
                      : "From a keyword scan (no AI agent worked) — edit freely."}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {cvSkills.map((s) => (
                      <li
                        key={s}
                        className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-fg"
                      >
                        {s}
                        <button
                          onClick={() => removeSkill(s)}
                          className="text-faint hover:text-warn"
                          aria-label={`remove ${s}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2">
                    <input
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSkill()}
                      placeholder="add a skill"
                      className="h-8 flex-1 rounded-control border border-border bg-canvas px-2 text-[13px] text-fg outline-none focus:border-border-strong"
                    />
                    <Button size="sm" variant="ghost" onClick={addSkill} disabled={!skillInput.trim()}>
                      Add
                    </Button>
                  </div>
                </>
              ) : (
                skills.length > 0 && (
                  <>
                    <p className="text-[11px] text-faint">
                      Quick keyword preview. Click &ldquo;Scan skills with AI&rdquo; for an
                      accurate, editable list.
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {skills.map((s) => (
                        <li
                          key={s}
                          className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-faint"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </>
                )
              )}
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-faint">
              {cv.trim() ? "Looks good. Next we'll suggest roles to search for." : "Upload or paste your CV to continue."}
            </p>
            <Button onClick={goToRoles} disabled={!cv.trim() || loadingRoles}>
              {loadingRoles ? "Reading your CV..." : "Continue to roles →"}
            </Button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <MetaLabel>Step 2 · Roles to search for</MetaLabel>
              <span className="font-mono text-[11px] text-faint">
                {roleSource === "ai"
                  ? `suggested by ${roleProviderLabel ?? "your AI"}`
                  : "suggested from your skills (no AI agent worked)"}
              </span>
            </div>

            <p className="text-sm text-muted">
              Tap to select the roles you want to search. Add your own if we missed one.
            </p>

            <ul className="flex flex-wrap gap-2">
              {suggestions.map((s) => {
                const on = selected.has(s.role);
                return (
                  <li key={s.role}>
                    <button
                      onClick={() => toggleRole(s.role)}
                      title={s.matched.length ? `from: ${s.matched.join(", ")}` : undefined}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        on
                          ? "border-signal bg-signal-weak text-fg"
                          : "border-border bg-surface text-muted hover:bg-hover",
                      )}
                    >
                      {on ? "✓ " : ""}
                      {s.role}
                    </button>
                  </li>
                );
              })}
              {suggestions.length === 0 && (
                <li className="text-sm text-faint">
                  No roles suggested — add your own below.
                </li>
              )}
            </ul>

            <div className="flex items-end gap-2">
              <label className="flex-1 space-y-1">
                <MetaLabel>Add a role</MetaLabel>
                <input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustom()}
                  placeholder="e.g. Data Engineer"
                  className="h-10 w-full rounded-control border border-border bg-canvas px-3 text-sm text-fg outline-none focus:border-border-strong"
                />
              </label>
              <Button variant="secondary" onClick={addCustom} disabled={!customInput.trim()}>
                Add
              </Button>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-faint">{selectedRoles.length} selected</span>
              <Button onClick={goToJobs} disabled={selectedRoles.length === 0}>
                Search jobs →
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <MetaLabel>Step 3 · Jobs for your roles</MetaLabel>
              {scoreSource && (
                <span className="font-mono text-[11px] text-faint">
                  {scoreSource === "ai" ? "scored by AI" : "scored by keyword fallback"}
                </span>
              )}
            </div>

            <div>
              <p className="text-sm text-muted">Searching all your roles automatically:</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {selectedRoles.map((r) => (
                  <li
                    key={r}
                    className="rounded-full border border-signal/40 bg-signal-weak px-2 py-0.5 text-[12px] text-fg"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="w-40 space-y-1">
                <MetaLabel>Location</MetaLabel>
                <input
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="h-9 w-full rounded-control border border-border bg-canvas px-3 text-sm text-fg outline-none focus:border-border-strong"
                />
              </label>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void searchAll()}
                disabled={jobsStatus === "loading" || jobsStatus === "scoring"}
              >
                {jobsStatus === "loading"
                  ? "Searching all roles..."
                  : jobsStatus === "scoring"
                    ? "Scoring..."
                    : "Search again"}
              </Button>
            </div>
            {searchedSources.length > 0 && (
              <p className="text-[11px] text-faint">Sources: {searchedSources.join(", ")}</p>
            )}
          </Card>

          {(jobsStatus === "loading" || jobsStatus === "scoring") && (
            <Card className="text-sm text-muted">
              {jobsStatus === "loading"
                ? `Searching ${selectedRoles.length} role${selectedRoles.length > 1 ? "s" : ""} across ${searchedSources.length || 1} source${(searchedSources.length || 1) > 1 ? "s" : ""}...`
                : `Scoring jobs against your CV... ${scoreProgress.done}/${scoreProgress.total} (scores fill in below as they finish)`}
            </Card>
          )}
          {jobsStatus === "ok" && jobsPool.length === 0 && (
            <Card className="text-sm text-faint">
              No jobs found for these roles. Try editing your roles, changing the location, or
              adding an Adzuna/JSearch key for broader coverage.
            </Card>
          )}

          {jobsStatus === "needs_setup" && (
            <Card className="space-y-1 border-warn/40">
              <MetaLabel className="text-warn">One-time setup needed</MetaLabel>
              <p className="text-sm text-muted">{jobsMessage}</p>
            </Card>
          )}
          {jobsStatus === "error" && (
            <Card className="border-warn/40 text-sm text-muted">{jobsMessage}</Card>
          )}

          {jobsPool.length > 0 && (
            <Card className="flex flex-wrap items-end gap-3">
              <label className="space-y-1">
                <MetaLabel>Sort by</MetaLabel>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as JobSortBy)}
                  className="h-9 rounded-control border border-border bg-canvas px-2 text-sm text-fg outline-none focus:border-border-strong"
                >
                  <option value="fit">Best fit</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
              <label className="space-y-1">
                <MetaLabel>Posted</MetaLabel>
                <select
                  value={postedWithin}
                  onChange={(e) => setPostedWithin(e.target.value as PostedWindow)}
                  className="h-9 rounded-control border border-border bg-canvas px-2 text-sm text-fg outline-none focus:border-border-strong"
                >
                  <option value="any">Any time</option>
                  <option value="day">Last 24 hours</option>
                  <option value="week">Last week</option>
                  <option value="month">Last month</option>
                </select>
              </label>
              <label className="space-y-1">
                <MetaLabel>Min match</MetaLabel>
                <select
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="h-9 rounded-control border border-border bg-canvas px-2 text-sm text-fg outline-none focus:border-border-strong"
                >
                  <option value={0}>All</option>
                  <option value={50}>50%+</option>
                  <option value={75}>75%+</option>
                </select>
              </label>
            </Card>
          )}

          {jobsPool.length > 0 && jobsStatus === "ok" && rankedJobs.length === 0 && (
            <Card className="text-sm text-faint">
              All {jobsPool.length} jobs are hidden by your filters — widen the posted window or
              lower the minimum match. (Postings without a date are hidden when a time window is on.)
            </Card>
          )}

          {rankedJobs.length > 0 && (
            <div className="space-y-3">
              <MetaLabel>
                {rankedJobs.length} of {jobsPool.length} jobs ·{" "}
                {sortBy === "fit" ? "best fit first" : "newest first"}
              </MetaLabel>
              {rankedJobs.map((job) => {
                const sc = scoreMap[job.externalId];
                const score = sc?.score ?? 0;
                const pending = !sc && jobsStatus === "scoring";
                const built = builtJobIds.has(job.externalId);
                const tone = pending
                  ? "text-faint border-border"
                  : score >= 75
                    ? "text-good border-good/40 bg-good-weak/40"
                    : score >= 45
                      ? "text-signal border-signal/40 bg-signal-weak/40"
                      : "text-warn border-warn/40 bg-warn-weak/40";
                return (
                  <Card key={job.externalId} className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold text-fg">{job.title || "Untitled role"}</p>
                      <p className="truncate text-sm text-muted">
                        {[job.company, job.location].filter(Boolean).join(" · ")}
                      </p>
                      {sc && (
                        <p className="text-[11px] text-faint">
                          {sc.matched.length} matched · {sc.missing.length} missing
                          {sc.missing.length > 0 && (
                            <span>
                              {" · gaps: "}
                              {sc.missing.slice(0, 4).join(", ")}
                              {sc.missing.length > 4 ? "…" : ""}
                            </span>
                          )}
                        </p>
                      )}
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block font-mono text-[11px] text-signal hover:underline"
                        >
                          view original ↗
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[12px] font-semibold ${tone}`}>
                        {pending ? "…" : `${score}%`}
                      </span>
                      {built && (
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-good">
                          ✓ Built
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant={built ? "secondary" : "primary"}
                        onClick={() => approveJob(job)}
                      >
                        {built ? "View packet →" : "Approve & build →"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div>
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Back
            </Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <MetaLabel>Step 4 · Your packet</MetaLabel>
              {(packetStatus === "tailoring" || packetStatus === "cover" || packetStatus === "ok") && (
                <span className="font-mono text-[11px] text-faint">
                  {packetStatus === "ok" ? `built in ${elapsed}s` : `${elapsed}s`}
                </span>
              )}
            </div>
            {approvedJob && (
              <div>
                <p className="font-semibold text-fg">{approvedJob.title}</p>
                <p className="text-sm text-muted">
                  {[approvedJob.company, approvedJob.location].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  {approvedJob.description && (
                    <button
                      onClick={() => setShowJd((v) => !v)}
                      className="font-mono text-[11px] text-signal hover:underline"
                    >
                      {showJd ? "hide job description" : "show job description"}
                    </button>
                  )}
                  {approvedJob.url && (
                    <a
                      href={approvedJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-signal hover:underline"
                    >
                      view original ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            {showJd && approvedJob?.description && (
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-control border border-border bg-canvas p-3 text-[13px] text-fg">
                {approvedJob.description}
              </pre>
            )}

            {packetFromCache && packetStatus === "ok" && (
              <p className="text-sm text-good">
                ✓ Loaded from your saved packets — no AI call needed.
              </p>
            )}

            {/* Progress checklist */}
            {!packetFromCache && packetStatus !== "no_provider" && packetStatus !== "error" && (
              <ol className="space-y-1 text-sm">
                <li className={tailoredResume ? "text-good" : "text-fg"}>
                  {tailoredResume ? "✓" : packetStatus === "tailoring" ? "◌" : "·"} Step 1/2 — Tailoring your résumé
                  {packetStatus === "tailoring" && <span className="text-muted"> … ({elapsed}s)</span>}
                </li>
                <li
                  className={
                    coverLetter ? "text-good" : packetStatus === "cover" ? "text-fg" : "text-faint"
                  }
                >
                  {coverLetter ? "✓" : packetStatus === "cover" ? "◌" : "·"} Step 2/2 — Writing your cover letter
                  {packetStatus === "cover" && <span className="text-muted"> … ({elapsed}s)</span>}
                </li>
              </ol>
            )}

            {packetStatus === "no_provider" && (
              <p className="rounded-control border border-warn/40 bg-warn-weak/40 p-2 text-sm text-warn">
                No AI agent available. Configure Claude/Codex/Gemini/Ollama or an API key, then
                go back and approve again.
              </p>
            )}
            {packetStatus === "error" && (
              <p className="rounded-control border border-warn/40 bg-warn-weak/40 p-2 text-sm text-warn">
                Tailoring failed: {packetError ?? "unknown error"}
              </p>
            )}
          </Card>

          {/* Fit — shown once tailoring is done */}
          {(packetStatus === "cover" || packetStatus === "ok") && approvedScore && (
            <Card className="space-y-3">
              <MetaLabel>Fit for this job</MetaLabel>
              <ScoreBar score={approvedScore.score} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <MetaLabel className="mb-1">Matched ({approvedScore.matched.length})</MetaLabel>
                  <p className="text-sm text-fg">{approvedScore.matched.join(", ") || "—"}</p>
                </div>
                <div>
                  <MetaLabel className="mb-1">Missing ({approvedScore.missing.length})</MetaLabel>
                  <p className="text-sm text-fg">{approvedScore.missing.join(", ") || "—"}</p>
                </div>
              </div>
            </Card>
          )}

          {packetAddedSkills.length > 0 && (
            <Card className="space-y-1 border-warn/40">
              <MetaLabel className="text-warn">Confirm before you use these</MetaLabel>
              <p className="text-sm text-muted">
                Tailoring surfaced these skills — keep only the ones you genuinely have:
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {packetAddedSkills.map((s) => (
                  <li
                    key={s}
                    className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-fg"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Résumé — appears as soon as step 1 finishes */}
          {tailoredResume && (
            <Card className="space-y-2">
              <div className="flex items-center justify-between">
                <MetaLabel>Tailored résumé</MetaLabel>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadResumePdf({
                      resumeText: tailoredResume,
                      jobTitle: approvedJob?.title,
                      company: approvedJob?.company,
                    })
                  }
                >
                  Download ATS PDF
                </Button>
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-control border border-border bg-canvas p-3 font-mono text-[13px] text-fg">
                {tailoredResume}
              </pre>
            </Card>
          )}

          {/* Cover letter — placeholder while writing, then content */}
          {(packetStatus === "cover" || packetStatus === "ok") && (
            <Card className="space-y-2">
              <MetaLabel>Cover letter</MetaLabel>
              {coverLetter ? (
                <pre className="whitespace-pre-wrap rounded-control border border-border bg-canvas p-3 text-[13px] text-fg">
                  {coverLetter}
                </pre>
              ) : packetStatus === "cover" ? (
                <p className="text-sm text-muted">Writing… ({elapsed}s)</p>
              ) : (
                <p className="text-sm text-faint">Cover letter wasn&rsquo;t generated.</p>
              )}
            </Card>
          )}

          {/* Skills learning plan (on demand) */}
          {packetStatus === "ok" && (
            <Card className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <MetaLabel>Skills to work on</MetaLabel>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted">
                    Ready in
                  </span>
                  <select
                    value={planTimeframe}
                    onChange={(e) => setPlanTimeframe(e.target.value)}
                    disabled={learningStatus === "loading"}
                    className="h-8 rounded-control border border-border bg-canvas px-2 text-[13px] text-fg outline-none focus:border-border-strong"
                  >
                    <option value="1 week">1 week</option>
                    <option value="2 weeks">2 weeks</option>
                    <option value="1 month">1 month</option>
                    <option value="3 months">3 months</option>
                  </select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={generateLearningPlan}
                    disabled={learningStatus === "loading"}
                  >
                    {learningStatus === "loading"
                      ? "Generating..."
                      : learningPlan
                        ? "Regenerate"
                        : "Generate learning plan"}
                  </Button>
                </div>
              </div>
              {learningStatus === "error" && (
                <p className="text-sm text-warn">Couldn&rsquo;t generate the plan. Try again.</p>
              )}
              {learningPlan ? (
                <pre className="whitespace-pre-wrap rounded-control border border-border bg-canvas p-3 text-[13px] text-fg">
                  {learningPlan}
                </pre>
              ) : (
                learningStatus !== "loading" && (
                  <p className="text-sm text-faint">
                    Pick how soon you want to be ready for this job, then generate — you&rsquo;ll get
                    a week-by-week plan (free resources + a project per gap) that fits that window.
                  </p>
                )
              )}
            </Card>
          )}

          {/* Company research (on demand, honest/web-sourced) */}
          {packetStatus === "ok" && approvedJob?.company && (
            <Card className="space-y-2">
              <div className="flex items-center justify-between">
                <MetaLabel>Company research</MetaLabel>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={researchCompany}
                  disabled={researchStatus === "loading"}
                >
                  {researchStatus === "loading"
                    ? "Researching..."
                    : companyResearch
                      ? "Refresh"
                      : "Research company"}
                </Button>
              </div>
              {researchStatus === "error" && (
                <p className="text-sm text-warn">Research failed. Try again.</p>
              )}
              {companyResearch ? (
                <p className="whitespace-pre-wrap text-sm text-fg">{companyResearch}</p>
              ) : (
                researchStatus !== "loading" && (
                  <p className="text-sm text-faint">
                    An honest, web-sourced brief on {approvedJob.company} — only verified info, no
                    made-up facts.
                  </p>
                )
              )}
            </Card>
          )}

          <div>
            <Button variant="ghost" onClick={() => setStep(2)}>
              ← Back to jobs
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
