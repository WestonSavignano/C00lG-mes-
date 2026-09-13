# School Escape Golden-Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved premium School Escape golden slice — art classroom -> main hallway -> locker bay -> teacher near-miss/camouflage — as a lazy Babylon.js WebGL-compatible browser-game preview that passes real desktop/mobile quality validation before the full game expands.

**Architecture:** Keep School Escape isolated under `src/games/school-escape/`. React owns route/lifecycle/contextual HUD and touch controls; an imperative Babylon runtime owns rendering, transforms, animation, camera, collision, perception sampling, and frame timing; pure deterministic modules own paint/color, camouflage, teacher-state, quality-policy, and other testable rules. Expose the unfinished slice only at `/game-preview/school-escape`; do not add it to the published game catalog until the complete game is ready.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, existing shared semantic input/GameViewport infrastructure, `@babylonjs/core@9.26.0`, `@babylonjs/loaders@9.26.0`, GLB/glTF assets, HTML/CSS HUD, Web Audio / `HTMLAudioElement` playback for authored audio assets.

**Spec:** `docs/superpowers/specs/2026-09-13-school-escape-golden-slice-design.md`

**Owning Issue:** #26 — `Build School Escape premium golden slice`

## Global Constraints

- Prerequisite #27 must land first so implementation starts from a green `main` test/lint/build baseline.
- Start the implementation branch from current `main` after the approved design/plan documentation is landed; do not branch from closed PR #17 / `feature/school-escape`.
- Do not use Codex or a workflow that consumes Codex usage unless the user explicitly requests it.
- Babylon.js is game-local and lazy-loaded; unrelated routes must not pay its runtime or asset cost.
- Pin `@babylonjs/core` and `@babylonjs/loaders` to exact version `9.26.0`; use ES-module/tree-shakeable imports, not `Legacy/legacy`.
- WebGL is the compatibility baseline. Do not require WebGPU and do not add a physics engine for this slice.
- Keep frame-by-frame game/render state out of React state.
- Preserve existing shared semantic input behavior, including native keyboard accessibility for focused interactive DOM controls.
- Mobile is first-class: Pointer Events, practical 44px+ targets, safe areas, no hover dependency, landscape primary orientation.
- Final-quality visible art must be authored GLB/glTF, not cube-built prototype characters/world. Simple invisible collision proxies are allowed.
- Raw third-party assets committed to this public repository must permit repository redistribution. Original assets are preferred; CC0 is acceptable. Do not commit assets whose license forbids redistribution of the asset files themselves.
- Keep a provenance record for every committed 3D/audio asset. Current Quaternius QAL restricts redistribution of assets themselves, so do not use raw Quaternius files in this public repository without a fresh explicit license review. Kenney CC0 assets are an acceptable fallback for incidental/non-hero base material, but the player, teacher, and environment must still meet the approved custom stylized direction.
- Final-quality slice acceptance requires original or clearly commercial-safe music/voice/SFX; do not ship the quality gate on browser-generated tones or `speechSynthesis`.
- No full school maze, exit lobby, outdoor chase, house win scene, or finished principal-office fail cutscene in #26.
- No shared/site-wide 3D-engine abstraction, feature-flag platform, analytics, accounts, multiplayer, monetization, or unrelated cleanup.
- Required repository gate: `npm test`, `npm run lint`, `npm run build`.
- Automated checks cannot approve the slice. The PR remains draft / `needs-playtest` until hands-on player review approves the visual/game-feel bar.

---

## File Structure

### Modify

- `package.json` — exact Babylon runtime dependencies.
- `package-lock.json` — locked dependency graph.
- `src/App.tsx` — one temporary lazy `/game-preview/school-escape` route.
- `src/App.test.tsx` — preview-route and non-catalog assertions only; do not repeat #27 cleanup here.
- `src/shell/AppShell.tsx` — treat the one temporary preview route as immersive while it exists.
- `src/shell/AppShell.test.tsx` if present; otherwise cover the immersive flag through `App.test.tsx`.

### Create under `src/games/school-escape/`

- `SchoolEscapePage.tsx` — thin preview page; composes `GameViewport` + game.
- `SchoolEscapeGame.tsx` — React lifecycle, HUD state, paint UI, touch overlay, loading/error/retry.
- `SchoolEscapeGame.test.tsx` — React/UI behavior.
- `schoolEscape.css` — game-local visual/touch/HUD styles.
- `schoolEscapeTypes.ts` — shared game-local types and constants.
- `schoolEscapeLogic.ts` — pure RYB mixing, sRGB/OKLab conversion, match/camouflage, teacher-state rules, pure movement helpers.
- `schoolEscapeLogic.test.ts` — deterministic rules.
- `schoolEscapeInput.ts` — keyboard bindings and camera-look accumulator/pointer helpers.
- `schoolEscapeInput.test.ts` — input semantics/reset behavior.
- `schoolEscapeLevel.ts` — fixed golden-slice collision/nav/hide-surface/trigger data.
- `schoolEscapeLevel.test.ts` — level invariants and line-of-sight geometry.
- `schoolEscapeAssets.ts` — local asset manifest, GLB load/validation, animation/material-node contract.
- `schoolEscapeAssets.test.ts` — asset manifest/provenance invariants and required contract names.
- `schoolEscapePlayer.ts` — Babylon player proxy, model/animation binding, movement integration.
- `schoolEscapeCamera.ts` — spring follow, orbit input, occlusion, FOV sprint framing.
- `schoolEscapeTeacher.ts` — teacher world controller/path following/animation state mapping.
- `schoolEscapeQuality.ts` — pure adaptive-quality policy + Babylon quality application data.
- `schoolEscapeQuality.test.ts` — initial tier/downgrade/hysteresis tests.
- `schoolEscapeAudio.ts` — authored soundtrack/ambience/voice orchestration and cleanup.
- `schoolEscapeAudio.test.ts` — pure layer-selection/ducking rules and disposal behavior with mocked media elements.
- `schoolEscapeRuntime.ts` — Babylon Engine/Scene orchestration, frame loop, integration, disposal.

### Create under `public/games/school-escape/`

- `assets/characters/player.glb`
- `assets/characters/teacher.glb`
- `assets/environment/golden-slice.glb`
- `audio/music/exploration.ogg`
- `audio/music/tension.ogg`
- `audio/music/chase.ogg`
- `audio/voice/come-back-here.ogg`
- `audio/sfx/player-step-1.ogg`
- `audio/sfx/player-step-2.ogg`
- `audio/sfx/teacher-step-1.ogg`
- `audio/sfx/teacher-step-2.ogg`
- `audio/sfx/door.ogg`
- `audio/sfx/locker.ogg`
- `audio/sfx/paint.ogg`
- `audio/sfx/jump.ogg`
- `audio/sfx/land.ogg`
- `ASSET_PROVENANCE.md`

The committed GLBs/audio are product assets, not a reusable site-wide asset system.

---

### Task 1: Establish the lazy preview route and Babylon runtime boundary

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/shell/AppShell.tsx`
- Create: `src/games/school-escape/SchoolEscapePage.tsx`
- Create: `src/games/school-escape/SchoolEscapeGame.tsx`
- Create: `src/games/school-escape/SchoolEscapeGame.test.tsx`
- Create: `src/games/school-escape/schoolEscape.css`
- Create: `src/games/school-escape/schoolEscapeRuntime.ts`

**Interfaces:**
- Produces: lazy route `/game-preview/school-escape`.
- Produces: `createSchoolEscapeRuntime(options): Promise<SchoolEscapeRuntimeController>`.
- Produces: `SchoolEscapeRuntimeController` with `resize()`, `pause()`, `resume()`, `restart()`, `dispose()`.
- Consumes: existing `GameViewport` and shared shell/input infrastructure.

- [ ] **Step 1: Verify the prerequisite baseline before feature work**

Run from fresh `main` after #27 lands:

```bash
npm ci
npm test
npm run lint
npm run build
```

Expected: all four commands succeed before creating `feature/school-escape-golden-slice`.

- [ ] **Step 2: Create the implementation branch/worktree from current `main`**

Use the repository-preferred isolated workflow at execution time. Branch name:

```text
feature/school-escape-golden-slice
```

Do not cherry-pick PR #17.

- [ ] **Step 3: Write failing route/UI tests**

Add coverage in `src/App.test.tsx` proving the preview route exists but the published catalog remains six games:

```tsx
it('loads School Escape only through the unlisted preview route', async () => {
  renderRoute('/game-preview/school-escape')

  expect(await screen.findByTestId('game-viewport')).toHaveAttribute(
    'data-game',
    'school-escape',
  )
  expect(screen.getByTestId('app-shell')).toHaveAttribute('data-game-route', 'true')
})

it('does not publish School Escape in discovery while it is a golden slice', () => {
  renderRoute('/games')
  expect(screen.getAllByTestId('game-tile')).toHaveLength(6)
  expect(screen.queryByText('School Escape')).not.toBeInTheDocument()
})
```

If `AppShell` currently lacks `data-testid="app-shell"`, assert through the existing root selector or add that stable test id as the only shell-testability change.

Create `SchoolEscapeGame.test.tsx` with a mocked runtime module and assert that mount calls `createSchoolEscapeRuntime`, unmount calls `dispose`, and the viewport label is `School Escape`.

- [ ] **Step 4: Run the focused tests and confirm RED**

```bash
npm test -- src/App.test.tsx src/games/school-escape/SchoolEscapeGame.test.tsx
```

Expected: fail because route/page/runtime do not exist.

- [ ] **Step 5: Install exact Babylon dependencies**

```bash
npm install --save-exact @babylonjs/core@9.26.0 @babylonjs/loaders@9.26.0
```

Do not add `@babylonjs/gui`, a physics engine, or the legacy UMD package.

- [ ] **Step 6: Add the one-off lazy preview route**

In `src/App.tsx`, import `lazy`/`Suspense` and define only the import boundary:

```tsx
const SchoolEscapePreviewPage = lazy(
  () => import('./games/school-escape/SchoolEscapePage'),
)
```

Route it at `/game-preview/school-escape` with a small branded `<div role="status">Loading School Escape…</div>` Suspense fallback. Do not add a catalog definition.

In `AppShell.tsx`, temporarily treat exactly this pathname as immersive:

```ts
const isSchoolEscapePreview = location.pathname === '/game-preview/school-escape'
const isGameRoute = Boolean(getGameByRoute(location.pathname)) || isSchoolEscapePreview
```

This special case is removed when the full game is published through the normal catalog.

- [ ] **Step 7: Add the thin page and lifecycle shell**

`SchoolEscapePage.tsx` should simply render `<SchoolEscapeGame />`.

Define in `schoolEscapeRuntime.ts`:

```ts
export type SchoolEscapeRuntimeController = {
  resize(): void
  pause(): void
  resume(): void
  restart(): Promise<void>
  dispose(): void
}

export type SchoolEscapeRuntimeOptions = {
  canvas: HTMLCanvasElement
  onFatalError(error: Error): void
}

export async function createSchoolEscapeRuntime(
  options: SchoolEscapeRuntimeOptions,
): Promise<SchoolEscapeRuntimeController> {
  // Task 1 creates/disposes the Babylon Engine + Scene only.
}
```

Use modular imports such as `@babylonjs/core/Engines/engine` and `@babylonjs/core/scene`; import `@babylonjs/loaders/glTF` inside the School Escape chunk.

`SchoolEscapeGame.tsx` mounts a `<canvas>` inside `GameViewport`, creates the runtime in an effect, calls `dispose()` on cleanup, and renders loading/error/retry states without frame-by-frame React updates.

- [ ] **Step 8: Run focused tests GREEN**

```bash
npm test -- src/App.test.tsx src/games/school-escape/SchoolEscapeGame.test.tsx
npm run build
```

Inspect `dist/assets`/Vite output and confirm Babylon is emitted only under the School Escape lazy dependency graph, not the initial app chunk.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/App.tsx src/App.test.tsx src/shell/AppShell.tsx src/games/school-escape
git commit -m "feat: add School Escape Babylon preview boundary"
```

---

### Task 2: Implement deterministic paint, color-match, camouflage, movement, and teacher-state rules

**Files:**
- Create: `src/games/school-escape/schoolEscapeTypes.ts`
- Create: `src/games/school-escape/schoolEscapeLogic.ts`
- Create: `src/games/school-escape/schoolEscapeLogic.test.ts`

**Interfaces:**
- Produces: `PaintPigment`, `PaintMix`, `SrgbColor`, `OklabColor`, `TeacherState`, `TeacherSnapshot`, `CamouflageSample`.
- Produces: `mixPaint()`, `displayedClothingColor()`, `srgbToOklab()`, `colorMatchScore()`, `camouflageVisibilityMultiplier()`, `updateTeacherState()`, `stepScalarSpeed()`.
- Later tasks must consume these functions rather than duplicating math in Babylon controllers.

- [ ] **Step 1: Define exact game-local types/constants**

Use normalized `0..1` colors and pigment quantities:

```ts
export type PaintPigment = 'red' | 'yellow' | 'blue' | 'white' | 'black'
export type PaintMix = Readonly<Record<PaintPigment, number>>
export type SrgbColor = Readonly<{ r: number; g: number; b: number }>
export type OklabColor = Readonly<{ l: number; a: number; b: number }>
export type TeacherState = 'patrol' | 'suspicious' | 'search' | 'chase' | 'recover'

export const EMPTY_PAINT_MIX: PaintMix = {
  red: 0,
  yellow: 0,
  blue: 0,
  white: 0,
  black: 0,
}

export const BASE_OUTFIT_COLOR: SrgbColor = { r: 0.055, g: 0.065, b: 0.085 }
export const PLAYER_MOVE_SPEED = 3.2
export const PLAYER_SPRINT_SPEED = 4.8
export const TEACHER_PATROL_SPEED = 2.0
export const TEACHER_CHASE_SPEED = 4.2
```

- [ ] **Step 2: Write failing RYB/OKLab tests**

Required assertions:

```ts
expect(mixPaint({ ...EMPTY_PAINT_MIX, red: 1, yellow: 1 })).toMatchObject({
  r: expect.any(Number),
  g: expect.any(Number),
  b: expect.any(Number),
})
expect(dominantHue(mixPaint({ ...EMPTY_PAINT_MIX, red: 1, yellow: 1 }))).toBe('orange')
expect(dominantHue(mixPaint({ ...EMPTY_PAINT_MIX, yellow: 1, blue: 1 }))).toBe('green')
expect(dominantHue(mixPaint({ ...EMPTY_PAINT_MIX, red: 1, blue: 1 }))).toBe('purple')
expect(luminance(mixPaint({ ...EMPTY_PAINT_MIX, red: 1, white: 1 })))
  .toBeGreaterThan(luminance(mixPaint({ ...EMPTY_PAINT_MIX, red: 1 })))
expect(luminance(mixPaint({ ...EMPTY_PAINT_MIX, red: 1, black: 1 })))
  .toBeLessThan(luminance(mixPaint({ ...EMPTY_PAINT_MIX, red: 1 })))
expect(colorMatchScore(color, color)).toBeCloseTo(1, 6)
```

The test-only `dominantHue`/`luminance` helpers may live in the test file; they are not production API.

- [ ] **Step 3: Run tests RED**

```bash
npm test -- src/games/school-escape/schoolEscapeLogic.test.ts
```

Expected: missing module/functions.

- [ ] **Step 4: Implement the fixed RYB cube and clothing-coverage model**

Use these eight trilinear RYB cube corners in `sRGB`:

```ts
const RYB_CUBE = {
  white:  { r: 1.000, g: 1.000, b: 1.000 }, // 000
  blue:   { r: 0.163, g: 0.373, b: 0.600 }, // 001
  yellow: { r: 1.000, g: 1.000, b: 0.000 }, // 010
  green:  { r: 0.000, g: 0.660, b: 0.200 }, // 011
  red:    { r: 1.000, g: 0.000, b: 0.000 }, // 100
  purple: { r: 0.500, g: 0.000, b: 0.500 }, // 101
  orange: { r: 1.000, g: 0.500, b: 0.000 }, // 110
  brown:  { r: 0.200, g: 0.094, b: 0.000 }, // 111
} as const
```

For `red/yellow/blue`, clamp each pigment to `0..1`, divide all three by their maximum nonzero primary value, and use the normalized values as trilinear cube coordinates. Apply white as `lerp(base, WHITE, white)` and then black as `lerp(result, BLACK, black)`.

Make paint visibly spread rather than instantly replacing the outfit:

```ts
const coverage = clamp(
  (mix.red + mix.yellow + mix.blue + mix.white + mix.black) / 1.25,
  0,
  1,
)
return lerpColor(BASE_OUTFIT_COLOR, mixPaint(mix), coverage)
```

Match scoring uses `displayedClothingColor(mix)`, not raw palette values.

- [ ] **Step 5: Implement standard sRGB -> linear RGB -> OKLab conversion**

Use the standard OKLab matrices and deterministic Euclidean distance. Normalize the distance with:

```ts
const OKLAB_MAX_GAME_DISTANCE = 0.55
score = 1 - clamp(distance / OKLAB_MAX_GAME_DISTANCE, 0, 1)
```

This constant is a game tuning value; tests lock deterministic behavior, while hands-on playtesting may adjust only the constant/thresholds, not the algorithm family.

- [ ] **Step 6: Write failing camouflage/teacher/motion tests**

Cover:

```ts
expect(camouflageVisibilityMultiplier({
  match: 0.98,
  surfaceDistance: 0.45,
  horizontalSpeed: 0.02,
  grounded: true,
})).toBeLessThan(0.25)

expect(camouflageVisibilityMultiplier({
  match: 0.98,
  surfaceDistance: 0.45,
  horizontalSpeed: 4.8,
  grounded: true,
})).toBe(1)

expect(TEACHER_CHASE_SPEED).toBeLessThan(PLAYER_SPRINT_SPEED)
```

Teacher transitions must explicitly test patrol -> suspicious -> chase -> search -> recover -> patrol and the one-shot `shout` flag on chase entry.

- [ ] **Step 7: Implement deterministic camouflage/teacher rules**

Initial tuning constants:

```ts
const MAX_HIDE_DISTANCE = 0.8
const MAX_HIDE_SPEED = 0.18
const DIRECT_CHASE_VISIBILITY = 0.75
const SUSPICION_VISIBILITY = 0.08
const SUSPICION_GAIN_PER_SECOND = 1.5
const SUSPICION_DECAY_PER_SECOND = 0.5
const LOST_SIGHT_TO_SEARCH_SECONDS = 1.25
const SEARCH_SECONDS = 5
const RECOVER_SECONDS = 1.5
```

`camouflageVisibilityMultiplier()` returns `1` unless grounded, near a hideable surface, and below the stillness speed. For eligible players, map match scores from `0.72..1.0` onto multiplier `1.0..0.12` using a clamped smooth interpolation.

`updateTeacherState()` must be pure and must not know about Babylon nodes.

Add `stepScalarSpeed(current, target, accel, decel, dt)` for testable acceleration/deceleration; runtime movement uses it rather than hard snapping speed.

- [ ] **Step 8: Run focused tests GREEN and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeLogic.test.ts
git add src/games/school-escape/schoolEscapeTypes.ts src/games/school-escape/schoolEscapeLogic.ts src/games/school-escape/schoolEscapeLogic.test.ts
git commit -m "feat: add School Escape deterministic gameplay rules"
```

---

### Task 3: Implement School Escape input and interruption-safe look controls

**Files:**
- Create: `src/games/school-escape/schoolEscapeInput.ts`
- Create: `src/games/school-escape/schoolEscapeInput.test.ts`
- Modify: `src/games/school-escape/SchoolEscapeGame.tsx`
- Modify: `src/games/school-escape/SchoolEscapeGame.test.tsx`

**Interfaces:**
- Consumes: shared `KeyboardBinding`, `attachKeyboardInput`, `SemanticInputReader/Writer`, `DirectionalControl`, `ActionButton`, and input lifecycle helpers.
- Produces: `SchoolEscapeAction = 'sprint' | 'jump'`.
- Produces: `schoolEscapeKeyboardBindings`.
- Produces: `createLookAccumulator()` with `add(deltaX, deltaY)`, `consume()`, `reset()`.

- [ ] **Step 1: Write failing keyboard/look tests**

Lock these bindings:

```ts
export const schoolEscapeKeyboardBindings = [
  { code: 'KeyW', move: { x: 0, y: -1 }, preventDefault: true },
  { code: 'KeyS', move: { x: 0, y: 1 }, preventDefault: true },
  { code: 'KeyA', move: { x: -1, y: 0 }, preventDefault: true },
  { code: 'KeyD', move: { x: 1, y: 0 }, preventDefault: true },
  { code: 'ShiftLeft', hold: 'sprint', preventDefault: true },
  { code: 'ShiftRight', hold: 'sprint', preventDefault: true },
  { code: 'Space', press: 'jump', preventDefault: true },
] as const
```

Tests must also prove `look.reset()` clears pending camera movement and that focused buttons/paint controls remain handled by the shared keyboard adapter’s existing interactive-element exclusion.

- [ ] **Step 2: Run focused tests RED**

```bash
npm test -- src/games/school-escape/schoolEscapeInput.test.ts
```

- [ ] **Step 3: Implement bindings and a bounded look accumulator**

`consume()` returns one accumulated delta and zeroes it. Clamp a single frame’s accumulated pointer delta to `[-120, 120]` pixels per axis so an interruption cannot create a camera jump.

- [ ] **Step 4: Wire desktop + mobile input in React**

`SchoolEscapeGame` owns one semantic input instance for the run. Attach keyboard listeners on mount. Add:

- `DirectionalControl` with a stable source id such as `school-escape-touch-move`;
- `ActionButton` for held `sprint`;
- `ActionButton` for press/pulse `jump`;
- right-side `onPointerDown/Move/Up/Cancel` camera drag region that uses pointer capture and writes to `look`;
- reset on blur/visibility/pointer cancellation using shared lifecycle patterns.

Do not send per-frame input through React state.

- [ ] **Step 5: Add UI tests for touch controls and pointer cancellation**

Assert Sprint and Jump controls exist, are buttons, and cancellation invokes input reset. Assert paint controls remain interactive DOM so global keyboard gameplay input ignores them.

- [ ] **Step 6: Run tests GREEN and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeInput.test.ts src/games/school-escape/SchoolEscapeGame.test.tsx
git add src/games/school-escape
git commit -m "feat: add School Escape desktop and touch input"
```

---

### Task 4: Create the final-quality golden-slice asset contract and provenance

**Files:**
- Create: `public/games/school-escape/assets/characters/player.glb`
- Create: `public/games/school-escape/assets/characters/teacher.glb`
- Create: `public/games/school-escape/assets/environment/golden-slice.glb`
- Create: `public/games/school-escape/ASSET_PROVENANCE.md`
- Create: `src/games/school-escape/schoolEscapeAssets.ts`
- Create: `src/games/school-escape/schoolEscapeAssets.test.ts`

**Interfaces:**
- Produces: `SCHOOL_ESCAPE_ASSETS` manifest.
- Produces: `loadSchoolEscapeAssets(scene): Promise<LoadedSchoolEscapeAssets>`.
- `LoadedSchoolEscapeAssets` exposes player/teacher roots, named animation groups, player paint material(s), teacher face material, and environment root.

- [ ] **Step 1: Write the asset manifest/contract test first**

Define the required names in the test before assets/loaders exist:

```ts
expect(SCHOOL_ESCAPE_ASSETS.player.url).toBe(
  '/games/school-escape/assets/characters/player.glb',
)
expect(SCHOOL_ESCAPE_ASSETS.player.animations).toEqual([
  'Idle', 'Walk', 'Run', 'Sprint', 'Jump', 'Fall', 'Land',
])
expect(SCHOOL_ESCAPE_ASSETS.teacher.animations).toEqual([
  'Idle', 'Walk', 'Suspicious', 'Search', 'Run', 'Recover',
])
expect(SCHOOL_ESCAPE_ASSETS.player.paintMaterialNames).toContain('PlayerPaint')
expect(SCHOOL_ESCAPE_ASSETS.teacher.faceMaterialName).toBe('TeacherFace')
```

The environment visible root name is `GoldenSliceEnvironment`.

- [ ] **Step 2: Run asset tests RED**

```bash
npm test -- src/games/school-escape/schoolEscapeAssets.test.ts
```

- [ ] **Step 3: Author/export the three GLBs to the fixed contract**

Use Blender or another glTF-capable authoring tool. The content requirements are part of the deliverable:

**Player**
- stylized child/adventure-hero proportions, not chibi;
- blonde hair, blue eyes, tan skin;
- dark jacket/pants with authored paint-mark details;
- separate material slot named `PlayerPaint` covering the color-change clothing regions;
- animation groups exactly `Idle`, `Walk`, `Run`, `Sprint`, `Jump`, `Fall`, `Land`.

**Teacher**
- normal adult teacher proportions/clothing;
- face material exactly `TeacherFace`, authored deep red;
- animation groups exactly `Idle`, `Walk`, `Suspicious`, `Search`, `Run`, `Recover`.

**Environment**
- one coherent stylized art classroom, main hallway, cross-hall glimpse, and locker bay matching Task 5 dimensions;
- warm-window classroom material/geometry and cooler hallway fixtures;
- visible lockers, art-room props, classroom signage/bulletin detail, ceiling/floor/wall materials;
- visible art only; deterministic collision remains code-authored.

Export baked animations and compact textures. Prefer <=1024px textures for ordinary surfaces and <=2048px only for a justified hero atlas. Do not include unused source meshes/animations in the GLB.

- [ ] **Step 4: Record provenance immediately**

`ASSET_PROVENANCE.md` must list every committed GLB and later audio file with:

```text
Path | Origin/author | Source URL or "Original C00lG@mes+ work" | License | Modifications
```

If any seed asset is third-party, confirm that raw-file redistribution in this public repo is allowed before commit. Do not use a “free to use in games but not redistribute” raw asset.

- [ ] **Step 5: Implement the manifest and Babylon loader validation**

`schoolEscapeAssets.ts` imports `@babylonjs/loaders/glTF` and uses `SceneLoader.ImportMeshAsync`/`LoadAssetContainerAsync` through modular Babylon APIs. After load, validate all required animation/material names. Throw an `Error` naming the missing contract element so `SchoolEscapeGame` can present recoverable launch failure.

Do not fetch assets from third-party runtime URLs; serve them from the app’s own `public` output.

- [ ] **Step 6: Run tests/build and visually inspect assets in Babylon Sandbox or the local preview**

```bash
npm test -- src/games/school-escape/schoolEscapeAssets.test.ts
npm run build
```

Manual asset gate before proceeding:
- no missing textures;
- animation loops/one-shots have correct names and no obvious foot sliding at intended movement speeds;
- paint material changes do not recolor skin/hair;
- teacher face remains clearly red in both warm and cool light;
- environment silhouette/material language is coherent at gameplay camera distance.

- [ ] **Step 7: Commit**

```bash
git add public/games/school-escape src/games/school-escape/schoolEscapeAssets.ts src/games/school-escape/schoolEscapeAssets.test.ts
git commit -m "feat: add School Escape authored 3D assets"
```

---

### Task 5: Define the authored golden-slice level, collision, hide surfaces, LOS, and encounter triggers

**Files:**
- Create: `src/games/school-escape/schoolEscapeLevel.ts`
- Create: `src/games/school-escape/schoolEscapeLevel.test.ts`

**Interfaces:**
- Produces: `GOLDEN_SLICE_LEVEL`.
- Produces: `resolvePlayerCollision(position, radius)`.
- Produces: `hasLineOfSight(from, to)`.
- Produces: `nearestHideSurface(position)`.
- Produces fixed teacher patrol/search points and near-miss/completion triggers.

- [ ] **Step 1: Lock the coordinate system and authored layout in tests**

Use meters-like world units and Y-up:

```ts
playerSpawn = { x: 0, y: 0, z: -2.5 }
classroomBounds = { minX: -4, maxX: 4, minZ: -5, maxZ: 4 }
hallwayBounds = { minX: -1.6, maxX: 1.6, minZ: 4, maxZ: 24 }
lockerBayBounds = { minX: 1.6, maxX: 5.6, minZ: 11.5, maxZ: 18.5 }
teacherStart = { x: -7, y: 0, z: 20 }
nearMissTriggerZ = 8
completionTrigger = { minX: 1.8, maxX: 5.3, minZ: 17.2, maxZ: 18.3 }
```

The hallway opens into a cross-hall at `z=20` so the teacher can traverse `x=-7 -> x=7` visibly before entering investigation/chase behavior.

- [ ] **Step 2: Define hide surfaces with canonical scoring colors**

At minimum:

```ts
{
  id: 'locker-blue',
  center: { x: 5.45, y: 1.0, z: 14.7 },
  normal: { x: -1, y: 0, z: 0 },
  halfWidth: 2.2,
  halfHeight: 1.25,
  canonicalColor: { r: 0.12, g: 0.30, b: 0.54 },
}
```

Add one secondary hide surface around the classroom/hall return corner so a detected player can break LOS and re-hide during the validation chase.

- [ ] **Step 3: Write failing geometry tests**

Cover:
- spawn is not inside a collision rectangle;
- the doorway from classroom to hall is traversable;
- all patrol/search nodes are reachable through authored openings;
- `nearestHideSurface` returns `locker-blue` in the locker bay and `null` beyond `0.8` distance;
- a hall wall blocks LOS while an open corridor does not;
- completion trigger is beyond the first camouflage lesson, not reachable directly from spawn without traversing the hall.

- [ ] **Step 4: Implement simple deterministic geometry**

Use axis-aligned XZ wall/obstacle rectangles and a circle/capsule-like player radius (`0.35`). Keep visible geometry separate from collision. Reuse the same collision rectangles for LOS segment intersection so hiding/perception agree with navigation.

Teacher navigation uses a small authored graph; no navmesh dependency.

- [ ] **Step 5: Run tests GREEN and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeLevel.test.ts
git add src/games/school-escape/schoolEscapeLevel.ts src/games/school-escape/schoolEscapeLevel.test.ts
git commit -m "feat: add School Escape golden-slice level data"
```

---

### Task 6: Build responsive player locomotion, animation blending, and the premium third-person camera

**Files:**
- Create: `src/games/school-escape/schoolEscapePlayer.ts`
- Create: `src/games/school-escape/schoolEscapeCamera.ts`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`
- Modify: `src/games/school-escape/schoolEscapeLogic.test.ts`

**Interfaces:**
- `SchoolEscapePlayerController.update(dt, input, cameraYaw)` returns player motion snapshot.
- `SchoolEscapeCameraController.addLookDelta(dx, dy)`, `update(dt, playerSnapshot, sprinting)`, `reset()`.
- Runtime owns both and passes camera-relative input to player.

- [ ] **Step 1: Add pure motion tests for target feel**

Lock initial tuning:

```ts
PLAYER_MOVE_SPEED = 3.2
PLAYER_SPRINT_SPEED = 4.8
PLAYER_ACCEL = 16
PLAYER_DECEL = 20
PLAYER_JUMP_VELOCITY = 5.2
PLAYER_GRAVITY = -14
```

Tests prove acceleration reaches but does not exceed target speed, deceleration returns cleanly to zero, and sprint speed remains above teacher chase speed.

- [ ] **Step 2: Bind the rigged player model and animation groups**

`schoolEscapePlayer.ts` owns:
- invisible collision proxy/root transform;
- model parented to proxy;
- animation-group lookup from loaded assets;
- locomotion blend decisions;
- jump/fall/land state transitions;
- movement/rotation integration against `resolvePlayerCollision`.

Do not let animation root motion drive authoritative movement. Input responsiveness wins; animation follows the kinematic controller.

- [ ] **Step 3: Implement camera-relative movement**

Convert input X/Y by camera yaw. Rotate player toward the planar desired-motion vector with bounded angular interpolation. Use analog stick magnitude to blend walk/run; keyboard full deflection maps to run speed unless sprint is held.

- [ ] **Step 4: Implement the camera as its own controller**

Initial values:

```ts
preferredDistance = 4.5
pivotHeight = 1.45
normalFov = 55 degrees
sprintFov = 62 degrees
yawSensitivity = 0.0035 radians/pixel
pitchSensitivity = 0.0028 radians/pixel
minPitch = -0.55 radians
maxPitch = 0.85 radians
followSharpness = 12
occlusionPadding = 0.25
```

Use a ray from player pivot to desired camera position against simple authored occluders/collision geometry. Push the camera inward on obstruction; recover outward smoothly and quickly when clear. Disable auto-recenter while look input has occurred in the previous `1.25s`; otherwise gently bias yaw behind player travel direction.

- [ ] **Step 5: Integrate runtime frame order**

Per frame:

```text
1. clamp dt to <= 1/15s
2. read semantic move/sprint/jump + consume look delta
3. update player kinematics/collision
4. update player animation
5. update camera orbit/follow/occlusion/FOV
6. run teacher/perception tasks (Task 7)
7. update low-frequency UI snapshot only if relevant values changed
8. render scene
```

- [ ] **Step 6: Manual empty-room quality gate**

Before adding teacher integration, verify in local browser:
- WASD starts quickly without instant robotic snapping;
- release does not skate;
- 180-degree changes animate/turn cleanly;
- sprint feels faster and camera/FOV reinforces speed without nausea;
- jump is restrained and landing is grounded;
- camera does not clip through classroom/hall walls;
- camera returns to preferred distance after corners;
- mouse/touch look has no noticeable smoothing lag.

Do not continue to teacher polish if this gate feels poor; tune these constants first.

- [ ] **Step 7: Run relevant automated tests and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeLogic.test.ts src/games/school-escape/schoolEscapeInput.test.ts
npm run lint
git add src/games/school-escape
git commit -m "feat: add School Escape movement and camera"
```

---

### Task 7: Implement teacher perception, patrol, scripted near-miss, chase, search, and re-hide

**Files:**
- Create: `src/games/school-escape/schoolEscapeTeacher.ts`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`
- Modify: `src/games/school-escape/schoolEscapeLogic.ts`
- Modify: `src/games/school-escape/schoolEscapeLogic.test.ts`
- Modify: `src/games/school-escape/schoolEscapeLevel.ts`

**Interfaces:**
- `SchoolEscapeTeacherController.update(dt, perceptionInput)` maps deterministic state to Babylon movement/animation.
- Runtime produces perception samples from geometry, movement, and camouflage.
- Teacher controller emits semantic events `shout`, `caught`, `alertChanged` without owning React UI.

- [ ] **Step 1: Add exact perception tests before world behavior**

Implement/test:

```ts
export function computeTeacherVisibility(input: {
  distance: number
  sightRange: number
  viewAlignment: number
  hasLineOfSight: boolean
  playerHorizontalSpeed: number
  sprinting: boolean
  camouflageMultiplier: number
}): number
```

Initial model:

```text
distanceFactor = clamp(1 - distance / sightRange, 0, 1)
angleFactor = smoothstep(0.25, 0.8, viewAlignment)
movementFactor = sprinting ? 1.0 : speed > 0.18 ? 0.72 : 0.32
visibility = LOS ? distanceFactor * angleFactor * movementFactor * camouflageMultiplier : 0
```

Tests must prove no LOS => zero visibility, sprinting is easier to detect than stillness, and strong camouflage reduces but never mathematically guarantees zero visibility.

- [ ] **Step 2: Implement the partially scripted near-miss trigger**

Before the player crosses `z=8`, teacher waits outside the visible cross-hall segment. Crossing the trigger starts one authored traversal from `(-7, 20)` to `(7, 20)` at patrol speed. This trigger fires once per run.

The teacher is audible before visible; Task 9 supplies the audio, but Task 7 emits `teacherApproaching`/footstep position events.

Weak evidence enters `suspicious`; it cannot skip to an unavoidable scripted catch. Direct clear exposure can still enter chase through normal perception rules.

- [ ] **Step 3: Implement teacher world movement and state animations**

Map deterministic states:

```text
patrol -> Walk
suspicious -> Suspicious
search -> Search / Walk
chase -> Run
recover -> Recover, then Walk
```

Use authored waypoint graph targets and local steering. Search checks a fixed bounded sequence around the last seen position. Do not add navmesh generation.

- [ ] **Step 4: Implement chase fairness and catch**

Teacher chase speed is `4.2`; player sprint is `4.8`. Teacher chases current position while visible, then last-known position after LOS breaks. After `1.25s` without valid sight, transition to search. Catch radius starts at `0.7` and triggers the temporary caught state.

`shout` fires exactly once on each transition into chase and is consumed by UI/audio, not repeated every frame.

- [ ] **Step 5: Implement golden-slice completion condition**

After the player survives the near-miss (teacher passes or a chase resolves) and enters the locker-bay completion trigger, emit `complete`. Show a concise golden-slice completion overlay; do not implement the full house win sequence.

- [ ] **Step 6: Automated + manual validation**

```bash
npm test -- src/games/school-escape/schoolEscapeLogic.test.ts src/games/school-escape/schoolEscapeLevel.test.ts
```

Manual scenarios:
1. strong locker match + stillness -> teacher passes;
2. mediocre match -> suspicion animation/turn before chase;
3. sprint openly -> chase + one `Come back here!` event;
4. break LOS around locker bay/classroom corner -> search;
5. strong re-hide -> search ends -> recover -> patrol;
6. allow teacher within catch radius -> caught/retry.

- [ ] **Step 7: Commit**

```bash
git add src/games/school-escape
git commit -m "feat: add School Escape teacher encounter"
```

---

### Task 8: Build the contextual radial paint palette and minimal world-first HUD

**Files:**
- Modify: `src/games/school-escape/SchoolEscapeGame.tsx`
- Modify: `src/games/school-escape/SchoolEscapeGame.test.tsx`
- Modify: `src/games/school-escape/schoolEscape.css`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`
- Modify: `src/games/school-escape/schoolEscapePlayer.ts`

**Interfaces:**
- React owns `PaintMix` and calls runtime `setPaintMix(mix)`.
- Runtime emits a low-frequency `SchoolEscapeUiSnapshot` containing `nearbySurfaceId`, `matchScore`, `teacherAlert`, `subtitle`, `phase`.
- No numeric match/RGB values are rendered to players.

- [ ] **Step 1: Expand the runtime controller/UI interface explicitly**

Add:

```ts
export type TeacherAlert = 'none' | 'suspicious' | 'alert'
export type SchoolEscapePhase = 'loading' | 'playing' | 'caught' | 'complete' | 'error'

export type SchoolEscapeUiSnapshot = {
  nearbySurfaceId: string | null
  matchScore: number | null
  teacherAlert: TeacherAlert
  subtitle: string | null
  phase: SchoolEscapePhase
}

export type SchoolEscapeRuntimeController = {
  setPaintMix(mix: PaintMix): void
  resize(): void
  pause(): void
  resume(): void
  restart(): Promise<void>
  dispose(): void
}
```

`onUiSnapshot(snapshot)` is supplied in runtime options and is emitted only on meaningful change or a bounded interval (<=10Hz), never every render frame.

- [ ] **Step 2: Write failing UI tests**

Assert:
- palette absent when `nearbySurfaceId` is null;
- palette visible when a hideable surface is nearby;
- buttons/controls are named Red, Yellow, Blue, White, Black, Clean paint;
- no text matching RGB numeric channels or `POOR|CLOSE|BLENDED|PATROL|SEARCH|CHASE` exists;
- suspicion alert is contextual;
- subtitle `Come back here!` appears on shout snapshot;
- caught and completion overlays expose Retry / Return to Games as appropriate.

- [ ] **Step 3: Implement a radial five-pigment interaction**

Use five 44px+ pigment buttons around the swatch. Pointer down begins adding that pigment; pointer up/cancel stops. Use `requestAnimationFrame` or a bounded timer while held to increase contribution by `0.35 units/second`, clamped to `0..1`.

`Clean paint` resets to `EMPTY_PAINT_MIX`. Keyboard users can focus each button and use native press/hold semantics without global WASD/Space stealing the event.

- [ ] **Step 4: Render the match ring without numeric values**

Use CSS custom property `--match-progress` and a conic-gradient ring. Map `matchScore 0..1` to ring completion, but never expose the numeric score as text or ARIA value. Accessible copy can say `Paint match getting stronger` / `Paint match strong` using broad states if needed; it must not reveal a percentage.

- [ ] **Step 5: Apply paint to the player model**

`schoolEscapePlayer.ts` resolves material `PlayerPaint` once after load. On mix changes, set its base/albedo color from `displayedClothingColor(mix)`. Do not mutate hair/skin/eye materials.

- [ ] **Step 6: Keep mobile controls uncluttered during paint mode**

When palette is visible, shift/reduce Sprint/Jump presentation so the palette does not overlap the teacher/hide surface. Movement remains usable. The right look region must ignore events originating in the palette/buttons.

- [ ] **Step 7: Run tests and commit**

```bash
npm test -- src/games/school-escape/SchoolEscapeGame.test.tsx src/games/school-escape/schoolEscapeLogic.test.ts
npm run lint
git add src/games/school-escape
git commit -m "feat: add School Escape camouflage HUD"
```

---

### Task 9: Add final-quality music, positional ambience, footsteps, voice, and state-driven audio

**Files:**
- Create: all audio files listed in File Structure
- Modify: `public/games/school-escape/ASSET_PROVENANCE.md`
- Create: `src/games/school-escape/schoolEscapeAudio.ts`
- Create: `src/games/school-escape/schoolEscapeAudio.test.ts`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`

**Interfaces:**
- Produces: `SchoolEscapeAudioController` with `unlock()`, `setDangerLevel()`, `playWorldCue()`, `playTeacherShout()`, `pause()`, `resume()`, `dispose()`.
- Consumes teacher/player world positions but does not own gameplay decisions.

- [ ] **Step 1: Create/acquire the exact committed audio set with commercial-safe rights**

Required final files:

```text
music/exploration.ogg
music/tension.ogg
music/chase.ogg
voice/come-back-here.ogg
sfx/player-step-1.ogg
sfx/player-step-2.ogg
sfx/teacher-step-1.ogg
sfx/teacher-step-2.ogg
sfx/door.ogg
sfx/locker.ogg
sfx/paint.ogg
sfx/jump.ogg
sfx/land.ogg
```

The three music loops must share a coherent musical identity so crossfades feel like escalation rather than unrelated track changes. The voice line is exactly `Come back here!`; subtitle remains authoritative. Record every source/license/modification in `ASSET_PROVENANCE.md` before commit.

- [ ] **Step 2: Write audio-policy tests before controller code**

Pure helper tests must map:

```text
teacherAlert none -> exploration
teacherAlert suspicious -> tension
teacherAlert alert/chase -> chase
```

Also test that pause/dispose stops active loops and that `playTeacherShout()` is de-duplicated per chase episode.

- [ ] **Step 3: Implement audio orchestration**

Use app-served audio assets. Keep authored music/SFX separate from gameplay state. Crossfade music over roughly `0.6s`; duck music around teacher voice so the line is readable. Use bounded simultaneous world cues.

For positional teacher/player cues, use Web Audio panning where available; gracefully fall back to non-positional playback without changing game rules.

Do not create audio context/playback until user interaction permits it. If autoplay is blocked, gameplay continues and `unlock()` retries on the next interaction.

- [ ] **Step 4: Integrate animation-event footsteps and encounter cues**

Use animation normalized-time markers or a bounded cadence tied to actual locomotion speed; do not fire a new sound every render tick. Teacher-approaching cue starts before the teacher becomes visible in the scripted near-miss.

- [ ] **Step 5: Validate mix in browser**

Manual checks:
- exploration music is present but does not mask footsteps;
- suspicion layer arrives gradually;
- chase transition feels energetic, not like a hard unrelated track cut;
- teacher footsteps communicate left/right/approach direction on headphones where supported;
- `Come back here!` is intelligible and not repeated continuously;
- hidden tab / retry / route unmount does not leave loops playing.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeAudio.test.ts
npm run build
git add public/games/school-escape src/games/school-escape/schoolEscapeAudio.ts src/games/school-escape/schoolEscapeAudio.test.ts src/games/school-escape/schoolEscapeRuntime.ts
git commit -m "feat: add School Escape adaptive audio"
```

---

### Task 10: Add adaptive quality, loading/error/retry, and lifecycle hardening

**Files:**
- Create: `src/games/school-escape/schoolEscapeQuality.ts`
- Create: `src/games/school-escape/schoolEscapeQuality.test.ts`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`
- Modify: `src/games/school-escape/SchoolEscapeGame.tsx`
- Modify: `src/games/school-escape/SchoolEscapeGame.test.tsx`
- Modify: `src/games/school-escape/schoolEscape.css`

**Interfaces:**
- Produces: `QualityTier = 'high' | 'medium' | 'low'`.
- Produces: `QUALITY_SETTINGS`, `chooseInitialQuality()`, `updateQualityPolicy()`.
- Runtime consumes settings; gameplay collision/perception is invariant across tiers.

- [ ] **Step 1: Lock quality settings in failing tests**

Use:

```ts
export const QUALITY_SETTINGS = {
  high: {
    dprCap: 1.75,
    shadowMapSize: 1024,
    softShadows: true,
    effectDensity: 1,
  },
  medium: {
    dprCap: 1.35,
    shadowMapSize: 512,
    softShadows: false,
    effectDensity: 0.6,
  },
  low: {
    dprCap: 1,
    shadowMapSize: 256,
    softShadows: false,
    effectDensity: 0.25,
  },
} as const
```

Initial tier policy:
- low when `deviceMemory <= 4` (when available) or `hardwareConcurrency <= 4`;
- medium when `deviceMemory <= 8`, `hardwareConcurrency <= 8`, or device DPR > 2.5;
- high otherwise.

Missing capability APIs default to medium, not high.

- [ ] **Step 2: Test downgrade hysteresis**

Policy samples clamped frame times and uses an EMA. After a 3-second warm-up:
- high -> medium only after EMA > 22ms continuously for 4 seconds;
- medium -> low only after EMA > 30ms continuously for 4 seconds;
- do not upgrade during the same play session.

Tests must prove short spikes do not downgrade and sustained overload does.

- [ ] **Step 3: Apply tiers without changing gameplay semantics**

Runtime applies DPR cap via engine hardware scaling, shadow map size/filter/fallback, and decorative effect density. Low tier may replace expensive soft character shadows with a cheap contact/blob fallback if needed. Never change collision geometry, hide-surface colors, perception thresholds, teacher speed, or UI based on tier.

- [ ] **Step 4: Harden lifecycle and timing**

Runtime requirements:
- clamp simulation `dt` to `<= 1/15s`;
- on `document.hidden`, pause simulation/render/audio and reset held input;
- on resume, reset the timestamp before the next step;
- resize on window/fullscreen/orientation changes;
- dispose scene, engine, observers, timers, media nodes, pointer listeners on route unmount;
- restart rebuilds clean state or resets every mutable subsystem explicitly; no stale teacher suspicion/velocity/camera/audio layers.

- [ ] **Step 5: Complete loading/error/retry UI tests**

Mock runtime creation rejection and assert:
- visible clear launch error;
- Retry calls runtime creation again;
- Return to Games links to `/games`;
- no blank canvas-only failure.

Mock caught state and assert Retry reconstructs a fresh run. Mock complete state and assert a concise `Golden slice complete` result without pretending the full game has been won.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeQuality.test.ts src/games/school-escape/SchoolEscapeGame.test.tsx
npm run lint
git add src/games/school-escape
git commit -m "feat: harden School Escape quality and lifecycle"
```

---

### Task 11: Integrate, validate bundle/performance, open the focused PR, and run the player quality gate

**Files:**
- Modify as required by integration findings only within #26 scope.
- Update: `public/games/school-escape/ASSET_PROVENANCE.md` if any asset changes during polish.
- PR metadata: one focused PR closing #26.

**Interfaces:**
- Consumes all previous tasks.
- Produces one playable Vercel/branch preview and evidence for #26 acceptance.

- [ ] **Step 1: Run all focused tests first**

```bash
npm test -- \
  src/App.test.tsx \
  src/games/school-escape/SchoolEscapeGame.test.tsx \
  src/games/school-escape/schoolEscapeLogic.test.ts \
  src/games/school-escape/schoolEscapeInput.test.ts \
  src/games/school-escape/schoolEscapeLevel.test.ts \
  src/games/school-escape/schoolEscapeAssets.test.ts \
  src/games/school-escape/schoolEscapeAudio.test.ts \
  src/games/school-escape/schoolEscapeQuality.test.ts
```

Fix only failures caused by #26 work.

- [ ] **Step 2: Run the repository gate**

```bash
npm test
npm run lint
npm run build
```

All must pass.

- [ ] **Step 3: Inspect production bundle isolation**

From Vite build output, record:
- initial app JS gzip size;
- School Escape page/runtime chunk(s) gzip size;
- Babylon chunk(s) gzip size;
- total School Escape GLB texture/audio bytes.

Verify navigating to `/`, `/games`, or another game does not request School Escape GLBs/audio or execute Babylon runtime code.

- [ ] **Step 4: Run desktop gameplay validation**

In Chromium, then Firefox where practical:

1. load `/game-preview/school-escape` fresh;
2. verify branded loading -> playable scene;
3. walk/run/sprint/jump through classroom/hall/locker bay;
4. orbit camera repeatedly near every wall/corner and verify no persistent clipping;
5. verify first teacher audio precedes visual contact;
6. hide with a strong paint match and stillness;
7. intentionally create mediocre match and verify suspicion before chase;
8. sprint in open view and verify one shout/chase;
9. break LOS and re-hide successfully;
10. get caught and Retry; confirm fully clean state;
11. finish the slice and confirm completion presentation;
12. tab hide/restore, blur/focus, fullscreen enter/exit, resize; confirm no stuck input/audio or simulation jumps.

Record observed issues in the PR; do not call the slice complete merely because it renders.

- [ ] **Step 5: Run mobile gameplay validation**

At minimum iPhone Safari landscape; Android Chrome landscape where practical:
- movement + look simultaneously;
- movement + sprint;
- movement + jump;
- paint palette reachability and no overlap with teacher/hide surface;
- right-look region ignores palette touches;
- orientation/resize/safe areas;
- background/foreground interruption;
- retry;
- sustained play long enough to observe thermal/frame degradation rather than only first minute.

- [ ] **Step 6: Validate adaptive quality on representative lower-powered hardware**

Observe frame stability during classroom movement, teacher crossing, chase, and paint interaction. Force each tier once in a local debug-only test hook or unit harness, then remove the hook before commit. Confirm low tier remains visually readable and gameplay-identical.

Acceptance target: stable 60 FPS on capable hardware; stable degraded play preferably 30+ FPS on representative lower-powered hardware. If sustained frame timing collapses, profile and reduce expensive visual work before acceptance rather than weakening gameplay.

- [ ] **Step 7: Run the final player-experience gate**

The user/player must explicitly approve all of these before the PR is ready:
- movement/camera feels premium;
- classroom/hall/locker bay no longer looks like a prototype;
- player/teacher characters and animations read coherently;
- warm/cool lighting works without muddy darkness;
- paint mixing is understandable without numeric/debug UI;
- near-miss teaches the mechanic without a tutorial modal;
- suspicion/chase/search/re-hide is readable/fair;
- soundtrack/audio supports adventure+tension and does not become annoying;
- mobile controls feel first-class;
- lower-end/adaptive behavior is acceptable.

If the answer is not clearly yes, keep the PR draft and iterate inside #26 scope. Do not expand the full school.

- [ ] **Step 8: Re-run the exact final gate after the last polish change**

```bash
npm test
npm run lint
npm run build
```

Record exact final results in the PR body.

- [ ] **Step 9: Commit final integration polish**

```bash
git add src public package.json package-lock.json
git commit -m "feat: complete School Escape golden slice"
```

Skip this commit if the working tree is already clean because earlier focused commits contain the final state.

- [ ] **Step 10: Open one focused draft PR**

Title:

```text
feat: build School Escape premium golden slice
```

Body must include:

```text
Closes #26
```

plus:
- summary of Babylon/local runtime architecture;
- asset provenance/licensing summary;
- automated test/lint/build evidence;
- bundle/asset-size evidence;
- desktop/mobile/lower-end manual validation performed and gaps;
- screenshots/video from real gameplay if available;
- explicit note that PR #17 was superseded and not used as a base.

Keep the PR draft until the hands-on quality gate passes. Do not merge without explicit user authorization.

---

## Plan Self-Review Checklist

Before execution begins, confirm:

- Every Issue #26 acceptance criterion maps to at least one task above.
- The temporary route is lazy and absent from `gameCatalog`/discovery.
- Babylon dependency versions are exact and game-local.
- Paint algorithm family, constants, and scoring space are locked.
- Teacher state model includes the approved fairness buffer and re-hide path.
- Player/teacher speeds preserve player sprint advantage.
- Camera and movement are independently quality-gated before teacher polish.
- Art/audio assets have exact filenames/contracts and provenance requirements.
- Final-quality audio/voice is required before acceptance.
- Quality tiers cannot change gameplay semantics.
- Lifecycle cleanup includes visibility, focus, pointer cancellation, retry, resize, and route unmount.
- Real desktop/mobile/lower-end validation is mandatory before completion.
- No full-school/outdoor/principal scope leaked into #26.
- No shared 3D abstraction, physics engine, WebGPU requirement, feature-flag platform, analytics, or unrelated cleanup was introduced.
