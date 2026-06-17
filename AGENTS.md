# Allspin Trainer — Agent Notes

Playable TETR.IO-oriented drill sandbox. See `plans/` for full context.

## Verify commands

Run these before considering work done:

```bash
npm run typecheck   # tsc -b --noEmit (strict)
npm run lint        # eslint .
npm run format:check # prettier --check .
npm run test        # vitest run
npm run build       # tsc -b && vite build
```

`npm run dev` starts the Vite dev server.

## Architecture boundaries (MVP 1)

- `src/engine/` — board, pieces, ruleset, SRS+/180 kicks, line clears, history. UI-agnostic.
- `src/input/` — keybinds, handling (DAS/ARR/DCD/SDF), input controller.
- `src/loop/` — `requestAnimationFrame` game loop; owns timing, feeds engine, emits snapshots. React does not drive game rules.
- `src/drills/` — canonical JSON drill format, loader, solution matcher, packs.
- `src/fumen/` — `tetris-fumen` adapter only. Engine/drills do not import fumen directly.
- `src/ui/` — thin React components rendering from engine snapshots.

React must not own engine/input timing. Engine board cells are concrete only (no wildcards). B2B/combo are display-only drill metadata until spin/B2B classification exists.
