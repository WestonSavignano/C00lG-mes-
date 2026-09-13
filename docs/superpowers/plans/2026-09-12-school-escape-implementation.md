# School Escape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete, lazy-loaded third-person 3D stealth game where the player manually mixes camouflage colors, evades one teacher through a fixed creepy school, triggers a final chase outside, and wins by reaching home.

**Architecture:** Keep all runtime code isolated under `src/games/school-escape/`. React owns lifecycle, HUD, and controls; `schoolEscapeScene.ts` owns imperative WebGL rendering/simulation; `schoolEscapeLogic.ts` owns deterministic camouflage/perception/state rules; `schoolEscapeLevel.ts` owns fixed level geometry and nav data. Reuse `GameViewport` and the landed semantic input primitives without creating shared 3D infrastructure.

**Tech Stack:** TypeScript 6, React 19, native WebGL 1, Vitest, Testing Library, existing shared semantic input controls.

**Spec:** `docs/superpowers/specs/2026-09-11-school-escape-design.md`

## Global Constraints

- Add no runtime dependency.
- Keep frame-by-frame simulation out of React state.
- Keep the game lazy-loaded through `gameCatalog`.
- Use the existing semantic input foundation for movement, sprint, and jump.
- Desktop controls: WASD, mouse drag camera, Shift sprint, Space jump, RGB sliders.
- Mobile controls: directional stick, Sprint, Jump, camera drag region, touch-friendly RGB sliders.
- One fixed school, one teacher, one exit, one final chase, one principal fail cutscene.
- No procedural generation, collectibles, inventory, multiplayer, accounts, analytics, monetization, shadow maps, or post-processing.
- Cap DPR at 1.5 and degrade to 1.0 after sustained low frame rate.
- `npm test`, `npm run lint`, and `npm run build` must pass before review-ready status.

---

### Task 1: Deterministic stealth/game-flow logic

**Files:**
- Create: `src/games/school-escape/schoolEscapeLogic.test.ts`
- Create: `src/games/school-escape/schoolEscapeLogic.ts`

**Interfaces:**
- Produces `rgbMatchScore`, `blendQuality`, `camouflageVisibilityMultiplier`, `updateTeacherState`, and `nextGamePhase`.

- [ ] **Step 1: Write failing tests** for exact RGB match, poor mismatch, still-near-wall camouflage, moving-player visibility, patrol→suspicious→chase, chase→search→patrol, catch→fail, exit→final-chase, and house→won.
- [ ] **Step 2: Run** `npm test -- src/games/school-escape/schoolEscapeLogic.test.ts` and confirm failure because the module/exports do not exist.
- [ ] **Step 3: Implement minimal pure logic** with explicit constants from the spec and discriminated string unions for teacher/game phases.
- [ ] **Step 4: Re-run the focused test** and keep all assertions deterministic.
- [ ] **Step 5: Commit** `feat: define School Escape stealth logic`.

### Task 2: Fixed school geometry, navigation, and collision helpers

**Files:**
- Create: `src/games/school-escape/schoolEscapeLevel.test.ts`
- Create: `src/games/school-escape/schoolEscapeLevel.ts`

**Interfaces:**
- Produces authored `WALLS`, `PATROL_NODES`, `SCHOOL_START`, `SCHOOL_EXIT`, `HOUSE_TRIGGER`, `EXTERIOR_BOUNDS`, `resolveCircleAgainstWalls`, `hasLineOfSight`, and `nearestCamouflageWall`.

- [ ] **Step 1: Write failing tests** proving the start and exit are separated by the maze, collision keeps a player circle outside a wall, line-of-sight is blocked by a wall rectangle, and nearest camouflage wall returns color + distance.
- [ ] **Step 2: Run** `npm test -- src/games/school-escape/schoolEscapeLevel.test.ts` and confirm expected failure.
- [ ] **Step 3: Implement one compact authored layout** containing the start classroom, classroom hall, locker junction, cross hall, quiet wing, exit lobby, outside sidewalk, and house trigger.
- [ ] **Step 4: Re-run focused tests**.
- [ ] **Step 5: Commit** `feat: add School Escape level data`.

### Task 3: Input contract and catalog registration

**Files:**
- Create: `src/games/school-escape/schoolEscapeInput.test.ts`
- Create: `src/games/school-escape/schoolEscapeInput.ts`
- Modify: `src/games/catalog/gameTypes.ts`
- Modify: `src/games/catalog/gameCatalog.ts`
- Modify: `src/games/catalog/gameCatalog.test.ts`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces `SchoolEscapeAction = 'sprint' | 'jump'`, `SCHOOL_ESCAPE_KEYBOARD_BINDINGS`, and a lazy catalog entry at `/games/school-escape`.

- [ ] **Step 1: Add failing tests** for WASD movement, Shift sprint hold, Space jump press, and catalog metadata `inputs: ['touch','keyboard','mouse']` with `orientation: 'landscape'`.
- [ ] **Step 2: Update `App.test.tsx` expected catalog counts from 6 to 7 and repair the two stale shell-copy assertions to current accessible UI (`Cool Games Plus home`, `Game Grind Repeat`) because this file must change for the new game count anyway.
- [ ] **Step 3: Run** focused input/catalog/App tests and confirm School Escape assertions fail before production registration exists.
- [ ] **Step 4: Implement bindings, add `school` artwork theme, and register the lazy page import.
- [ ] **Step 5: Re-run focused tests**.
- [ ] **Step 6: Commit** `feat: register School Escape controls and route`.

### Task 4: Native WebGL scene runtime

**Files:**
- Create: `src/games/school-escape/schoolEscapeScene.test.ts`
- Create: `src/games/school-escape/schoolEscapeScene.ts`

**Interfaces:**
- Consumes deterministic logic/level data and `SemanticInputReader<SchoolEscapeAction>`.
- Produces `createSchoolEscapeScene(canvas, input, callbacks): SchoolEscapeSceneController` with `setCameraDrag`, `setCamouflageColor`, `resize`, `restart`, and `dispose`.

- [ ] **Step 1: Write failing tests** around exported non-WebGL helpers/state stepping: sprint speed exceeds teacher chase speed, exit transition fires only in school phase, catch callback fires inside catch radius, and restart returns clean starting state.
- [ ] **Step 2: Run** focused scene tests and confirm expected failure.
- [ ] **Step 3: Implement the scene runtime** with one cube vertex buffer, one shader program, reusable matrices, third-person camera, wall/floor/locker/door geometry, low-poly player/teacher/principal, jump/gravity, collision, nav-node teacher steering, line-of-sight perception, final exterior chase, win/catch transitions, hidden-tab pause, delta clamp, DPR 1.5→1.0 fallback, and full GL/event cleanup.
- [ ] **Step 4: Re-run focused tests**.
- [ ] **Step 5: Commit** `feat: add School Escape 3D runtime`.

### Task 5: React game lifecycle, HUD, RGB mixer, and touch controls

**Files:**
- Create: `src/games/school-escape/SchoolEscapeGame.test.tsx`
- Create: `src/games/school-escape/SchoolEscapeGame.tsx`
- Create: `src/games/school-escape/SchoolEscapePage.tsx`
- Create: `src/games/school-escape/schoolEscape.css`

**Interfaces:**
- Consumes `useSemanticInput`, `DirectionalControl`, `ActionButton`, `GameViewport`, and scene controller.

- [ ] **Step 1: Write failing component tests** proving the game renders an RGB mixer, Sprint and Jump touch controls, blend/status text, and Retry/Play Again actions for fail/win callbacks without requiring a working WebGL context.
- [ ] **Step 2: Run** focused component tests and confirm expected failure.
- [ ] **Step 3: Implement** `SchoolEscapeGame` lifecycle around a canvas, semantic controls, game-specific camera drag, accessible RGB sliders, subtitle/status region, retry/win overlays, and WebGL-unavailable fallback. Keep only low-frequency UI in React state.
- [ ] **Step 4: Implement** thin `SchoolEscapePage` adapter and landscape-first safe-area CSS.
- [ ] **Step 5: Re-run focused component tests**.
- [ ] **Step 6: Commit** `feat: add School Escape game UI`.

### Task 6: Audio/presentation and gameplay polish

**Files:**
- Modify: `src/games/school-escape/schoolEscapeScene.ts`
- Modify: `src/games/school-escape/SchoolEscapeGame.tsx`
- Modify: `src/games/school-escape/schoolEscape.css`

**Interfaces:**
- Adds bounded Web Audio cues and subtitle fallback for `COME BACK HERE!`.

- [ ] **Step 1: Add/extend tests** proving chase subtitle fires once on chase entry and retry clears it.
- [ ] **Step 2: Run focused tests** and confirm failure for the new presentation behavior.
- [ ] **Step 3: Add procedural footsteps, door cue, detection/chase/win/fail tones and optional speech synthesis after user gesture; ensure hidden/unmount cleanup.
- [ ] **Step 4: Add low-cost atmosphere** (fog, fluorescent color variation/flicker, lockers, bulletin-board blocks, exterior sidewalk/house) without new assets.
- [ ] **Step 5: Re-run focused tests**.
- [ ] **Step 6: Commit** `feat: polish School Escape chase presentation`.

### Task 7: Full validation and PR evidence

**Files:**
- Modify: PR #17 body only unless validation exposes a code defect.

- [ ] **Step 1: Run** `npm test` and record exact totals.
- [ ] **Step 2: Run** `npm run lint`.
- [ ] **Step 3: Run** `npm run build` and record the School Escape chunk size plus any pre-existing warnings.
- [ ] **Step 4: Audit** `main...feature/school-escape` for unrelated changes.
- [ ] **Step 5: Update PR #17** with implementation summary, automated evidence, performance notes, and an explicit manual playtest checklist/gap. Keep it Draft until real browser/device validation is performed.
