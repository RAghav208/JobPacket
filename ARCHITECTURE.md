# JobPacket — Architecture

> This reflects the code as it stands today. (A fuller product/validation design
> doc lives outside the repo; this is the engineering view contributors need.)

## What it is

A **local-first** Next.js app: you run it on your own machine, your CV and data
never leave it, and it uses whatever AI agent you already have (Claude Code,
Codex, Gemini CLI, Ollama, or an API key). It turns a CV into ranked, real job
matches and (in progress) a complete application packet per job.

**The funnel:**

```
Upload CV ─► AI extracts skills (editable) ─► AI suggests roles (editable)
   ─► search real jobs from multiple sources ─► AI extracts each JD's skills
   ─► deterministic match vs CV ─► ranked best-fit first
   ─► (Stage 4+) approve one ─► packet: tailored resume + gap + cover letter
```

## Core principle: honest, reproducible scoring

AI does the **extraction** (skills from CV and JDs — accurate, current). The
**matching/score is deterministic** ([`src/lib/skills/match.ts`](src/lib/skills/match.ts)):
a required skill the CV doesn't have is always "missing", so the score can't be
inflated and is reproducible. The user sees and can edit the extracted skills, so
an AI over-claim is caught. Tailoring never fabricates; any skill it adds is
flagged for user confirmation.

## Modules (`src/lib`)

| Module | Responsibility |
|--------|----------------|
| `cv/` | Parse uploaded PDF/DOCX/TXT → text (`unpdf`, `mammoth`). Pure `detectKind`/`cleanCvText`. |
| `skills/` | `extract-skills` (AI, single + **batched** JD extraction) and `match` (deterministic, alias-normalized, honest ceiling). **The current scoring path.** |
| `roles/` | `extract-ai` (AI role suggestions) + `roles` (deterministic skill→role fallback). |
| `provider-registry/` | Detect + invoke AI backends. CLI agents (`claude`/`codex`/`gemini`, prompt via stdin), Ollama HTTP, then API keys. `getFallbackChatProvider` tries each in order, skipping failures. |
| `job-sources/` | `JobSource` adapters behind one interface (see below). |
| `tailor-engine/` | Tailor a resume to a JD (honest, added-skills flagged) + cover-letter prompt. |
| `packet/` | Assemble the per-job packet (resume + gap + cover letter). Wiring into the UI = Stage 4. |
| `score-engine/` | Legacy deterministic keyword scorer (still used by the standalone `/` Quick Score page and as the no-AI skills fallback). `synonyms.json` is reused by `skills/match` purely for alias normalization. |

### Job sources (`src/lib/job-sources`)

All implement `JobSource { id, label, requiresPython, isAvailable(), search() }`.
Registered in `index.ts`, reliable ones first. The UI dropdown is populated from
`GET /api/search` — adding a source needs no UI change.

| Source | How | JD | Key? | Breaks? |
|--------|-----|----|----|---------|
| `ats` | Public JSON APIs of Greenhouse/Lever/Ashby over a curated company list (`ats-companies.json`) | Full | no | No |
| `adzuna` | Adzuna India API | ~500-char | free key | No |
| `jsearch` | RapidAPI JSearch (Google for Jobs: LinkedIn/Indeed/boards) | Full | free key | No |
| `naukri`/`linkedin`/`indeed` | JobSpy via a Python subprocess | varies | no | Yes (scraping) |

Reliable sources are pure TS `fetch`. Scrapers shell out to `jobspy-runner.py`
and are gated behind `isAvailable()` so the core app never needs Python.

## App (`src/app`)

- `/packet` — the wizard (CV → skills → roles → jobs). Client component; calls server actions + API routes.
- `/` — standalone Quick Score (paste resume + JD). `/jobs` — standalone search.
- `api/parse-cv` — file upload → text. `api/search` — run a source (POST) / list sources (GET). `api/providers` — list detected AI agents.
- Server actions (`src/lib/actions`): `tailorAction`, `suggestRolesAction`, `extractCvSkillsAction`, `scoreJobsAction` — all take an optional `providerId` for the UI's agent picker.

## Environment (`.env.local`, gitignored)

- `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` — Adzuna (free).
- `RAPIDAPI_KEY` — JSearch (free).
- AI is auto-detected (no key needed if you have Claude Code/Codex/Gemini/Ollama). API keys (`ANTHROPIC_API_KEY`, etc.) also work.
- Optional: `JOBPACKET_PYTHON`, `OLLAMA_HOST`.

## Testing

`npm test` (Vitest) — pure logic is unit-tested: skill extraction parsers,
deterministic matching + honest ceiling, provider request builders, job-source
mappers/filters, CV parsing. Live API/agent calls are verified manually.

## Status

Done: CV parse, AI skills, AI roles, provider registry + CLI agents, three
reliable job sources + scrapers, search → AI-scored → ranked.
Next: Stage 4 packet (tailored resume + gap + cover letter), then company
research (web), skills learning plan, save/download history, `npx jobpacket`.
