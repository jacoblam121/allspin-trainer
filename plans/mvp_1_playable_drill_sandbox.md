# MVP 1 Implementation Plan: Playable Drill Sandbox Foundation

## 1. Purpose

Build the first usable version of the Advanced Midgame Patterns Trainer as a custom web trainer, not a computer-vision overlay and not a full evaluator.

MVP 1 should create a playable TETR.IO-like board/drill sandbox that can:

- Load authored JSON drills.
- Render a 10-wide Tetris board, active piece, ghost, hold, queue, and drill metadata.
- Let the player play pieces with customizable controls and TETR.IO-like handling.
- Support 180 rotation using the TETR.IO default SRS+ 180 kick table.
- Reset, undo, and replay drills quickly.
- Import/export fumen where practical.
- Keep engine, input, drill, fumen, and UI code cleanly separated.

The goal is to establish the durable foundation for later all-spin, donation, continuation-pattern, evaluator, and pattern-catalog work.

Do not try to solve the full advanced midgame trainer in MVP 1. The first milestone is a trainer that feels credible to play and can run curated drills.

## 2. Context From The Product Plan

Use `plans/advanced_midgame_patterns_trainer_plan.md` as the high-level product direction.

The long-term product is an advanced midgame patterns trainer for practical B2B-sustaining decisions across:

- All-spin B2B sustain.
- T-spin donations.
- T-spin continuation patterns.
- Clean-vs-dirty residue decisions.
- Garbage-hole preservation and uncovering.
- Mixed decision drills where several plausible continuations exist.

The product plan deliberately prioritizes a custom trainer before any CV tool. CV, if ever built, should be read-only and personal-practice oriented. It is not part of MVP 1.

MVP 1 should preserve this architecture direction:

- `engine`: rules, board, movement, line clears.
- `input`: keybinds and handling.
- `drills`: JSON drill loading, reset state, accepted solutions.
- `fumen`: import/export adapter.
- `ui`: board, controls, drill browser, solution/explanation panel.

## 3. Product Shape For MVP 1

MVP 1 should deliver one coherent user loop:

1. User opens the trainer.
2. User selects or loads a drill.
3. Trainer shows board, hold, queue, B2B state, and drill goal.
4. User plays using familiar Tetris controls.
5. User can reset, undo, show solution, and export fumen.
6. Trainer can compare the played sequence against authored accepted solutions at a basic level.

The first version does not need to rank alternatives or deeply explain board quality. It should support authored drill answers and explanations so curriculum work can begin before a full evaluator exists.

## 4. Recommended Tech Stack

Use:

- TypeScript.
- React + Vite.
- Canvas for the board renderer.
- CSS modules or plain CSS for styling.
- Vitest for engine/input unit tests.
- `tetris-fumen` for fumen encode/decode.
- Browser `localStorage` for MVP 1 settings persistence.

Reasons:

- React/Vite is fast to scaffold and easy to iterate.
- Canvas is appropriate for a fast, stable board renderer.
- TypeScript is important because the engine, drill format, and evaluator will grow.
- `tetris-fumen` should be used as an adapter rather than reinventing fumen encoding.

React should not own the core game loop, engine transitions, or input timing. Use plain TypeScript engine/input objects driven by a deterministic loop, and let React render controls/panels while Canvas draws from engine snapshots.

Add a small `GameLoop` or `loop` module that owns `requestAnimationFrame`, advances input/engine timing, exposes a drawable snapshot for Canvas each frame, and publishes state snapshots for React panels. The exact React sync cadence can be tuned during implementation; the important boundary is that React does not drive game rules.

Do not adopt an entire open-source Tetris clone wholesale unless its license, architecture, and rules behavior are verified. It is acceptable to study implementations for ideas, but MVP 1 should own the core engine and input loop because later evaluator/search code needs predictable internal state.

## 5. Explicit MVP 1 Non-Goals

Do not build:

- A CV overlay.
- A TETR.IO client integration.
- TETR.IO API features.
- Input automation for TETR.IO.
- Multiplayer or bot behavior.
- A full optimal move solver.
- A deep evaluator.
- A full pattern catalog.
- A randomized drill generator.
- Perfect garbage simulation.
- Full replay analytics.

Do not make fumen the only source of truth for drills. Fumen is useful for board/operation import/export, but it cannot carry all training metadata cleanly.

## 6. Ruleset Target

Primary MVP 1 ruleset: **TETR.IO default**.

Implement:

- Standard 10-wide board.
- Internal field is 10x40: 20 visible rows plus 20 hidden rows above.
- Seven tetrominoes: `I`, `O`, `T`, `S`, `Z`, `J`, `L`.
- SRS-like 90-degree rotation kicks.
- TETR.IO default SRS+ 180 rotation kicks.
- Hold.
- Queue.
- Hard drop.
- Soft drop.
- Lock placement once a hard drop is performed.
- Reject drill/start states where the active piece cannot spawn without collision.

Out of scope for MVP 1:

- SRS-X as a selectable alternate ruleset.
- Lock delay finesse.
- Gravity/ARE behavior exactness.
- Multiplayer timing.
- Attack table exactness.
- Perfect TETR.IO spin detection.

Important: structure the ruleset code so later rulesets can be added. Do not hard-code rotation tables directly into UI or input code.

Pin the SRS+ 180 kick data in a dedicated engine fixture/table file, with a header comment citing the exact source URL and retrieval date used during implementation. Rotation tests should assert specific `(dx, dy)` offsets for representative kicks, not only that a rotation eventually succeeds.

Use the 10x40 field to give all pieces enough hidden spawn space. Exact spawn offsets may be refined against TETR.IO references during Sprint 2, but the chosen offsets must be centralized in the ruleset module and covered by spawn tests.

## 7. Handling And Keybind Requirements

MVP 1 must support fully customizable controls and handling.

### Required Actions

Support keybinds for:

- Move left.
- Move right.
- Soft drop.
- Hard drop.
- Rotate clockwise.
- Rotate counterclockwise.
- Rotate 180.
- Hold.
- Reset drill.
- Undo placement.
- Show/hide solution.
- Pause or focus toggle if useful.

Allow multiple physical keys per action if straightforward. At minimum, allow one key per action and make the data model compatible with multiple keys.

### Required Handling Settings

Persist these settings:

- `das`: delayed auto shift, in milliseconds.
- `arr`: auto repeat rate, in milliseconds per repeated horizontal move. `0` means instant movement to the wall when held after DAS and is required because it is the default.
- `dcd`: directional change delay, in milliseconds.
- `sdf`: soft-drop speed in cells per second while soft drop is held. Gravity is out of scope for MVP 1, so soft drop is discrete repeated downward movement; `20` means one cell every 50ms.

Recommended default settings:

```json
{
  "das": 100,
  "arr": 0,
  "dcd": 0,
  "sdf": 20
}
```

These defaults can be adjusted later, but the settings model should not require migration for basic changes.

### Input Architecture

Use a deterministic input controller:

- Maintain physical key pressed/released state.
- Map physical keys to logical actions.
- Apply action priority and repeat timing in one input module.
- Feed logical movement intents to the engine.
- Keep input timing testable with a simulated clock.
- When both left and right are held, the most-recently pressed direction wins; releasing it falls back to the other direction if it is still held.
- On window blur or app focus loss, release all physical keys to prevent stuck DAS/soft-drop state.

Avoid scattering `keydown`/`keyup` game logic throughout React components.

## 8. Core Engine Responsibilities

The engine should be UI-agnostic and testable.

### Engine State

Represent at least:

- Board cells.
- Active piece type, rotation, and position.
- Hold piece.
- Whether hold has been used for the current piece.
- Queue.
- B2B state from drill metadata.
- Combo value if present in drill metadata.
- Placement history for undo.
- Current drill id.

The MVP 1 implementation can use a single mutable engine instance for simplicity, but undo/reset history must store deep-copied snapshots before each lock. Do not depend on inverse operations for undo.

The engine should expose pure or mostly pure operations for:

- Spawn next piece.
- Move left/right/down.
- Rotate clockwise/counterclockwise/180.
- Hard drop.
- Hold.
- Lock piece.
- Clear lines.
- Reset to initial drill state.
- Undo last locked placement.

### Board Coordinates

Choose one coordinate convention and document it in code comments/types:

- `x`: 0 to 9 from left to right.
- `y`: 0 at the bottom, increasing upward, or 0 at the top increasing downward.

Recommendation: use `x` left-to-right and `y` bottom-to-top internally because line clears and surface analysis are easier later. The renderer can convert to screen coordinates.

Whichever convention is chosen, do not mix renderer coordinates into engine code.

### Piece Representation

Represent each piece as:

- Piece id.
- Rotation state: `0`, `R`, `2`, `L`.
- A set of occupied offsets per rotation state.

Rotation tables and kick tables should live in the ruleset module.

### Line Clears And B2B

For MVP 1:

- Clear complete lines.
- Track whether a clear happened.
- Track whether a clear is a Tetris.
- Treat `b2bActive` and `combo` as display-only drill metadata.

Do not update B2B/combo state in MVP 1. Full T-spin/all-spin/B2B classification can be partial or stubbed in MVP 1, but active B2B updates should wait until classification exists.

## 9. Drill Format

Create a JSON drill format as the canonical training data.

Fumen strings may appear inside drills, but fumen is not canonical because drills need metadata that fumen does not represent.

Authored playable drills must specify an active piece. If a fumen import produces only a board, treat it as an import draft until active piece, queue, hold, and drill metadata are supplied.

Playable board cells must be concrete: empty or occupied by a known piece/solid cell. Do not put wildcard or "don't care" cells in the engine board state; those belong in future pattern-mask data structures.

`garbageHoleColumn` is metadata-only in MVP 1. The trainer should not simulate incoming garbage yet, but garbage cells in authored boards should render distinctly from colored piece cells.

### Recommended Type Shape

```ts
type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

type RulesetId = "tetrio-default";

type BoardCell =
  | null
  | { kind: "garbage" }
  | { kind: "filled"; piece: PieceId };

type Drill = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  source?: string;
  ruleset: RulesetId;
  board: BoardCell[][];
  active: PieceId;
  hold: PieceId | null;
  queue: PieceId[];
  b2bActive?: boolean;
  combo?: number;
  garbageHoleColumn?: number | null;
  goal: string;
  acceptedSolutions: AcceptedSolution[];
  badTemptations?: DrillTemptation[];
  fumen?: string;
};

type AcceptedSolution = {
  id: string;
  label: string;
  placements: ExpectedPlacement[];
  explanation: string;
};

type ExpectedPlacement = {
  piece: PieceId;
  x: number;
  y: number;
  rotation: "0" | "R" | "2" | "L";
};

type DrillTemptation = {
  label: string;
  placements?: ExpectedPlacement[];
  explanation: string;
};
```

Placement `x`/`y` coordinates are the engine piece-origin coordinates used by the piece offset table, not an arbitrary occupied cell. Use the same origin for engine state, authored solutions, and solution matching. Rotation states are `0`, `R`, `2`, and `L`.

`queue[0]` is the next piece after the current active piece. Empty hold must be represented as `null` in JSON, not omitted.

This shape may be refined during implementation, but keep these concepts:

- Board state.
- Required active piece for authored drills.
- Queue and hold, with `queue[0]` as the next piece and `hold: null` for empty hold.
- B2B metadata.
- Goal text.
- Accepted solution placements.
- Explanation.
- Source attribution.
- Optional fumen.

### Initial Drill Pack

Seed only 5-10 drills in MVP 1.

Suggested categories:

- 2 all-spin validity or setup-shape drills.
- 2 clean-vs-dirty all-spin continuation drills.
- 2 donation drills, preferably Kaidan or STMB Cave.
- 1-2 mixed decision drills with one accepted authored line.

Do not spend MVP 1 authoring 60 drills. The drill loader and trainer loop need to be proven first.

## 10. Fumen Import/Export

Use `tetris-fumen` for fumen support.

MVP 1 fumen behavior:

- Import a fumen page into a board state where practical.
- Export the current board state to a fumen string.
- If active operation export is easy, include the current or recent operation sequence.
- Preserve drill metadata outside fumen.

Do not block MVP 1 on perfect fumen round-tripping of every training field.

Implementation guidance:

- Put all fumen code behind a `fumen` module.
- The engine and drill modules should not depend directly on `tetris-fumen`.
- If fumen import omits queue/hold/B2B, prompt the drill author or fill defaults in the UI/import flow later. For MVP 1, document the limitation clearly in code or UI.
- If the engine uses bottom-origin `y`, keep any fumen top-origin conversion inside the fumen adapter.
- If `tetris-fumen` type definitions are missing or incomplete, isolate local declaration/shim work inside the fumen module rather than leaking untyped imports across the app.

## 11. UI Requirements

The UI should be practical and trainer-first, not a landing page.

First screen should show the trainer itself:

- Board.
- Hold.
- Queue.
- Current drill title and goal.
- Reset/undo/show solution controls.
- Settings access.
- Drill selector.

### Required Views/Panels

Implement:

- Main board play area.
- Queue and hold display.
- Drill metadata panel.
- Solution/explanation panel.
- Controls/handling settings panel.
- Basic import/export fumen controls if practical.

### Board Renderer

Use stable dimensions:

- 10 columns.
- 20 visible rows.
- Internal hidden rows may exist but do not need to render by default.
- Ghost piece should be visually distinct.
- Active piece should be clearly visible.
- Locked cells should have piece colors.

Keep the visual style restrained and functional. The app is a practice tool.

## 12. Solution Checking

Use authored accepted solutions in MVP 1.

Minimum behavior:

- Record locked placements during a drill.
- Compare the player placement sequence against each accepted solution.
- Mark success when the recorded placements match an accepted sequence.
- Allow reset and retry.
- Show the accepted solution and explanation on demand.

Matching can start strict:

- Same piece.
- Same final x/y.
- Same final rotation.
- Same placement order.

Hold actions are not matched directly in MVP 1. Matching compares the locked placement sequence only, so authored drills should list each accepted placement order as a separate `AcceptedSolution`.

Later phases can add fuzzy matching, equivalent placements, board-after comparison, and evaluator-based acceptance.

## 13. Undo And Reset

Required:

- Reset drill to its exact starting state.
- Undo last locked placement.

Implementation guidance:

- Store deep-copied engine snapshots before each lock.
- Keep history bounded if needed, but drills are short, so memory is not a concern.

## 14. Test Plan

Add unit tests for engine and input before polishing UI.

### Engine Tests

Cover:

- Board collision.
- Spawn validity.
- Spawn collision rejects invalid drill/start states.
- Left/right/down movement.
- Hard drop final position.
- Line clear behavior.
- Hold behavior.
- Queue advance.
- Reset to drill state.
- Undo after one or more placements.

### Rotation Tests

Cover:

- 90-degree SRS kicks for `I`, `T`, and at least one non-I non-O piece.
- O piece rotation stability.
- 180 rotation success in open space.
- 180 rotation near walls.
- At least several TETR.IO SRS+ 180 kick cases from pinned reference data, asserting specific `(dx, dy)` offsets.
- A known `ExpectedPlacement` origin resolves to the expected occupied cells.

### Input Tests

Use a simulated clock.

Cover:

- DAS delay before repeated movement.
- ARR repeat timing.
- ARR `0` instant-to-wall behavior.
- DCD behavior when changing direction.
- Soft drop timing/SDF as discrete cells-per-second movement.
- Simultaneous left/right conflict behavior: most-recently pressed wins, with fallback on release.
- Window blur releases all physical keys.
- Custom keybind mapping.

### Drill/Fumen Tests

Cover:

- Valid drill JSON parses.
- Invalid drill JSON reports useful errors.
- Accepted solution matching succeeds/fails correctly.
- Integration test: load an `mvp1.json` drill, replay an accepted locked-placement sequence, assert success; replay a wrong sequence, assert failure.
- Fumen import/export smoke test.

## 15. Acceptance Criteria

MVP 1 is complete when:

- The app starts locally with a standard dev command.
- A user can select a drill and play it with keyboard controls.
- Keybinds and handling settings can be changed and persist across reloads.
- DAS, ARR, DCD, SDF, hold, hard drop, and 180 rotation work in the sandbox.
- The board can reset and undo.
- At least 5 authored drills load from JSON.
- At least one accepted solution can be matched and marked complete.
- Show solution displays placements and explanation.
- Current board can export to fumen, or there is a clear documented limitation if export is partially implemented.
- Unit tests cover the engine/input behaviors listed above.

## 16. Suggested File Layout

Exact file names can vary, but keep boundaries close to this:

```text
src/
  engine/
    board.ts
    pieces.ts
    ruleset.ts
    srs.ts
    gameState.ts
    lineClear.ts
    history.ts
    fixtures/
      srsPlus180Kicks.ts
  input/
    keybinds.ts
    handling.ts
    inputController.ts
  loop/
    gameLoop.ts
  drills/
    drillTypes.ts
    drillLoader.ts
    solutionMatcher.ts
    packs/
      mvp1.json
  fumen/
    fumenAdapter.ts
  ui/
    BoardCanvas.tsx
    HoldQueue.tsx
    DrillPanel.tsx
    SettingsPanel.tsx
    SolutionPanel.tsx
  App.tsx
```

Keep React components thin. They should call engine/input/drill APIs rather than own game rules.

## 17. External References

Use these as implementation references:

- High-level product plan: `plans/advanced_midgame_patterns_trainer_plan.md`
- All-spin curriculum seed: https://howtotetris.com/sustaining-back-to-backs-with-all-spins/
- Donation curriculum seed: https://four.lol/mid-game/donation
- SRS reference: https://harddrop.com/wiki/SRS
- SRS overview: https://four.lol/srs/kicks-overview/
- TETR.IO rotation system notes: https://tetris.wiki/TETR.IO#Rotation_System
- Fumen library: https://github.com/knewjade/tetris-fumen

When using open-source Tetris implementations for reference, inspect license terms first and avoid copying large code blocks unless the license and attribution are handled correctly.

## 18. Phase 2 Preview

Do not implement these in MVP 1, but design MVP 1 so they can be added:

- Spin classification for T-spins and all-spins.
- Short sequence search.
- Evaluator scoring dimensions.
- Pattern catalog matching.
- Drill variants: mirror, shift, queue variations, garbage-hole variations.
- Better solution equivalence checking.
- Progress tracking by pattern/category.

The MVP 1 code should make these additions natural rather than requiring a rewrite.
