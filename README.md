# JobPacket

**Stop spraying. Start sniping.** A local-first, India-focused toolkit that turns your
CV into ranked, real job matches — and builds a complete application packet for any one
of them: a tailored résumé, an honest gap analysis, a cover letter, a timeframe-paced
learning plan, and web-sourced company research.

Most freshers blast one generic résumé at 100+ listings, and ~75% get auto-rejected by
ATS keyword filters before a human looks. JobPacket shows you *why* — and fixes it.

> **Local-first & private.** It runs on your machine, your CV never leaves it, and it
> uses whatever AI you already have (Claude Code / Codex / Gemini CLI, a local Ollama,
> or an API key). No account, no backend, no telemetry.

## What it does

- **Scan your CV** (PDF/DOCX) → AI-extracted, editable skills.
- **Suggest roles** to search for, from your CV.
- **Find jobs** across reliable sources — company boards (Greenhouse/Lever/Ashby),
  Adzuna, and JSearch (LinkedIn/Indeed via Google for Jobs) — no fragile scraping
  required.
- **Score every job** against your CV with a deterministic, explainable match (it tells
  you exactly which skills match and which are missing — and never inflates the number).
- **Build a packet** for any job: honest tailored résumé (ATS-PDF export), gap analysis,
  cover letter, a learning plan paced to *how soon you want to be ready*, and a
  web-sourced company brief.
- **Saved locally** (SQLite) so packets are never regenerated and you can revisit them.

## Quick start

```bash
git clone https://github.com/RAghav208/JobPacket.git
cd JobPacket
npm install
npm run dev          # http://localhost:3000
```

Requirements: **Node 22+** (the local store uses Node's built-in `node:sqlite`).

**AI is auto-detected** — if you have Claude Code (`claude`), Codex, Gemini CLI, or a
running Ollama, JobPacket uses it. No setup. You can also set an API key
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`). Without any AI, scoring still
works via a keyword fallback.

**Optional keys** for broader job coverage (copy `.env.example` → `.env.local`):
- `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` — free from [adzuna.com/developer](https://developer.adzuna.com/)
- `RAPIDAPI_KEY` — free [JSearch](https://rapidapi.com/) plan

## How it works

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full pipeline and
[DESIGN.md](DESIGN.md) for the UI system. In short: CV → AI skills → AI roles →
multi-source search → deterministic scoring → packet, all local.

## Known limitations

- **Scraper sources (Naukri/LinkedIn/Indeed via JobSpy)** need Python and are fragile;
  the reliable API sources above are the default.
- **PDF export** uses a Latin font — non-Latin scripts (e.g. Devanagari) aren't embedded yet.
- **Company research** only summarizes verified public text; for companies it can't find,
  it honestly says so rather than inventing.

## ⚠️ Responsible use

JobPacket can pull job listings from third-party sites. The scraper-backed sources may be
subject to those sites' Terms of Service — use them for **personal job-seeking only**,
respect rate limits, and prefer the official-API sources. You are responsible for how you
use the data. This project is not affiliated with any job board.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Easy first wins: add company board
tokens or skill synonyms.

## License

MIT © Raghav Kejriwal — see [LICENSE](LICENSE).
