# JobPacket — Fidelity Audit & Upgrade Plan

How we process the résumé today, where it falls short of a "high-fidelity" tool,
and concrete, research-grounded changes. (Audit date: 2026-06-10.)

## How the résumé flows today

```
PDF/DOCX ─► unpdf/mammoth ─► cleanCvText() ─► ONE FLAT TEXT BLOB
                                                   │
            AI extracts a flat skill list ◄────────┤
                                                   │
   tailor: prompt("rewrite this résumé") ─► ONE FLAT TEXT BLOB (tailored)
                                                   │
   PDF: jsPDF dumps that text in Helvetica, line by line
```

Files: `cv/parse.ts`, `skills/extract-skills.ts`, `skills/match.ts`,
`tailor-engine/prompt.ts` + `tailor.ts`, `packet/cover-letter.ts`, `pdf/resume-pdf.ts`.

**What's already good (keep it):** the honest ceiling (deterministic `matchSkills`),
no-fabrication guard, JD-skill caching, multi-provider. The *correctness* is solid.
The *fidelity* is not.

## The core problem: the résumé is a flat string

Everything downstream is limited because we never build a **structured representation**
of the résumé (contact, summary, experience entries with bullets+dates, education,
projects, skills). High-fidelity tools (Reactive Resume, ResumeFlow, Teal) parse to a
schema first. Consequences of staying flat:

- Tailoring is an opaque "rewrite the whole thing" → we can't control or show *what*
  changed (which bullet, which section), can't enforce structure, can't re-template.
- The PDF is a text dump — section headers exist only if the LLM happened to write them.
- `addedSkills` is computed with the old ~40-word keyword vocab, so it misses most real
  additions.
- No way to edit, diff, or render multiple templates.

## Gaps vs. recommendations (prioritized)

### P0 — Structured résumé (the foundation everything compounds on)
**Change:** Parse the CV into a typed schema (adopt **JSON Resume** — the de-facto open
standard: `basics`, `work[]` with `highlights[]`, `education[]`, `projects[]`, `skills[]`).
AI extracts it once; validate with **Zod**.
**Why:** structured data = zero-parse-error rendering, precise tailoring, real diffs,
multiple templates, an edit UI later. *Grounded:* JSON Resume schema; LlamaIndex/Datumo
resume-extraction guides.
**Effort:** M. **This unblocks P0-tailor, P0-pdf, and the edit UI.**

### P0 — Structured, per-bullet tailoring with validated output
**Change:** Tailor the *structured* résumé, not free text. Ask the model to return JSON
(the same schema) editing bullets in place, with rules: strong action verbs, quantify
where the candidate's facts allow, mirror JD terminology, reverse-chronological, never
fabricate. Validate with Zod (Level-2/3 structured output, not regex). Produce a
**bullet-level diff** so the user sees exactly what changed and can accept/reject.
**Why:** specificity + constraints = better output (the #1 finding in the research);
structured output is "no longer optional" for production. *Grounded:* ResumeFlow (arXiv
2402.06221); "LLM Structured Output 2026"; ATS prompt guides.
**Effort:** M.

### P0 — Real ATS PDF template (not a text dump)
**Change:** Render the structured résumé into a single-column template with **standard
section headers** ("Experience", "Education", "Skills"), a clean contact block,
reverse-chronological entries, consistent bullets, selectable text. No tables, no columns,
no sidebars.
**Why:** **23% of ATS parsing failures are formatting**; only 2 of 8 ATS handle two
columns; Workday/Greenhouse want single-column + standard headers. Our current dump is
"selectable text" but has no guaranteed structure. *Grounded:* Jobscan, Enhancv 2025,
CVCraft 8-ATS test, Workday/Lever guides.
**Effort:** S–M (we already have jsPDF; render from schema instead of raw text).

### P1 — Scoring beyond keyword overlap
**Change:** (a) ship the planned **embedding fallback** (all-MiniLM, local) for skills the
synonym map misses; (b) weight **required vs preferred** skills (parse "required/must-have"
vs "preferred/nice-to-have" from the JD); (c) add light **title / years-of-experience**
signals. Keep matching deterministic + explainable.
**Why:** keyword overlap misses equivalent phrasing and treats all skills equally; weighted
+ semantic matching aligns better with how recruiters actually rank. *Grounded:* Resume2Vec
(MDPI), TalentCLEF 2025, ingedata talent-matching.
**Effort:** M. **Also fixes the current inconsistency** where the packet's before/after uses
the legacy keyword scorer while the jobs list uses AI `matchSkills`.

### P1 — Quality gate: ATS-lint + post-tailor re-score
**Change:** After tailoring, run an **ATS lint** (contact present? single column? standard
headers? length 1–2 pages? action verbs? quantified bullets? no first person?) and
**re-score** the tailored résumé against the JD. Show a "fidelity score" + checklist.
**Why:** closes the loop — proves the tailoring actually improved ATS-fit, and catches
regressions. *Grounded:* Jobscan-style ATS checkers; eval-after-generate best practice.
**Effort:** S–M.

### P2 — Polish
Few-shot examples in prompts; provider-native structured-output mode where available
(OpenAI `.parse`, Gemini `response_schema`); multiple PDF templates; an in-app résumé
editor on the structured data; DOCX export (Workday sometimes prefers DOCX).

## Suggested build order

1. **P0 structured résumé schema + AI extraction (Zod-validated).** Foundation.
2. **P0 structured tailoring + bullet diff.** Biggest perceived quality jump.
3. **P0 ATS PDF template from the schema.** Biggest *real* ATS-pass-rate jump.
4. **P1 scoring upgrade** (embeddings + required/preferred + unify the two scorers).
5. **P1 ATS-lint + re-score fidelity gate.**
6. **P2 polish** as desired.

Steps 1–3 together convert the tool from "LLM rewrites your text" to "structured,
template-rendered, ATS-validated résumé system" — that's the high-fidelity line.

## Sources
- [JSON Resume schema](https://jsonresume.org/schema) · [resume-schema (GitHub)](https://github.com/jsonresume/resume-schema)
- [ResumeFlow — LLM pipeline for personalized résumés (arXiv)](https://www.arxiv.org/pdf/2402.06221)
- [LLM Structured Output in 2026](https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk)
- [Parsing Résumés with LLMs (Datumo)](https://www.datumo.io/blog/parsing-resumes-with-llms-a-guide-to-structuring-cvs-for-hr-automation)
- [ATS formatting mistakes (Jobscan)](https://www.jobscan.co/blog/ats-formatting-mistakes/) · [ATS formatting rules 2026 (ResumeAdapter)](https://www.resumeadapter.com/blog/ats-resume-formatting-rules-2026)
- [Can ATS read tables/columns — 8 systems tested (CVCraft)](https://cvcraft.roynex.com/blog/can-ats-read-tables-columns-formatting-2026)
- [Resume2Vec (MDPI)](https://www.mdpi.com/2079-9292/14/4/794) · [Talent matching with embeddings (ingedata)](https://www.ingedata.ai/blog/2025/04/01/talent-matching-with-vector-embeddings/)
