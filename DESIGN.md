# JobPacket — Design System

JobPacket uses the **"Quiet Tool"** visual system: monochrome, calm, serious (no
gamification), with a single blue accent for "live/active". Light by default,
automatic dark via `prefers-color-scheme` (no toggle, no flash). The goal is a
tool that feels precise and trustworthy — which matters, because the product's
whole promise is an *honest* score.

Source of truth for tokens: [`src/app/globals.css`](src/app/globals.css).

## Principles

- **Subtraction first.** Every element earns its pixels. No decoration.
- **One signal colour.** Blue (`--signal`) means active/selected/in-progress. Green = good fit, amber = gap/warning. Nothing else is coloured.
- **Mono for metadata.** Labels, skill chips, and scores use the mono font so data reads as data.
- **Anti-AI-slop.** No gradients-for-the-sake-of-it, no emoji soup, no glassmorphism. Flat, bordered, quiet.

## Color tokens

Semantic tokens (Tailwind utilities: `bg-canvas`, `text-fg`, `text-muted`, `border-border`, `bg-ink`, `text-signal`, `text-good`, `text-warn`, …).

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `canvas` | `#f6f7f9` | `#0c0d10` | page background |
| `surface` | `#ffffff` | `#141519` | cards |
| `hover` | `#ebedf1` | `#1a1b21` | hover states |
| `fg` | `#0c0c0e` | `#ededf0` | primary text |
| `muted` | `#6b6b73` | `#9395a0` | secondary text |
| `faint` | `#9a9aa2` | `#65676f` | tertiary / hints |
| `border` | `#e4e7ec` | `#24262c` | default borders |
| `border-strong` | `#d4d8df` | `#30323a` | focused inputs |
| `track` | `#e9ebf0` | `#23252b` | progress track |
| `ink` / `on-ink` | `#111114` / `#fff` | `#f2f2f4` / `#0c0d10` | primary buttons |
| `signal` / `signal-weak` | `#2f6feb` / `#eaf1fe` | `#5b8cff` / `#16213c` | active, mid-fit score |
| `good` / `good-weak` | `#1a7f37` / `#e6f4ea` | `#7ee787` / `#16271a` | matched, high fit |
| `warn` / `warn-weak` | `#b5532a` / `#fbeee6` | `#ffa657` / `#2a1c12` | missing, setup needed |

## Typography

Loaded via `next/font/google` in `src/app/layout.tsx`:

- **Display** — Space Grotesk (`font-display`): headings.
- **Body** — Hanken Grotesk (`font-sans`, default): prose, UI.
- **Mono** — JetBrains Mono (`font-mono`): labels, skill chips, scores, code/JD text.

## Radii

`--radius-frame` 12px · `--radius-card` 9px (`rounded-card`) · `--radius-control` 7px (`rounded-control`).

## Components

- **Button** (`src/components/ui/button.tsx`) — variants `primary` (`bg-ink`), `secondary` (bordered surface), `ghost`; sizes `sm`/`md`. Focus ring uses `signal`.
- **Card** (`src/components/ui/card.tsx`) — `rounded-card border border-border bg-surface p-5`.
- **MetaLabel** — mono, uppercase, 10.5px, `tracking-[0.06em]`, `text-muted`. Section labels.
- **Skill / role chips** — `rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px]`. Selected/editable variants tint with `signal-weak`.
- **Score badge** — `rounded-full border` pill; colour by fit: ≥75 `good`, ≥45 `signal`, else `warn`.
- **Stepper** — numbered circles; active = `bg-ink`, done = `good-weak`, upcoming = bordered `faint`.

## Conventions for contributors

- Use semantic tokens, never raw hex. If you need a new colour, add a token in `globals.css` first.
- New surfaces = `Card`. New labels = `MetaLabel`. New actions = `Button`.
- Keep the page calm: prefer one accent, lots of `border`/`muted`, generous whitespace.
- Test both light and dark (toggle your OS theme) — every token has a dark value.
