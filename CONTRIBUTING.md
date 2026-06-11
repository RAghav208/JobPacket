# Contributing to JobPacket

Thanks for your interest! JobPacket is a local-first, India-focused job-application
toolkit. Contributions of all sizes are welcome.

## Getting set up

```bash
git clone https://github.com/RAghav208/JobPacket.git
cd JobPacket
npm install
npm run dev        # http://localhost:3000
```

Requirements: **Node 22+** (the local packet store uses Node's built-in `node:sqlite`).

## Before you open a PR

Run the same checks CI runs:

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest (pure logic is unit-tested)
npm run build       # next build
```

All three must pass. Keep new logic in pure, testable modules under `src/lib/`
where possible, and add tests alongside (`*.test.ts`).

## Good first contributions

- **More company boards** — add Greenhouse/Lever/Ashby tokens to
  [`src/lib/job-sources/ats-companies.json`](src/lib/job-sources/ats-companies.json).
  Verify the token returns jobs before adding it.
- **Skill synonyms** — extend
  [`src/lib/score-engine/synonyms.json`](src/lib/score-engine/synonyms.json).
- **A new job source** — implement the `JobSource` interface in
  `src/lib/job-sources/` (see `ats.ts` / `adzuna.ts` as templates).

## Principles

- **Honesty over flattery.** The scoring is deterministic and explainable; tailoring
  never fabricates experience. Keep it that way.
- **Local-first.** A user's CV and data stay on their machine. Don't add telemetry
  or send data anywhere it doesn't need to go.
- **Reliable sources over scraping.** Prefer stable APIs; scrapers are best-effort.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together and
[DESIGN.md](DESIGN.md) for the UI system.
