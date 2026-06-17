# Advanced Midgame Patterns Trainer — High-Level Project Plan

## 1. Project Goal

Build a custom Tetris/TETR.IO-oriented trainer for **advanced midgame pattern recognition**, centered on sustaining back-to-back (B2B) pressure from messy, realistic board states.

The initial motivation is improving at **sustaining B2B with all-spins in TETR.IO**, especially using methods from Galactoid / How to Tetris's all-spin guide. However, the project should broaden into a general **advanced midgame tactics trainer**, because real midgame decisions often involve multiple competing options:

- A cute all-spin may preserve B2B but leave bad residue.
- An obvious T-spin may work but make the board uneven.
- A donation may temporarily cover the garbage hole but unlock a cleaner TSD/Tetris continuation.
- A simple skim may be safer than forcing a setup.
- Several B2B-preserving options may exist, and the trainer should teach why one is better.

So the target is not just “recognize named setups.” The target is:

> Given a realistic midgame board, queue, hold, B2B state, and garbage-hole context, identify strong practical continuations that preserve pressure and leave a playable field.

This should be useful for a player around **TETR.IO S+**, where mechanics are already decent and the bottleneck is advanced vision, pattern recognition, and decision-making.

---

## 2. Core Design Philosophy

### Build a custom trainer first

A custom implementation should come before a computer-vision overlay. The hard part is not reading the TETR.IO board; the hard part is building the **rules engine, pattern library, evaluator, and curriculum**.

A custom trainer gives us:

- Perfect board state.
- Perfect queue / hold state.
- Fast reset.
- Fumen import/export.
- Hand-authored drills.
- Randomized drill generation.
- “Show answer” and explanation tools.
- Controlled near-miss examples.
- Easy debugging of the evaluator.

### Add CV only after the brain works

A later CV tool can watch TETR.IO Zen mode, reconstruct the board, and save missed opportunities as flashcards. But it should be a **read-only practice aid**, not a gameplay bot or input automation tool.

The safer long-term direction is:

1. Custom trainer.
2. Evaluator and drill system.
3. Pattern catalog.
4. Randomized midgame generator.
5. Optional read-only Zen-mode CV missed-opportunity detector.

---

## 3. Source Material and Resource Links

### Primary all-spin source

- **Sustaining Back-to-Backs with All-Spins — How to Tetris**  
  https://howtotetris.com/sustaining-back-to-backs-with-all-spins/

This is the original guide/PDF source. It should be used as the main curriculum seed for all-spin B2B sustain methods such as Scarlet, Coral, Amaranth, and the other named color methods.

Important ideas to encode from this guide:

- All-spins should generally be **secondary fillers**, not mindlessly spammed.
- They are useful for sustaining B2B between T-spins and Tetrises.
- They can help even stack imbalance.
- They can reset local parity.
- Some all-spins are TETR.IO-valid while others are marked “Not in TETR.IO / Varies.”
- Clean aftermath matters as much as the spin itself.
- Some tempting all-spin options are dirty and disrupt T-spin continuations.

### T-spin donation and midgame setup sources

- **Donation — FOUR.lol**  
  https://four.lol/mid-game/donation

- **Kaidan — FOUR.lol**  
  https://four.lol/methods/kaidan

- **STMB Cave — FOUR.lol**  
  https://four.lol/methods/stmb

- **Parapet — FOUR.lol**  
  https://four.lol/methods/parapet

- **Shachiku Train — FOUR.lol**  
  https://four.lol/methods/shachiku-train

- **Core T-spin Methods — How to Tetris**  
  https://howtotetris.com/core-t-spin-methods/

- **Canonical Tetris T-spin Setups — How to Tetris**  
  https://howtotetris.com/canonical-tetris-t-spin-setups/

- **STMB Cave — Hard Drop Wiki**  
  https://harddrop.com/wiki/STMB_Cave

- **Shachiku Train — Hard Drop Wiki**  
  https://harddrop.com/wiki/Shachiku_Train

These should seed the donation curriculum: Kaidan, STMB Cave, Parapet, Shachiku Train, Sky Prop, Fractal, Imperial Cross, STSD, C-spin, Shallow Grave, Single-Double, Magic Key, Super Spiral, Vase, Drain Pipe, Mini-Triple, and related practical continuations.

### Technical / implementation resources

- **tetris-fumen** — Fumen encode/decode library  
  https://github.com/knewjade/tetris-fumen

- **Four-tris** — open-source block-stacking trainer / sandbox inspiration  
  https://github.com/fiorescarlatto/four-tris

- **TetrisTrainer** — custom-board practice inspiration  
  https://github.com/GregoryCannon/TetrisTrainer

- **Fumen for Mobile** — diagram / fumen tooling inspiration  
  https://knewjade.github.io/fumen-for-mobile/

### TETR.IO integration guardrails

- **TETR.IO API documentation**  
  https://tetr.io/about/api/

- **TETR.IO client modification warning**  
  https://tetr.io/

Guardrail principle: avoid main-game API use, client injection, gameplay-altering modifications, and input automation. A later CV tool should be read-only and personal-practice-oriented.

---

## 4. Project Scope

### Main scope

The project is an **Advanced Midgame Patterns Trainer**.

It should train:

1. **All-spin B2B sustain**
   - Scarlet, Coral, Amaranth, etc.
   - Generic L/J/S/Z/I-spin singles/doubles/triples where practical.
   - TETR.IO-valid vs non-TETR.IO-valid all-spins.
   - Clean vs dirty all-spin aftermath.

2. **T-spin donations**
   - Kaidan.
   - Parapet.
   - STMB Cave.
   - Shachiku Train.
   - C-spin donation ideas.
   - TSS/TSD/TST donations.
   - Covering and uncovering garbage holes.

3. **T-spin continuation structures**
   - STSD.
   - Fractal.
   - Imperial Cross.
   - Sky Prop.
   - Single-Double.
   - Shallow Grave.
   - C-spin.
   - DT Cannon continuations.
   - Magic Key.
   - Super Spiral.
   - Vase.
   - Drain Pipe.
   - Mini-Triple.

4. **Decision-making**
   - Choose between multiple B2B-preserving options.
   - Decide whether the “cute” solution is actually worse.
   - Avoid blocking the garbage hole.
   - Evaluate residue and stack balance.
   - Decide when to skim, Tetris, donate, all-spin, or abandon B2B.

### Explicit non-goals for MVP

- Do not build a multiplayer bot.
- Do not automate TETR.IO inputs.
- Do not rely on TETR.IO internal APIs.
- Do not start with a perfect TETR.IO physics clone.
- Do not try to solve every possible board optimally from day one.

---

## 5. Trainer Modes

### Mode A: Isolated Drill Trainer

Purpose: learn individual patterns quickly.

The trainer loads a board, hold, and queue, then asks the player to execute the target idea.

Examples:

- “Find the Kaidan donation.”
- “Resolve this STMB Cave.”
- “Use the Z-spin double to even the stack.”
- “This looks like an all-spin, but does it actually preserve B2B in TETR.IO?”
- “Choose the cleanest B2B-preserving option.”

Features:

- Instant reset.
- Mirror board.
- Shift board left/right.
- Different garbage-hole columns.
- Same pattern with varied queues.
- “Show solution.”
- “Explain why.”
- Multiple accepted solutions.

### Mode B: Forced Situation Trainer

Purpose: repeatedly force realistic midgame scenarios instead of waiting for them to occur naturally.

The app generates or loads boards that contain:

- Awkward imbalance.
- Local parity issue.
- Donation opportunity.
- All-spin filler opportunity.
- Garbage-hole conflict.
- Multiple possible B2B continuations.

The player must choose and execute the best continuation.

This is probably the most important training mode.

### Mode C: Decision Trainer

Purpose: train judgment, not just execution.

Instead of requiring immediate play, present a board and ask the player to choose from several candidate plans:

- TSD.
- Tetris.
- All-spin double.
- Donation.
- Skim.
- Wait/build.

The trainer then ranks the options and explains the tradeoffs.

Example feedback:

> The Z-spin double preserves B2B and balances the stack, but leaves a residue over the garbage hole. The Kaidan donation is slower but creates a cleaner TSD follow-up and keeps the hole open.

### Mode D: Guided Freeplay Trainer

Purpose: play normally, but receive slow-practice hints.

This would be a custom sandbox/freeplay mode. The trainer watches the internal board state and periodically flags opportunities:

- “Possible STMB Cave.”
- “Possible all-spin B2B filler.”
- “This donation uncovers the hole next.”
- “This all-spin is dirty; likely avoid.”

Hints should be optional and configurable.

### Mode E: Later CV Missed-Opportunity Detector

Purpose: bridge into real TETR.IO Zen practice after the custom trainer works.

A read-only CV tool could:

- Watch the TETR.IO Zen board.
- Reconstruct occupied cells, hold, and queue if feasible.
- Run the evaluator.
- Save screenshots/fumens of missed opportunities.
- Turn them into flashcards/drills.

Recommended behavior:

- No input automation.
- No live VS usage.
- No internal APIs.
- No client injection.
- Personal Zen/practice use only.

---

## 6. The Evaluator

An evaluator is essential. Named patterns alone are not enough because real midgame boards often contain multiple possible continuations.

The evaluator should score each candidate move or short sequence according to practical midgame value.

### Core evaluator questions

For a candidate placement or sequence:

- Does it preserve B2B?
- Does it clear attack efficiently?
- Is it a T-spin, all-spin, Tetris, or normal skim?
- Is the all-spin valid under the target ruleset?
- Does it keep the garbage hole accessible?
- Does it block the garbage hole temporarily but uncover it cleanly?
- Does it reduce stack imbalance?
- Does it fix local parity?
- Does it create an obvious TSD/Tetris/all-spin follow-up?
- Does it require awkward soft-drop/kick execution?
- Does it leave dirty residue?
- Does it raise the board too much?
- Does it depend on a specific next queue that may be too far away?

### Candidate scoring dimensions

The score should probably be multi-dimensional rather than a single opaque number.

Suggested dimensions:

```text
b2bPreservation
attackValue
cleanliness
holeAccess
followupPotential
stackBalance
parityRepair
heightSafety
queueReliability
executionDifficulty
patternRecognitionValue
```

The UI can show both:

- Overall recommendation.
- Explanation of why alternatives are better/worse.

### Example scoring mindset

A candidate is not automatically good just because it is cute or named.

Good:

- Preserves B2B.
- Keeps or reopens the garbage hole.
- Leaves a clean surface.
- Leads to another TSD/Tetris/all-spin.
- Uses a realistic queue.

Bad:

- Covers the garbage hole with no clean recovery.
- Leaves isolated residue.
- Requires too many specific pieces.
- Breaks B2B for low value.
- Creates height danger.
- Solves the current shape but ruins the next shape.

---

## 7. Pattern Catalog

The pattern catalog should be separate from the evaluator.

### Why both are needed

Pattern matching is good for:

- Naming setups.
- Teaching recognition.
- Loading drills.
- Showing “you just missed Kaidan.”
- Creating curated lessons.

Evaluator/search is good for:

- Handling organic variants.
- Ranking multiple options.
- Finding unnamed continuations.
- Explaining why a named setup is bad in a specific board state.

### Pattern entry concept

```ts
type Pattern = {
  id: string;
  name: string;
  family: "all-spin" | "donation" | "tspin-continuation" | "decision";
  pieces: string[];
  clearTypes: string[];
  validRulesets: string[];
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  source: string;
  beforeMasks: Mask[];
  solutionPlacements: Placement[];
  acceptedAlternatives?: Placement[][];
  badTemptations?: Placement[][];
  explanation: string;
};
```

Suggested tags:

```text
b2b
all-spin
tetrio-valid
not-tetrio-valid
clean
dirty
parity-fix
hole-covering
hole-uncovering
tsd-followup
tetris-followup
stack-balance
softdrop
high-risk
near-miss
```

---

## 8. Drill Data Model

A drill should encode board state, queue, goal, accepted solutions, and evaluator expectations.

Conceptual format:

```json
{
  "id": "kaidan-basic-001",
  "title": "Kaidan donation from stair shape",
  "category": "T-spin donations",
  "tags": ["kaidan", "donation", "b2b", "parity-fix"],
  "source": "https://four.lol/methods/kaidan",
  "ruleset": "tetrio-like-srs",
  "board": "fumen-or-custom-grid",
  "hold": "T",
  "queue": ["Z", "L", "T", "I"],
  "goal": "Preserve B2B and create/clear a TSD while keeping the garbage hole accessible.",
  "solutions": [
    {
      "placements": ["Z placement", "L overhang", "TSD clear"],
      "rating": 5,
      "explanation": "Creates a clean TSD and fixes local parity."
    }
  ],
  "badTemptations": [
    {
      "placements": ["simple skim"],
      "explanation": "Works short-term but leaves a worse uneven board."
    }
  ]
}
```

This can be simplified in the MVP. The important part is to leave room for multiple solutions and explanations.

---

## 9. Curriculum Structure

### Phase 1: Core all-spin sustain

- Basic all-mini+ validity.
- TETR.IO-valid vs non-TETR.IO-valid examples.
- All-spins as B2B fillers.
- Using all-spins to balance uneven stacks.
- Using all-spins to reset local parity.
- Clean vs dirty aftermath.

### Phase 2: Named all-spin methods

Seed from the How to Tetris all-spin guide:

- Scarlet.
- Coral.
- Amaranth.
- Other named color methods.
- High-rated practical methods first.
- Dirty/low-rated methods as near-miss warning drills.

### Phase 3: Basic donations

- Kaidan.
- Parapet.
- STMB Cave.
- Shachiku Train.
- TSS donations.
- TSD donations.

### Phase 4: Advanced T-spin continuations

- STSD.
- Fractal.
- Imperial Cross.
- Sky Prop.
- C-spin.
- Shallow Grave.
- Single-Double.
- Magic Key.
- Super Spiral.
- Vase.
- Drain Pipe.
- Mini-Triple.

### Phase 5: Mixed decision drills

This is the real target.

Boards should contain multiple plausible options, such as:

- Obvious TSD vs cleaner all-spin filler.
- Donation vs Tetris.
- TSD now vs wait one piece for STSD.
- All-spin that preserves B2B but blocks the hole.
- Dirty donation vs simple skim.
- Cute solution vs practical downstack.

### Phase 6: Generated drills and missed opportunities

- Randomized variations of known patterns.
- Mirrored versions.
- Shifted garbage holes.
- Different queue orders.
- Queue-starved versions.
- CV-captured missed opportunities from Zen mode.

---

## 10. High-Level Technical Architecture

### Suggested stack

Probably a web app:

```text
TypeScript
React/Vite or SvelteKit
Canvas or SVG renderer
tetris-fumen for import/export
Custom board/rules/evaluator engine
JSON drill packs
Local storage for progress
```

This is just a recommendation; exact choices can be decided in Codex.

### Major modules

```text
src/engine/
  board representation
  pieces and rotations
  SRS/TETR.IO-like kicks
  legal placement enumeration
  line clear simulation
  spin classification
  B2B classification
  short-sequence search

src/evaluator/
  scoring model
  board cleanliness heuristics
  garbage-hole heuristics
  follow-up detector
  parity/imbalance heuristics
  explanation generator

src/patterns/
  pattern masks
  named setup metadata
  source links
  drill generation helpers

src/drills/
  hand-authored drill packs
  randomized variations
  answer checking

src/ui/
  board renderer
  controls
  drill selection
  solution overlay
  evaluator panel
  progress tracking
```

---

## 11. MVP Plan

### MVP 1: Board sandbox and drill loader

- Render a 10x20 board.
- Support custom board state.
- Support queue and hold.
- Support reset/undo.
- Support basic keyboard controls.
- Support JSON-defined drills.
- Support Fumen import/export if feasible early.

### MVP 2: Hand-authored drills

Create the first drill pack manually:

- 10 all-spin validity drills.
- 10 all-spin clean-vs-dirty drills.
- 10 Kaidan drills.
- 10 STMB Cave drills.
- 10 Parapet/Shachiku drills.
- 10 mixed decision drills.

The first version can check against known accepted solutions rather than needing a perfect evaluator.

### MVP 3: Placement enumeration and classification

- Enumerate legal final placements for current piece.
- Simulate line clears.
- Classify T-spin / T-spin mini / all-spin / Tetris / normal line clear.
- Track whether B2B is preserved.

### MVP 4: Evaluator v1

Add simple heuristics:

- B2B preserved.
- Attack value.
- Board height.
- Holes created.
- Garbage hole blocked or open.
- Surface roughness.
- Follow-up availability within 1–3 pieces.

### MVP 5: Explanation panel

For each candidate:

- Show what it clears.
- Show whether it preserves B2B.
- Show after-board.
- Explain clean/dirty residue.
- Compare against alternatives.

---

## 12. Future Features

### Randomized pattern variants

Take a base pattern and generate:

- Mirror.
- Horizontal shift.
- Different stack heights.
- Different garbage-hole columns.
- Different acceptable queues.
- Added noise/residue.
- Partial setup recognition.

### “Near-miss” generator

Generate boards that look like known patterns but fail because:

- Wrong overhang side.
- Missing support block.
- Spin does not count in TETR.IO.
- Garbage hole gets blocked.
- Follow-up is too weak.
- Queue dependency is unrealistic.

### Replay/Zen capture

Eventually:

- Capture Zen board states via CV.
- Detect missed evaluator-positive opportunities.
- Save as fumen/drill.
- Review missed patterns after practice.

### Personal progress tracking

Track:

- Accuracy by pattern.
- Average solve time.
- Missed pattern types.
- Overused bad habits.
- “Cute but dirty” choices.
- Donation recognition rate.

---

## 13. Important Design Warnings

### Do not overfit to diagrams

The named diagrams are starting points, not the whole game. The trainer should create variations and evaluate practical outcomes.

### Do not reward cute setups automatically

A named setup can be wrong if it leaves a bad board. The evaluator should punish dirty aftermath, hole blocking, and unrealistic queue dependency.

### Keep rulesets explicit

All-spin recognition differs between games. The trainer should mark which ruleset is being used:

- TETR.IO-like all-spin.
- Generic all-mini+.
- Guideline-ish SRS.
- Custom practice mode.

### Keep CV read-only

If CV is added later, use it only to observe and generate practice feedback. Avoid automation or invasive integration.

---

## 14. Key Open Questions for Codex Phase

These are intentionally left undecided for implementation planning:

1. Exact tech stack: React/Vite vs SvelteKit vs something else.
2. Canvas vs SVG rendering.
3. How accurate the TETR.IO rules simulation needs to be for MVP.
4. Whether to implement movement physics or only final-placement validation first.
5. Exact format for board states and drills.
6. How much to rely on fumen as the canonical storage format.
7. How to model all-spin validity for TETR.IO specifically.
8. Whether the evaluator should search 1, 2, 3, or more pieces deep at first.
9. How to display multiple candidate solutions without overwhelming the user.
10. How to import/encode the original guide’s diagrams efficiently.

---

## 15. One-Sentence Summary

Build a custom **advanced midgame patterns trainer** that combines curated drills, named pattern recognition, and a practical evaluator so the player learns not just “what setup exists,” but “which B2B-preserving continuation is actually best for this board.”
