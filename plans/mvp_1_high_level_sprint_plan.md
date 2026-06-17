# MVP 1 High-Level Sprint Plan: Playable Drill Sandbox

## Purpose

This document keeps the first deliverable grounded.

MVP 1 should be a small but usable custom trainer: a player can load a curated drill, play on a Tetris board with familiar handling, reset/undo, see the goal/solution, and export or import fumen where practical.

The goal is not to build the full advanced evaluator yet. The goal is to prove the trainer loop and establish a codebase that can grow into the all-spin, donation, pattern-catalog, and evaluator work described in `advanced_midgame_patterns_trainer_plan.md`.

## Naming Convention

Use:

- **MVP 1** for the first deliverable.
- **Sprints** for implementation slices inside MVP 1.

The existing `mvp_1_playable_drill_sandbox.md` is the more detailed technical handoff for MVP 1.

This document is intentionally higher level.

## MVP 1 Definition

MVP 1 is complete when the app supports this loop:

1. Open the trainer.
2. Select a curated drill.
3. See board, queue, hold, B2B/drill metadata, and a goal.
4. Play pieces with custom keybinds and handling.
5. Use reset, undo, and show solution.
6. Match at least one authored accepted solution.
7. Import/export fumen at a basic level, or clearly document the limitation.

## Guardrails

Keep MVP 1 focused:

- Custom trainer first, no CV overlay.
- No TETR.IO client integration.
- No gameplay automation.
- No full evaluator or solver.
- No large drill curriculum yet.
- No perfect TETR.IO clone requirement.

Do include:

- Clean separation between engine, input, drills, fumen, and UI.
- Fully customizable keybinds.
- Handling settings: ARR, DAS, DCD, SDF.
- 180 rotation using TETR.IO default SRS+ behavior.
- A drill JSON format that can evolve later.

## Engineering Practices To Adopt Early

Keep the process lightweight, but establish these habits before the codebase grows:

- Use TypeScript strict mode from the start.
- Keep game rules deterministic and mostly UI-agnostic.
- Keep React out of core engine transitions and input timing; React should render controls/panels and consume drawable engine snapshots.
- Add unit tests for engine, input timing, drill parsing, and solution matching as each area appears.
- Validate drill JSON at runtime so bad drill data fails clearly.
- Keep playable board cells concrete. Wildcards or "don't care" cells belong in later pattern-mask types, not engine board state.
- Keep a small acceptance checklist for each MVP/sprint instead of relying on memory.
- Record major architecture decisions briefly in docs when they affect future work, especially ruleset behavior, drill format, and rendering/input choices.
- Track third-party code and license notes before borrowing from open-source Tetris projects.
- Add lint/format/test scripts early, and wire them into CI once the project is scaffolded.

## Sprint 0: Project Foundation

Goal: create the app skeleton and make future work straightforward.

Expected outcome:

- TypeScript web app scaffolded.
- Basic folder structure established.
- Test runner configured.
- Minimal app shell renders.
- Dependencies chosen and installed, including fumen support if practical.

Keep this sprint boring. Do not start solving evaluator or curriculum problems here.

## Sprint 1: Static Trainer Shell

Goal: make the trainer visible before making it fully playable.

Expected outcome:

- Board renderer displays a 10x20 field.
- Static active piece, hold, and queue can be shown.
- A hardcoded or JSON-loaded drill appears in the UI.
- Drill title, tags, goal, and explanation panel exist.
- Basic reset button returns to the drill start state.

This sprint proves the product shape: the first screen should already feel like a trainer, not a landing page.

## Sprint 2: Core Play Engine

Goal: make pieces move and lock correctly enough for drill practice.

Expected outcome:

- Board collision works.
- Piece spawn, movement, rotation, hard drop, lock, and line clear work.
- Hold and queue advance work.
- Undo last placement works.
- TETR.IO default SRS+ 180 rotation support exists.
- Core engine behavior is covered by unit tests.

Avoid advanced spin classification unless a small placeholder is needed for later typing.

## Sprint 3: Input Feel And Settings

Goal: make the trainer feel usable for a real player.

Expected outcome:

- Customizable keybinds for movement, rotations, hard drop, soft drop, hold, reset, undo, and show solution.
- Handling settings for ARR, DAS, DCD, and SDF.
- Settings persist locally.
- Input timing is deterministic and testable.
- Manual play feels close enough to TETR.IO-style practice to validate drills.

This sprint matters because bad handling will make even good drills feel useless.

## Sprint 4: Drill Loading And Solution Checking

Goal: make authored drills useful.

Expected outcome:

- Drill JSON format is implemented.
- A small curated drill pack loads from the app.
- Player locked placements are recorded.
- Strict accepted-solution matching works.
- Show solution displays accepted placements and explanation.
- Drill reset restores board, queue, hold, B2B metadata, and history.

Keep the first drill pack small: 5-10 drills is enough for MVP 1.

## Sprint 5: Fumen And MVP Polish

Goal: make the deliverable usable and shareable.

Expected outcome:

- Current board can export to fumen, if practical.
- Fumen import can create a board state, with known metadata limitations.
- UI labels and settings are cleaned up.
- Basic error states exist for invalid drills/imports.
- MVP acceptance checklist passes.
- The README or project notes explain how to run the app and what MVP 1 does/does not support.

Do not let fumen round-tripping derail the deliverable. Fumen is an adapter, not the canonical drill format.

## After MVP 1

Likely next deliverables:

- MVP 2: better authored drill packs and curriculum structure.
- MVP 3: spin classification and B2B classification.
- MVP 4: evaluator v1 with simple heuristics.
- MVP 5: pattern catalog and generated variants.

The exact order can change once MVP 1 reveals what is hard in practice.

## Success Criteria

MVP 1 succeeds if it is useful enough to practice a small number of curated board situations and stable enough to build on.

Concrete signs of success:

- Playing a drill feels responsive.
- Custom controls and handling work.
- Reset/undo make repetition fast.
- The drill format is understandable.
- The engine is tested enough that future evaluator work has a reliable base.
- The code structure does not mix UI, input timing, and game rules together.
