# JobPacket — Full Code & Design Audit

Goal: make it bulletproof. Every finding below is either **[V] verified** (I ran it /
read the exact code / measured it in the browser) or **[L] likely** (strong pattern
match, worth confirming). Audit date: 2026-06-10. Stack: Next.js 16, React 19, node:sqlite.

## TL;DR severity counts
- **P0 (fix before calling it bulletproof):** 4
- **P1 (should fix):** 7
- **P2 (polish):** 6
- **Strong foundation (keep):** listed at the bottom.

---

## P0 — Correctness / must-fix

| # | Area | File | Issue | Fix | Conf |
|---|------|------|-------|-----|------|
| P0-1 | Stale UI data | `app/jobs/page.tsx:11` | `SOURCES` is **hardcoded to `[naukri, linkedin, indeed]`** — the fragile scrapers that need Python. It does NOT include the real reliable sources (ATS/Adzuna/JSearch). So the standalone "Find Jobs" page silently only offers broken sources. | Fetch sources from `GET /api/search` like `/packet` does, or import the registry. | V |
| P0-2 | No error boundary | `app/` | No `error.tsx` / `global-error.tsx` / `not-found.tsx`. Any unhandled client throw shows Next's raw error overlay (dev) or a blank/ugly screen (prod). | Add `app/error.tsx` (reset button) + `app/not-found.tsx`. | V |
| P0-3 | No git checkpoint / CI | repo | **17 files uncommitted**, zero commits, no `.github/workflows`. The entire product is one `rm` away from gone, and nothing enforces `test`/`typecheck`/`build` on change. | `git commit` now; add a CI workflow running typecheck + test + build. | V |
| P0-4 | PDF drops non-Latin text | `lib/pdf/resume-pdf.ts` | jsPDF's built-in Helvetica is **WinAnsi-encoded** — Devanagari names, many accented chars, and smart quotes/em-dashes render as garbage or boxes. For an India-first tool with names like "Kavyā" or Hindi text, the ATS PDF can corrupt the candidate's own name. | Embed a Unicode TTF (e.g. NotoSans) via `doc.addFont`, or sanitize/transliterate before render. | L (verify with a non-ASCII résumé) |

---

## P1 — Robustness / should-fix

| # | Area | File | Issue | Fix | Conf |
|---|------|------|-------|-----|------|
| P1-1 | Mobile layout overflow | `components/site-header.tsx` | **Measured:** at 375px the nav is 423px wide → **49px horizontal scroll** on every page. The 4 nav links + tagline don't wrap or collapse. | Responsive nav: wrap, shrink, or a hamburger under `sm`. Hide the "STOP SPRAYING" tagline on small screens. | V (measured in browser) |
| P1-2 | Two scorers disagree | `tailor-engine/tailor.ts` vs `skills/match.ts` | Packet before/after uses the **legacy keyword `scoreResume`**; the jobs list uses **AI `matchSkills`**. Same job can show two different scores. | Unify on `matchSkills` everywhere (also in FIDELITY.md P1). | V |
| P1-3 | `addedSkills` low recall | `tailor-engine/tailor.ts` | "Skills tailoring added" is computed with the **~40-word keyword vocab**, so most real additions are missed → the honesty guard under-reports. | Compute against the AI-extracted skill set, not the vocab. | V |
| P1-4 | No server-side limit cap | `app/api/search/route.ts` | `limit` is taken from the request (`?? 15`) with **no upper bound**; a client could request a huge number. Low impact (local, single-user) but unbounded. | Clamp `limit` to e.g. ≤ 50. | V |
| P1-5 | No component/page tests | `src/app/**` | 112 tests cover lib logic; **zero cover the React pages/wizard** (the most complex, most-changed code). Regressions there are invisible to CI. | Add a few render/interaction tests (Testing Library) or Playwright smoke tests for the wizard flow. | V |
| P1-6 | node:sqlite is experimental | `lib/db/*` | `node:sqlite` is an **experimental** Node API — it emits a runtime warning and its API can change between Node majors. Pinning to it risks breakage on a contributor's different Node. | Document the required Node version (≥22), or swap to `better-sqlite3` for stability. | V |
| P1-7 | DB connection never closed | `lib/db/packets.ts`, `jd-cache.ts` | Two separate module-singleton `DatabaseSync` handles open the same file and are never closed. Fine for a long-lived server, but two writers to one SQLite file can contend; and tests that import both share global state. | Use one shared connection module for both tables. | L |

---

## P2 — Polish / hardening

- **P2-1** No `rate limiting / auth` on API routes — acceptable for local-first, **must revisit before any hosted deploy**.
- **P2-2** Provider detection spawns `--version` probes; cached 60s for CLI agents but the Ollama HTTP probe + env scan run per `getChatProviders` call. Cache the whole provider list.
- **P2-3** `cleanCvText` collapses all structure to flat text (root cause in FIDELITY.md) — also means the PDF can't guarantee sections.
- **P2-4** Markdown from the learning plan / company research is shown as raw text in `<pre>` — fine, but a tiny markdown renderer would read better.
- **P2-5** No `loading.tsx` route-level fallbacks; navigations between pages have no skeleton.
- **P2-6** `.env.example` exists but README doesn't yet document the `JOBPACKET_DB_PATH` / Node-version requirements for contributors.

---

## Design review (live, screenshots in both themes + mobile)

**What's good:** the "Quiet Tool" system renders cleanly and consistently in **both light
and dark** (verified) — typography, card spacing, the single-blue accent, score-badge
color coding all look intentional and calm. Desktop layout (max-w-5xl) is well-composed.
The stepper, chips, and progress states read clearly.

**Issues found:**
1. **[P1-1] Mobile nav overflow** (measured +49px) — the only hard layout bug. Header
   nav must collapse/wrap under ~480px.
2. **Logo tagline crowding** — "STOP SPRAYING" sits awkwardly beside the wordmark and
   competes on narrow widths. Hide it `< sm`.
3. **No error/empty polish at the route level** — see P0-2; a thrown error currently has
   no branded fallback.
4. **Long single-column text blocks** (résumé/cover/JD in `<pre>`) are readable but dense;
   a max-width on the prose and slightly larger line-height would improve scanning.

Otherwise the design is genuinely solid for an MVP — the fixes are targeted, not a redo.

---

## Recommended "bulletproof" order
1. **Commit + add CI** (P0-3) — stop the bleeding first.
2. **Fix the stale `/jobs` sources** (P0-1) and **add error/not-found pages** (P0-2).
3. **Fix mobile nav** (P1-1) — the one real design bug.
4. **Unify the scorers + addedSkills** (P1-2, P1-3) — correctness + honesty.
5. **PDF Unicode** (P0-4) and **limit clamp** (P1-4).
6. **Page/flow tests** (P1-5) + document Node version (P1-6).
7. Polish (P2) + the FIDELITY.md structural upgrade when ready.

## Strong foundation (don't touch — it's good)
- Honest, deterministic `matchSkills` + no-fabrication tailoring guard.
- Subprocess safety: `runPython` uses arg arrays (no shell); CLI agents use `shell:true`
  but pass the prompt via **stdin**, so no shell-injection surface. **[V]**
- No `dangerouslySetInnerHTML`, no `eval`, no dynamic `process.env[...]`. **[V]**
- `parse-cv` has a 10MB cap, type guard, and structured (non-throwing) errors. **[V]**
- TypeScript `strict` + `noUncheckedIndexedAccess`; pure logic well unit-tested (112 tests).
- Reliable API job sources (don't break); JD-skill caching; `.env.local` gitignored.
