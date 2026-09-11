# Bodi Island Vertical Slice Implementation Plan

Status: Implemented in PR #6; automated validation green on the delivered head.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playable 3D Bodi Island forest vertical slice that proves third-person movement, Captain companionship, sword combat, Dark Matter collection, Blaze's Shadow Boots upgrade, shadow-ground traversal, responsive mobile controls, and repository integration.

**Architecture:** Keep Bodi Island isolated under `src/games/bodi-island`. Use a small native WebGL renderer and imperative frame loop inside the game boundary; keep React focused on lifecycle, HUD, and touch controls. Put deterministic progression/combat state transitions in pure TypeScript helpers so they are unit-testable without WebGL. Integrate through the current explicit route/card pattern on `main`; do not depend on unmerged PR #5. The Bodi Island route is lazy-loaded so its 3D runtime does not join the initial app bundle. The renderer remains deliberately replaceable if later slices justify a fuller 3D engine.

**Tech Stack:** React 19, TypeScript 6, Vite 8, native WebGL, Vitest, existing `GameViewport`.

**Spec:** `docs/superpowers/specs/2026-09-10-bodi-island-adventure-design.md`

## Global Constraints

- Bodi is a five-year-old blonde boy with tan skin, blue T-shirt, dark tan pants, and brown shoes.
- Captain is Bodi's playful TV-Cat companion with a dark green screen and neon-green symbols.
- The first region is the forest and includes Shadow Bugs plus common Dark Matters.
- Dark Matters are fuzzy black balls with three legs, two googly eyes, funny movement/noises, and a black-fuzz defeat burst.
- Shadow Bugs drop nothing.
- Dark Matters drop one Dark Fuzz until Bodi has collected 10 pieces.
- Exactly 10 Dark Fuzz are required for Blaze to craft Shadow Boots.
- Dark Fuzz has no other use after the boots are crafted.
- Shadow Boots increase movement speed and permit crossing shadowy ground.
- Combat supports a simple sword attack and dodge; exploration remains primary.
- The scene is third-person 3D and must remain playable on mobile and modest hardware.
- Do not implement the full island, Luma, the Shadow Monster boss, giant robot, or Dark Matter King finale in this vertical-slice PR.
- Do not depend on PR #5; integrate with current `main` route and Games page patterns.

---

### Task 1: Lock progression rules with tests

**Files:**
- `src/games/bodi-island/bodiIslandLogic.test.ts`
- `src/games/bodi-island/bodiIslandLogic.ts`

- [x] Add tests covering Dark Matter-only drops, the 10-piece cap, one-time Shadow Boots progression, shadow-ground gating, and faster boot movement.
- [x] Implement the pure TypeScript progression helpers.
- [x] Verify the progression tests in the full repository suite.

### Task 2: Add the isolated native-WebGL scene runtime

**Files:**
- `src/games/bodi-island/bodiIslandScene.ts`
- `src/games/bodi-island/bodiIslandScene.test.ts`

- [x] Add tests for deterministic spawn data, enemy hit-state transitions, drops, and bounded forest coordinates.
- [x] Implement a compact native-WebGL renderer with perspective camera, colored low-poly primitives, depth testing, capped DPR, shared buffers, and no per-frame React state.
- [x] Implement the bounded low-poly forest, Bodi, Captain, Blaze, Shadow Bugs, Dark Matters, Dark Fuzz burst feedback, and simple synthesized Dark Matter noises.
- [x] Implement third-person movement, camera following, sword combat, dodge, contact damage, knockout recovery, and the shadow-ground gate.
- [x] Verify scene tests in the full repository suite.

### Task 3: Add React lifecycle, HUD, touch controls, and Blaze interaction

**Files:**
- `src/games/bodi-island/BodiIslandGame.tsx`
- `src/games/bodi-island/BodiIslandPage.tsx`
- `src/games/bodi-island/bodiIsland.css`
- `src/games/bodi-island/BodiIslandGame.test.tsx`

- [x] Add component tests for the objective, Dark Fuzz counter, Shadow Boots state, and labeled touch controls.
- [x] Implement the game shell using `GameViewport`, compact HUD, objective/status messaging, and an accessible WebGL-unavailable fallback.
- [x] Implement desktop controls: WASD/arrows move, Space attack, Shift dodge, E interact.
- [x] Implement Pointer Events mobile controls with 44px+ targets and safe pointer-release behavior.
- [x] Implement Blaze as the Shadow Boots crafting interaction point.
- [x] Implement the vertical-slice finish state at Captain's signal beyond the shadow ground.
- [x] Verify component tests in the full repository suite.

### Task 4: Integrate Bodi Island into C00lG@mes+

**Files:**
- `src/App.tsx`
- `src/App.test.tsx`
- `src/pages/GamesPage.tsx`
- `src/games/bodi-island/bodiIslandIntegration.test.tsx`

- [x] Add `/games/bodi-island` and a Games-page entry.
- [x] Update the app-level seven-game contract.
- [x] Lazy-load the Bodi Island route so the 3D runtime stays out of the initial app bundle.
- [x] Verify the Games entry and lazy-loaded route through integration tests.

### Task 5: Validate performance and delivery

- [x] `npm test`: 30 test files / 126 tests passed on the delivered head.
- [x] `npm run lint`: passed with zero lint errors on the delivered head.
- [x] `npm run build`: TypeScript and Vite production build passed on the delivered head.
- [x] Verify frame-loop, WebGL buffer/program, resize listener/observer, and optional AudioContext cleanup on unmount.
- [x] Verify mobile control targets are at least 44px with safe-area-aware placement.
- [x] Verify performance safeguards: DPR capped at 1.5, bounded enemy/entity counts, shared WebGL buffer/program, no React frame-state loop, no shadow maps or post-processing.
- [x] Verify code splitting: production build emits Bodi Island as a separate ~19.3 kB JS chunk (~7.35 kB gzip) plus separate CSS.
- [ ] Perform real-device/local visual and game-feel playtesting; CI cannot validate controls feel, camera feel, rendering correctness across GPUs, or moment-to-moment fun.

## Scope check

This PR intentionally implements a **vertical slice**, not the full design spec. The larger spec includes multiple future content systems and story chapters; implementing them all in one PR would create an unreviewable, high-risk game build. The vertical slice proves the technical/player-experience foundation needed to expand Bodi Island safely.

Deferred by explicit scope: full village interiors, Town Hall opening cinematic, Bob/Andrew dialogue, Shadow Monster boss, Luma, climbing/swimming/gliding, ruins/mountain content, the mountain robot, and Dark Matter King finale.

## Delivery note

Automated verification is complete. The remaining gate is the user's local gameplay review, especially camera feel, movement responsiveness, enemy readability, mobile ergonomics, and visual direction. Any findings should be iterated on this PR before expanding into the next Bodi Island slice.
