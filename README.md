# Allspin Trainer

Playable TETR.IO-oriented drill sandbox (MVP 2 seed curriculum).

Allspin Trainer is a focused environment for practicing advanced midgame
patterns (all-spins, Core T-spins, stacks, finesse). The drill model is
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

## MVP 2 Seed Scope

Current scope (MVP 2 seed curriculum scaffold):

- A 12-drill seed pack (`src/drills/packs/mvp2-seed.json`) with 14 authored
  variants and 14 routed solutions: 8 all-spin drills (one with 2 variants)
  and 4 Core T-spin drills (one with 2 variants).
- Authored variants under one curriculum drill, with authored
  `hold: PieceId | null`.
- Outcome-mask success: a drill passes once the locked board matches an
  authored final-form mask; strict route matching is no longer the runtime
  pass/fail mechanism.
- Generated visual solution step-through: native board snapshots rendered
  from `buildSolutionSteps` replaying the authored placements, applying line
  clears, and validating the final field against the linked accepted
  outcome.
- A structured source catalog (`src/drills/sourceCatalog.json`) covering the
  all-spin, Core T-spin, and 6-3 / Hole Picture docs with playable / backlog
  / deferred entries.

Important content note: the current Sprint 4 seed drills prove the V2
authoring, loading, replay, outcome-mask, and catalog pipeline. They should
be treated as an intermediate technical scaffold, not authoritative all-spin
or Core T-spin curriculum. Before publishing the drills as real practice
content, each playable drill needs a domain-authoring pass against real
source diagrams or known playable setups, plus a human playability check in
the browser or another trusted Tetris environment.

Implicit modeling limit (still true in MVP 2): masks are shape-based. The
trainer can certify that the locked board reached an authored final form,
but it does not certify that the player performed a T-spin, all-spin, or
B2B-preserving clear. Drill goals and explanations use final-form, shape
recognition, residue, setup, and intended-route wording, and name the
model limit where the technique label could otherwise overpromise.

Final-form masks are acceptance targets, not the lesson by themselves. A
real drill should start from a meaningful board/queue context and train the
player to reach the accepted form. Empty-board synthetic shapes are useful
only as scaffolding until replaced or validated.

Two future learning modes are _named_ in MVP 2 docs but not yet built:

- **Guided**: the app shows the intended route / order / step boards up
  front and teaches how to build the target form.
- **Drill**: the app hides the route, checks only the accepted outcome mask,
  and trusts the player to use the intended technique.

Sprint 4 retains the existing solution reveal as the lightweight guided
path. A real `Guided | Drill` mode toggle belongs to a later polish sprint.

Technical checkpoint: automated verification and a manual browser smoke have
confirmed that the active seed pack appears in the app, drill selection works,
both multi-variant drills switch variants, Show Solution renders StepBoards,
the solved state appears when an accepted outcome is reached, and the existing
reset / undo / new-variant / fumen-export flows remain intact. This confirms
the V2 product wiring, not curriculum accuracy.

## MVP 1 Scope (Legacy)

MVP 1 is the strict-route sandbox baseline. It still loads and runs through
the legacy `src/drills/packs/mvp1.json` pack and the strict-route
`MatchMode` for compatibility/tests, but it is no longer the active product
pack and is hidden from the product UI.

Legacy in scope:

- 5 small, verified MVP drills (`src/drills/packs/mvp1.json`).
- Static queues and strict accepted-route matching (legacy runtime
  compatibility only).
- SRS / SRS+ / 180 rotation kicks; 7-bag piece pool.
- TETR.IO-style handling: DAS, ARR, DCD, SDF, gravity.
- Fumen export of the current locked board (visible 20 rows only).
- Keybind / handling settings panel with localStorage persistence.

Out of scope (deferred):

- Fumen import, playable import, draft drills, import preview.
- Active-piece fumen operation export.
- Randomized queues (beyond authored variants), generated variants.
- Spin / B2B / combo classification.
- Evaluator, solver, pathfinding replay.
- ARE / lock-delay finesse tuning.
- CV / TETR.IO integration, botting, multiplayer.
- Broad curriculum generation.
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

The active canonical product pack is `src/drills/packs/mvp2-seed.json`
(pack id `mvp2-seed`, "MVP 2 Seed Curriculum"). It loads through the V2
drill pack loader (`src/drills/drillLoaderV2.ts`) against the structured
source catalog (`src/drills/sourceCatalog.json`). Its current content is an
intermediate scaffold for the authoring pipeline; do not treat the named
technique drills as curriculum-accurate until they pass a later content
validation pass.

`src/drills/packs/v2-smoke.json` is a V2 fixture-only smoke pack retained
for transition tests; no product code or catalog entry references it after
Sprint 4. `src/drills/packs/mvp1.json` is the legacy MVP 1 strict-route pack
and has been superseded.

The engine does not interpret a separate drill DSL; the V2 loader parses,
validates, and rejects malformed input with path-specific errors. A V2
`Drill` includes:

- `id`, `title`, `category`, `family`, `tags`, optional `difficulty`,
  optional `sourceRefs` (whose `catalogId` must resolve in the source
  catalog).
- `goal` and at least one `acceptedOutcomes` entry (each a board mask with
  optional `variantIds` and an `explanation`).
- `variants` (one or more), `acceptedOutcomes` (one or more), and
  `solutionRoutes` (one or more). Every accepted outcome must include
  explicit `variantIds` in the seed pack.
- Optional `badTemptations` listing anti-patterns to highlight when the
  solution is shown.

A `DrillV2` is statically authored: authored variants only (no
randomization, no generated variants) and outcome-mask success (no strict
runtime route matching for V2).

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
    drillTypesV2.ts             # V2 types: DrillV2, DrillVariant, AcceptedOutcome,
                                # SolutionRoute, SourceRef, source catalog entries
    drillLoaderV2.ts            # V2 runtime validators (loadSourceCatalog,
                                # loadDrillPackV2) with path-specific errors
    drillLoaderV2.test.ts
    playableStart.ts            # PlayableStart shape + adapter from DrillVariant
    outcomeMatcher.ts           # Board-mask matcher for V2 accepted outcomes
    outcomeMatcher.test.ts
    solutionSteps.ts            # V2 route replay + piece-order + outcome check
    solutionSteps.test.ts
    v2SmokePack.test.ts         # V2 smoke fixture tests (fixture-only)
    mvp2SeedPack.test.ts        # MVP 2 seed pack smoke tests
    sourceCatalog.json          # Structured source catalog (V1)
    drillLoader.ts              # Legacy MVP 1 JSON validator (rejects empty + dup ids)
    drillLoader.test.ts
    drillTypes.ts               # Legacy MVP 1 drill types
    solutionMatcher.ts          # Legacy: compares placement history to accepted routes
    solutionMatcher.test.ts
    mvp1Pack.test.ts            # Legacy MVP 1 pack-level collision smoke test
    packs/
      mvp2-seed.json            # Active MVP 2 seed curriculum pack (12 drills)
      v2-smoke.json             # V2 fixture-only smoke pack (not a product pack)
      mvp1.json                 # 5 legacy MVP-1 strict-route drills
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
    V2DrillPanel.tsx           # V2 drill list + variant controls + outcome +
                               # visual solution + Tools
    DrillPanel.tsx             # Legacy MVP-1 panel (kept for compatibility)
    StepBoard.tsx              # Compact field-only solution step board
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
