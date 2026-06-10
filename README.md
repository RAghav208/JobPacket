# JobPacket

**Stop spraying. Start sniping.** JobPacket shows Indian job seekers *why* their applications vanish into silence, and fixes it in one click.

Most freshers blast one generic resume at 50–200 listings. ATS filters auto-reject ~75% before a human ever looks. JobPacket makes that invisible cost visible: it scores your resume against a real job description, shows you the exact skills you're missing, and tailors your resume to surface what you already have.

It's **local-first** (your data never leaves your machine), **free to run** (uses a bundled local model, or whatever AI you already have configured), and **India-focused** (scoring mirrors how Naukri-style ATS actually parse resumes).

> Status: early build, but the full loop runs — a Next.js web UI where you score a resume against a JD, tailor it with your own AI, and pull live jobs from India's boards.

## The idea in one screen

```
  THE GAP
  ─────────────────────────────────────────────
  Match score:  █████████████░░░░░░░ 67%
  Matched 6 of 9 skills this job asks for. Missing: Java, Data Science, Publications.

  ✓ Matched: Python, C++, Machine Learning, Deep Learning, NLP (via "nlp"), Research
  ✗ Missing: Java, Data Science, Publications

  Tailoring can re-surface skills you have but buried.
  It cannot invent the ones that are genuinely missing. The score stays honest.
```

## Run it

```bash
npm install
npm run dev       # web UI at http://localhost:3000  (paste resume + JD → see the gap)
npm test          # 38 passing — including the honest-ceiling guarantee
npm run demo      # CLI version: prints "THE GAP" for a sample resume + JD

# score your own files from the CLI:
npm run demo -- path/to/resume.txt path/to/job-description.txt
```

Tailoring uses whatever AI you already have (a running Ollama, or an
`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` in your env) — no setup form.
Job scraping uses [JobSpy](https://github.com/speedyapply/JobSpy); the app prompts you
to `pip install python-jobspy` the first time you search, and the rest of the app works
without it.

## How it works

- **Score engine** (`src/lib/score-engine/`) — a pure, dependency-free TypeScript module.
  It extracts the skills a job asks for, checks your resume for each (exact match +
  a curated synonym map, e.g. `JS → JavaScript`), and returns an **explainable**
  result: a matched list, a missing list, and a 0–100 score. It never inflates the
  score past what your resume truthfully shows. That honesty is the whole point.
- **Synonyms** (`src/lib/score-engine/synonyms.json`) — a plain data file. Add a
  skill alias via PR, no code changes needed. Good first contribution.

## Roadmap

- [x] Explainable score engine (exact + synonym matching, honest ceiling)
- [x] `ProviderRegistry` — auto-detect your existing Claude/OpenAI/Gemini/Ollama setup
- [x] AI resume tailoring (re-surface buried skills, never fabricate; added skills flagged for confirmation)
- [x] Job scraping via JobSpy (Naukri, LinkedIn, Indeed) behind a pluggable adapter
- [x] Web UI (score page + job search), "Quiet Tool" design
- [ ] Embedding fallback for unmatched terms (local, via Transformers.js)
- [ ] Bulk tailoring (score & tailor against many jobs at once)
- [ ] Internshala + company-career-page (Greenhouse/Lever/Workday) adapters
- [ ] `npx jobpacket` packaging

See [ARCHITECTURE.md](ARCHITECTURE.md) for how it's built and [DESIGN.md](DESIGN.md) for the design system.

## Contributing

Early days — issues and PRs welcome. The synonym map and India-specific skill
vocabulary are the easiest places to start.

## License

MIT © 2026 Raghav Kejriwal
