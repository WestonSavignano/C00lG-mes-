# Bodi Island Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playable 3D Bodi Island forest vertical slice that proves third-person movement, Captain companionship, sword combat, Dark Matter collection, Blaze's Shadow Boots upgrade, shadow-ground traversal, responsive mobile controls, and repository integration.

**Architecture:** Keep Bodi Island isolated under `src/games/bodi-island`. Use Three.js directly for the WebGL scene and imperative frame loop; keep React focused on lifecycle, HUD, and touch controls. Put deterministic progression/combat state transitions in pure TypeScript helpers so they are unit-testable without WebGL. Integrate through the current explicit route/card pattern on `main`; do not depend on unmerged PR #5.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Three.js 0.185.1, Vitest, existing `GameViewport`.

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
- Create: `src/games/bodi-island/bodiIslandLogic.test.ts`
- Create: `src/games/bodi-island/bodiIslandLogic.ts`

**Interfaces:**
- Produces: `DARK_FUZZ_REQUIRED`, `collectDarkFuzz`, `canCraftShadowBoots`, `craftShadowBoots`, `canCrossShadowGround`, `movementSpeed`.

- [ ] **Step 1: Write failing tests** covering Dark Matter-only drops, the 10-piece cap, crafting at exactly 10, one-time crafting, shadow-ground gating, and faster boot movement.
- [ ] **Step 2: Run `npm test -- src/games/bodi-island/bodiIslandLogic.test.ts`** and confirm the new behavior is not yet implemented.
- [ ] **Step 3: Implement the minimal pure TypeScript helpers** required by the tests.
- [ ] **Step 4: Run the focused test again** and confirm PASS.
- [ ] **Step 5: Commit** `test/feat: define Bodi Island progression rules`.

### Task 2: Add the isolated Three.js scene runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/games/bodi-island/bodiIslandScene.ts`
- Create: `src/games/bodi-island/bodiIslandScene.test.ts`

**Interfaces:**
- Consumes: progression helpers from Task 1.
- Produces: `createBodiIslandScene(container, callbacks)` returning `{ setInput, attack, dodge, interact, resize, dispose }`.

- [ ] **Step 1: Write tests** for deterministic spawn data, enemy hit-state transitions, Dark Matter collection callback behavior, and disposal/lifecycle helpers that do not require a live WebGL context.
- [ ] **Step 2: Run the focused scene tests** and confirm RED.
- [ ] **Step 3: Add pinned `three@0.185.1` dependency** and lockfile entry.
- [ ] **Step 4: Implement a low-poly forest scene** with bounded world geometry, fog, ambient/directional lighting, capped DPR, shadows disabled by default, reusable geometries/materials, and no per-frame React state.
- [ ] **Step 5: Build Bodi as a small readable low-poly character** using approved colors and proportions; build Captain as a cat body plus TV head with dark-green screen/neon-green signal panel.
- [ ] **Step 6: Implement third-person follow camera and movement** with keyboard/touch intent, collision against world bounds, and smooth camera follow.
- [ ] **Step 7: Implement Shadow Bug and Dark Matter enemies** with simple low-cost steering, contact damage, sword hit detection, Dark Matter puff particles, and no Shadow Bug drops.
- [ ] **Step 8: Implement the shadow-ground gate** so Bodi is pushed back before boots and can cross after boots.
- [ ] **Step 9: Run scene tests** and confirm PASS.
- [ ] **Step 10: Commit** `feat: add Bodi Island Three.js forest runtime`.

### Task 3: Add React lifecycle, HUD, touch controls, and Blaze interaction

**Files:**
- Create: `src/games/bodi-island/BodiIslandGame.tsx`
- Create: `src/games/bodi-island/BodiIslandPage.tsx`
- Create: `src/games/bodi-island/bodiIsland.css`
- Create: `src/games/bodi-island/BodiIslandGame.test.tsx`

**Interfaces:**
- Consumes: `createBodiIslandScene`, progression helpers, shared `GameViewport`.
- Produces: playable page UI and controls.

- [ ] **Step 1: Write component tests** for visible objective text, Dark Fuzz counter, Shadow Boots state, and labeled touch controls.
- [ ] **Step 2: Run focused component tests** and confirm RED.
- [ ] **Step 3: Implement the game shell** using `GameViewport`, a compact HUD, objective/status messaging, and an accessible loading/fallback state.
- [ ] **Step 4: Implement desktop controls**: WASD/arrows move, Space attack, Shift dodge, E interact.
- [ ] **Step 5: Implement mobile controls** with Pointer Events: thumb directional pad plus Attack, Dodge, and Interact buttons; each target >=44px.
- [ ] **Step 6: Add Blaze near the forest entrance** as the upgrade interaction point. When Bodi has 10 Dark Fuzz, Interact crafts Shadow Boots and updates the objective.
- [ ] **Step 7: Add a simple vertical-slice finish state** beyond the shadow ground: reach the pulsing signal marker with Captain to complete the demo.
- [ ] **Step 8: Run component tests** and confirm PASS.
- [ ] **Step 9: Commit** `feat: add Bodi Island HUD and controls`.

### Task 4: Integrate Bodi Island into C00lG@mes+

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/GamesPage.tsx`
- Create: `src/games/bodi-island/bodiIslandIntegration.test.tsx`

**Interfaces:**
- Produces: `/games/bodi-island` route and Games-page entry.

- [ ] **Step 1: Write an integration test** proving the Games page exposes Bodi Island and the route renders the Bodi Island heading/game viewport.
- [ ] **Step 2: Run the integration test** and confirm RED against current explicit routes/cards.
- [ ] **Step 3: Add the `BodiIslandPage` route** at `/games/bodi-island`.
- [ ] **Step 4: Add the Bodi Island Games card** with concise adventure copy.
- [ ] **Step 5: Run the integration test** and confirm PASS.
- [ ] **Step 6: Commit** `feat: add Bodi Island to the arcade`.

### Task 5: Validate performance and delivery

**Files:**
- Modify as required only to fix findings from validation.
- Update PR #6 description/status.

- [ ] **Step 1: Run `npm test`** and require all tests PASS.
- [ ] **Step 2: Run `npm run lint`** and require PASS.
- [ ] **Step 3: Run `npm run build`** and require PASS.
- [ ] **Step 4: Verify the game bundle is route-isolated as far as current architecture permits and the frame loop is cleaned up on unmount.**
- [ ] **Step 5: Review for mobile ergonomics**: minimum 44px controls, no body-scroll conflict inside play controls, readable HUD, responsive viewport.
- [ ] **Step 6: Review performance safeguards**: capped DPR, bounded entity count, shared geometry/materials, no React frame-state loop, no expensive real-time shadows/post-processing.
- [ ] **Step 7: Update PR #6** from design-only wording to implementation summary and include exact CI evidence.
- [ ] **Step 8: Mark PR ready for review only after required checks are green.**

## Scope check

This PR intentionally implements a **vertical slice**, not the full design spec. The larger spec includes multiple future content systems and story chapters; implementing them all in one PR would create an unreviewable, high-risk game build. The vertical slice is successful when it proves the technical and player-experience foundation needed to expand Bodi Island safely.

## Self-review

- Spec coverage for the vertical slice: Bodi identity, Captain, forest, third-person 3D, sword combat, Shadow Bug, Dark Matter, 10 Dark Fuzz, Blaze, Shadow Boots, shadow-ground gate, mobile controls, and performance constraints are assigned to tasks above.
- Deferred by explicit scope: full village interiors, Town Hall opening cinematic, Bob/Andrew dialogue, Shadow Monster boss, Luma, climbing/swimming/gliding, ruins/mountain, robot, and Dark Matter King finale.
- No placeholder implementation steps are intended; exact mechanics may be tuned during real-play review without expanding PR scope.
