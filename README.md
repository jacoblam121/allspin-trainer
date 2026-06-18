# Allspin Trainer

Playable TETR.IO-oriented drill sandbox (MVP 1).

Allspin Trainer is a focused environment for practicing advanced midgame
patterns (T-spins, O-spins, stacks, finesse). The drill model is
JSON-canonical; the engine is UI-agnostic; the React layer is a thin view
over engine snapshots driven by a `requestAnimationFrame` loop.

## Run

```bash
npm install
npm run dev      # Vite dev server on :5173
```

## Verify

Before considering a change done, all of the following must pass:

```bash
npm run typecheck     # tsc -b --noEmit (strict)
npm run lint          # eslint .
npm run format:check  # prettier --check .
npm run test          # vitest run
npm run build         # tsc -b && vite build
git diff --check
```

## MVP 1 Scope

In scope:

- 5 small, verified MVP drills (`src/drills/packs/mvp1.json`).
- Static queues and strict accepted-route matching.
- SRS / SRS+ / 180 rotation kicks; 7-bag piece pool.
- TETR.IO-style handling: DAS, ARR, DCD, SDF, gravity.
- Fumen export of the current locked board (visible 20 rows only).
- Keybind / handling settings panel with localStorage persistence.

Out of scope (deferred):

- Fumen import, playable import, draft drills, import preview.
- Active-piece fumen operation export.
- Randomized queues, route variants, queue variants.
- Outcome / final-board matching.
- Spin / B2B / combo classification.
- Evaluator, solver, pathfinding replay.
- ARE / lock-delay finesse tuning.
- CV / TETR.IO integration, botting, multiplayer.
- Broad curriculum generation.
- Visual board rendering of accepted solutions (currently shown as text coordinates + explanation; a fumen-style step-by-step board view is the eventual goal).
- Settings layout overhaul.
- UI / jsdom automated tests.
- Canvas renderer migration.
- Redo.

## Controls and Settings Persistence

Controls are configured via the Settings panel. All keybinds (move / softDrop
/ hardDrop / rotate / hold / reset / undo / toggleSolution) and handling
(DAS, ARR, DCD, SDF, gravity) are persisted to `localStorage` under the key
`allspin.settings.v1`. Stored payloads with an unknown version, a parse
error, or cross-action duplicate bindings are dropped back to defaults; the
load is partial — per-action / per-field overrides apply on top of the
defaults when structurally valid.

## Fumen Export

The Tools section in the drill panel exports a [tetris-fumen](https://github.com/knewjade/tetris-fumen)
code for the current locked board. The export is read-only and is intentionally
narrow:

- Exports the visible 20-row playfield (rows `y=0..19`).
- Exports the current locked cells only: `null` -> empty,
  `{kind:"filled", piece}` -> matching fumen piece (`I`/`J`/`L`/`O`/`S`/`T`/`Z`),
  `{kind:"garbage"}` -> fumen `X`.
- Does **not** export the active piece, ghost, hold, queue, accepted
  routes, settings, B2B / combo metadata, or any drill field besides the
  board.
- Does **not** export cells above the visible 20 rows. If a locked cell
  exists at `y >= 20` (the engine's hidden spawn band), the export fails
  with an inline error rather than silently dropping data.

`Drill.fumen?` (per-drill, optional) is author reference metadata only. It
is **not** rendered in the UI, **not** validated, and **not** used as a
canonical source.

`src/fumen/` is the only directory in the project that imports
`tetris-fumen`; the engine and drill loader are decoupled from the
dependency so fumen can be swapped or removed without disturbing the core.

## Drill JSON Is Canonical

`src/drills/packs/mvp1.json` is the source of truth for drills. The engine
does not interpret a separate drill DSL; the loader (`src/drills/drillLoader.ts`)
parses, validates, and rejects malformed input. A `Drill` includes:

- `id`, `title`, `category`, `tags`, optional `source` URL.
- `ruleset` (currently `"tetrio-default"`).
- `board`: bottom-origin rows of width 10. Each cell is `null`,
  `{kind:"garbage"}`, or `{kind:"filled", piece}`.
- `active` piece, `hold` (must be `null` at drill start), and `queue`.
- Optional `b2bActive`, `combo`, `garbageHoleColumn` — display metadata.
- `goal` and at least one `acceptedSolutions` entry (each with at least one
  authored `placement` and an `explanation`).
- Optional `badTemptations` listing anti-patterns to highlight when the
  solution is shown.
- Optional `fumen?` — author reference only.

A `Drill` is statically authored; there is no randomization, no route
variants, no queue variants, and no outcome matching in MVP 1.

## Architecture Boundaries

The codebase is split into single-responsibility folders. Boundaries
enforced by convention:

- `src/engine/` — board, pieces, ruleset, SRS / SRS+ / 180 kicks, line
  clears, engine state. **UI-agnostic.**
- `src/input/` — keybinds, handling (DAS / ARR / DCD / SDF), input
  controller.
- `src/loop/` — `requestAnimationFrame` game loop; owns timing, feeds
  engine, emits snapshots. **React does not drive game rules.**
- `src/drills/` — canonical JSON drill format, loader, solution matcher,
  packs.
- `src/fumen/` — `tetris-fumen` adapter only. Engine / drills **must not**
  import `tetris-fumen` directly.
- `src/ui/` — thin React components rendering from engine snapshots.
- `src/styles/` — global CSS.

## Repository Layout

```
src/
  App.tsx                       # Top-level React app; guards bundled pack load
  main.tsx                      # React entry
  engine/
    board.ts                    # Field = BoardCell[][] (y=0 bottom-origin)
    board.test.ts
    constants.ts                # BOARD_WIDTH, VISIBLE_HEIGHT, FIELD_HEIGHT
    gameState.ts                # createEngineFromDrill, engine commands
    gameState.test.ts
    pieces.ts
    pieces.test.ts
    ruleset.ts                  # SRS / SRS+ / 180 kicks
    ruleset.test.ts
    tetrominoes.ts              # cellsOf(piece, rotation, x, y)
    tetrominoes.test.ts
  drills/
    drillLoader.ts              # JSON validator; rejects empty + duplicate ids
    drillLoader.test.ts
    drillTypes.ts
    solutionMatcher.ts          # Compares placement history to accepted routes
    solutionMatcher.test.ts
    mvp1Pack.test.ts            # Pack-level placement-collision smoke test
    packs/
      mvp1.json                 # 5 verified MVP drills
  fumen/
    fumenAdapter.ts             # exportVisiblePlayfieldToFumen(field)
    fumenAdapter.test.ts
  input/
    defaultSettings.ts
    handling.ts                 # DAS / ARR / DCD / SDF / gravity
    inputController.ts          # Key state, repeat timers, intent dispatch
    keybinds.ts
    settings.ts                 # localStorage persistence
  loop/
    gameLoop.ts                 # rAF loop, phase tracking, intent dispatch
    gameLoop.test.ts
    snapshotChanged.ts
  ui/
    Board.tsx
    DrillPanel.tsx              # Drill list + accepted solution + Tools
    HoldQueue.tsx
    PiecePreview.tsx
    SettingsPanel.tsx
    useTrainer.ts               # Hook wiring engine + controller + loop
  styles/
    index.css

plans/                          # Plan / handoff docs (local-only)
images/                         # Static assets
```

## Error States

- **Pack-load failure** — fatal app-level: the entire trainer UI is
  replaced with a `Bundled drill pack is invalid: <error>` message. The
  pack loader is the gate; if it throws, no engine or loop is constructed.
- **Per-drill engine-init failure** — board-area error inside the trainer
  shell. The rest of the shell (drill list, settings) remains usable so the
  user can pick a different drill.
- **Fumen export failure** — inline `role="alert"` inside the Tools
  section of the drill panel. The engine, match state, reset, undo, and
  settings are unaffected.
- **Clipboard failure** — the textarea is left visible and a manual-copy
  hint is shown. `document.execCommand` is not used.

## Manual Smoke (Sprint 5)

After `npm run dev`:

1. Open `http://localhost:5173/`, pick a drill, lock a few pieces.
2. Click **Export fumen**, then **Copy code**. Paste into
   [harddrop.com/fumen/](https://harddrop.com/fumen/) (or any fumen
   viewer). Confirm the 20-row locked field renders as expected.
3. Press **Reset** and **Undo** after the export attempt — both must
   still work.
