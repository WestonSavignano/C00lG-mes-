# School Escape Golden-Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved premium School Escape golden slice — art classroom -> main hallway -> locker bay -> teacher near-miss/camouflage — as a lazy Babylon.js WebGL-compatible browser-game preview that passes real desktop/mobile quality validation before the full game expands.

**Architecture:** `SchoolEscapePage` owns the shared `GameViewport`; `SchoolEscapeGame` owns React lifecycle/contextual HUD/touch input inside that viewport; an imperative Babylon runtime owns rendering, transforms, animation, camera, collision, perception sampling, and frame timing; pure game-local modules own paint/color, camouflage, teacher-state, movement math, quality policy, and other deterministic rules. Expose the unfinished slice only at `/game-preview/school-escape`; do not add it to the published game catalog until the complete game is ready.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, existing shared semantic input/GameViewport infrastructure, `@babylonjs/core@9.26.0`, `@babylonjs/loaders@9.26.0`, GLB/glTF assets, HTML/CSS HUD, authored `.ogg` music/voice/SFX.

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
- Keep provenance for every committed 3D/audio asset. Current Quaternius QAL restricts redistribution of assets themselves, so do not commit raw Quaternius files to this public repository without a fresh explicit license review. Kenney CC0 is an acceptable fallback for incidental/non-hero base material, but the player, teacher, and environment must still meet the custom stylized direction.
- Final-quality slice acceptance requires original or clearly commercial-safe music/voice/SFX; do not ship the quality gate on browser-generated tones or `speechSynthesis`.
- No full school maze, exit lobby, outdoor chase, house win scene, or finished principal-office fail cutscene in #26.
- No shared/site-wide 3D-engine abstraction, general feature-flag platform, analytics, accounts, multiplayer, monetization, or unrelated cleanup.
- Required repository gate: `npm test`, `npm run lint`, `npm run build`.
- Automated checks cannot approve the slice. The PR stays draft / `needs-playtest` until hands-on player review approves the visual/game-feel bar.

---

## File Structure

### Modify

- `package.json` — exact Babylon runtime dependencies.
- `package-lock.json` — locked dependency graph.
- `src/App.tsx` — one temporary lazy `/game-preview/school-escape` route.
- `src/App.test.tsx` — preview-route and non-catalog assertions only; do not repeat #27 cleanup here.
- `src/shell/AppShell.tsx` — treat the temporary preview route as immersive while it exists.

### Create under `src/games/school-escape/`

- `SchoolEscapePage.tsx` — thin route adapter that owns `GameViewport` and nests `SchoolEscapeGame`.
- `SchoolEscapeGame.tsx` — React lifecycle, HUD state, paint UI, touch overlay, loading/error/retry.
- `SchoolEscapeGame.test.tsx` — React/UI behavior.
- `schoolEscape.css` — game-local visual/touch/HUD styles.
- `schoolEscapeTypes.ts` — shared game-local types/constants.
- `schoolEscapeLogic.ts` — pure RYB mixing, OKLab scoring, camouflage, teacher-state, perception, movement helpers.
- `schoolEscapeLogic.test.ts` — deterministic rules.
- `schoolEscapeInput.ts` — keyboard bindings + camera-look accumulator.
- `schoolEscapeInput.test.ts` — input semantics/reset behavior.
- `schoolEscapeLevel.ts` — fixed golden-slice collision/nav/hide-surface/trigger data.
- `schoolEscapeLevel.test.ts` — level invariants/LOS geometry.
- `schoolEscapeAssets.ts` — local asset manifest + GLB load/validation.
- `schoolEscapeAssets.test.ts` — asset contract/provenance invariants.
- `schoolEscapePlayer.ts` — player proxy/model/animation/movement integration.
- `schoolEscapeCamera.ts` — spring follow/orbit/occlusion/FOV framing.
- `schoolEscapeTeacher.ts` — teacher world/path/animation controller.
- `schoolEscapeQuality.ts` — pure adaptive-quality policy/settings.
- `schoolEscapeQuality.test.ts` — tier/downgrade/hysteresis tests.
- `schoolEscapeAudio.ts` — soundtrack/ambience/voice/SFX orchestration.
- `schoolEscapeAudio.test.ts` — pure audio-state/cleanup tests.
- `schoolEscapeRuntime.ts` — Babylon engine/scene, lighting, frame loop, integration, disposal.

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
- Produces lazy route `/game-preview/school-escape`.
- Produces `createSchoolEscapeRuntime(options): Promise<SchoolEscapeRuntimeController>`.
- Produces initial `SchoolEscapeRuntimeController` with `resize()`, `pause()`, `resume()`, `restart()`, `dispose()`.
- Consumes existing `GameViewport`.

- [ ] **Step 1: Verify the prerequisite baseline**

From fresh `main` after #27 lands:

```bash
npm ci
npm test
npm run lint
npm run build
```

Expected: all succeed before branching.

- [ ] **Step 2: Create the implementation branch/worktree from current `main`**

Branch:

```text
feature/school-escape-golden-slice
```

Do not cherry-pick PR #17.

- [ ] **Step 3: Write failing route/publication tests**

Add to `src/App.test.tsx`:

```tsx
it('loads School Escape only through the unlisted preview route', async () => {
  const { container } = renderRoute('/game-preview/school-escape')

  expect(await screen.findByTestId('game-viewport')).toHaveAttribute(
    'data-game',
    'school-escape',
  )
  expect(container.querySelector('.app-shell')).toHaveAttribute(
    'data-game-route',
    'true',
  )
})

it('does not publish School Escape in discovery while it is a golden slice', () => {
  renderRoute('/games')
  expect(screen.queryByText('School Escape')).not.toBeInTheDocument()
})
```

If `renderRoute()` does not currently return `render(...)`, update the helper to return that result. Do not hardcode the catalog count; another unrelated catalog change should not make this assertion stale.

Create `SchoolEscapeGame.test.tsx` with a mocked runtime module and assert mount calls `createSchoolEscapeRuntime`, unmount calls `dispose`, and `SchoolEscapePage` exposes a `GameViewport` labeled `School Escape` with `data-game="school-escape"`.

- [ ] **Step 4: Run focused tests RED**

```bash
npm test -- src/App.test.tsx src/games/school-escape/SchoolEscapeGame.test.tsx
```

Expected: route/page/runtime are missing.

- [ ] **Step 5: Install exact Babylon dependencies**

```bash
npm install --save-exact @babylonjs/core@9.26.0 @babylonjs/loaders@9.26.0
```

Do not add Babylon GUI, physics, or legacy UMD packages.

- [ ] **Step 6: Add the one-off lazy route**

In `src/App.tsx`:

```tsx
const SchoolEscapePreviewPage = lazy(
  () => import('./games/school-escape/SchoolEscapePage'),
)
```

Route it at `/game-preview/school-escape` with a small branded `role="status"` Suspense fallback. Do not add a catalog definition.

In `AppShell.tsx`:

```ts
const isSchoolEscapePreview = location.pathname === '/game-preview/school-escape'
const isGameRoute = Boolean(getGameByRoute(location.pathname)) || isSchoolEscapePreview
```

- [ ] **Step 7: Add the page/viewport/game ownership exactly**

`SchoolEscapePage.tsx`:

```tsx
function SchoolEscapePage() {
  return (
    <GameViewport game="school-escape" label="School Escape">
      <SchoolEscapeGame />
    </GameViewport>
  )
}
```

`SchoolEscapeGame` renders the canvas plus its game-local absolute HUD/touch layers as children inside the shared viewport; it does not create a second `GameViewport`.

Initial runtime contract:

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
```

Task 1 runtime creates/disposes a Babylon `Engine` + `Scene` only. Use modular imports (`@babylonjs/core/Engines/engine`, `@babylonjs/core/scene`) and keep the glTF loader import inside the lazy game module graph.

- [ ] **Step 8: Run focused tests/build GREEN and inspect lazy output**

```bash
npm test -- src/App.test.tsx src/games/school-escape/SchoolEscapeGame.test.tsx
npm run build
```

Confirm Babylon is not requested/executed on `/`, `/games`, or another game route.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/App.tsx src/App.test.tsx src/shell/AppShell.tsx src/games/school-escape
git commit -m "feat: add School Escape Babylon preview boundary"
```

---

### Task 2: Implement deterministic paint, camouflage, perception, movement, and teacher-state rules

**Files:**
- Create: `src/games/school-escape/schoolEscapeTypes.ts`
- Create: `src/games/school-escape/schoolEscapeLogic.ts`
- Create: `src/games/school-escape/schoolEscapeLogic.test.ts`

**Interfaces:**
- Produces `PaintPigment`, `PaintMix`, `SrgbColor`, `OklabColor`, `CamouflageSample`, `TeacherState`, `TeacherSnapshot`, `TeacherPerceptionSample`, `SchoolEscapeFrameInput`.
- Produces `mixPaint()`, `displayedClothingColor()`, `srgbToOklab()`, `colorMatchScore()`, `camouflageVisibilityMultiplier()`, `computeTeacherVisibility()`, `updateTeacherState()`, `stepScalarSpeed()`.

- [ ] **Step 1: Define exact game-local types/constants**

```ts
export type PaintPigment = 'red' | 'yellow' | 'blue' | 'white' | 'black'
export type PaintMix = Readonly<Record<PaintPigment, number>>
export type SrgbColor = Readonly<{ r: number; g: number; b: number }>
export type OklabColor = Readonly<{ l: number; a: number; b: number }>
export type SchoolEscapeAction = 'sprint' | 'jump'
export type SchoolEscapeFrameInput = Readonly<{
  moveX: number
  moveY: number
  sprint: boolean
  jumpPressed: boolean
}>
export type CamouflageSample = Readonly<{
  match: number
  surfaceDistance: number
  horizontalSpeed: number
  grounded: boolean
}>
export type TeacherState = 'patrol' | 'suspicious' | 'search' | 'chase' | 'recover'
export type TeacherSnapshot = Readonly<{
  state: TeacherState
  suspicion: number
  lostSightFor: number
  stateElapsed: number
  shout: boolean
}>
export type TeacherPerceptionSample = Readonly<{
  visibility: number
  hasLineOfSight: boolean
  dt: number
}>

export const EMPTY_PAINT_MIX: PaintMix = {
  red: 0, yellow: 0, blue: 0, white: 0, black: 0,
}
export const BASE_OUTFIT_COLOR: SrgbColor = { r: 0.055, g: 0.065, b: 0.085 }
export const PLAYER_MOVE_SPEED = 3.2
export const PLAYER_SPRINT_SPEED = 4.8
export const TEACHER_PATROL_SPEED = 2.0
export const TEACHER_CHASE_SPEED = 4.2
```

- [ ] **Step 2: Write failing RYB/OKLab tests**

Tests must prove:

```text
red + yellow -> orange-dominant
Yellow + blue -> green-dominant
red + blue -> purple-dominant
white raises luminance
black lowers luminance
same displayed color -> match score 1
same mix -> same output every call
```

Test-only hue/luminance helpers stay in the test file.

- [ ] **Step 3: Run tests RED**

```bash
npm test -- src/games/school-escape/schoolEscapeLogic.test.ts
```

- [ ] **Step 4: Implement the fixed RYB cube and paint-spread model**

Use these eight trilinear RYB cube corners:

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

Clamp each pigment to `0..1`. Divide R/Y/B by the maximum nonzero primary value and use those values as trilinear coordinates. Apply white with `lerp(base, WHITE, white)` and then black with `lerp(result, BLACK, black)`.

Paint visibly spreads across the base outfit:

```ts
const coverage = clamp(
  (mix.red + mix.yellow + mix.blue + mix.white + mix.black) / 1.25,
  0,
  1,
)
return lerpColor(BASE_OUTFIT_COLOR, mixPaint(mix), coverage)
```

Match scoring uses `displayedClothingColor(mix)`.

- [ ] **Step 5: Implement standard sRGB -> linear RGB -> OKLab and deterministic score**

Use the standard OKLab matrices. Euclidean OKLab distance is normalized by:

```ts
const OKLAB_MAX_GAME_DISTANCE = 0.55
score = 1 - clamp(distance / OKLAB_MAX_GAME_DISTANCE, 0, 1)
```

Hands-on tuning may adjust only tuning constants/thresholds, not replace the algorithm family without revisiting the design.

- [ ] **Step 6: Write failing camouflage/perception/state/motion tests**

Cover:
- strong match + near wall + still + grounded => visibility multiplier < `0.25`;
- sprinting => multiplier `1` even with a strong match;
- no LOS => teacher visibility `0`;
- sprinting is easier to detect than stillness;
- strong camouflage reduces but never creates guaranteed zero visibility when LOS/distance are otherwise strong;
- patrol -> suspicious -> chase -> search -> recover -> patrol;
- `shout` true only on chase entry;
- `TEACHER_CHASE_SPEED < PLAYER_SPRINT_SPEED`;
- `stepScalarSpeed()` accelerates/decelerates without overshoot.

- [ ] **Step 7: Implement deterministic rule constants**

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

For eligible camouflage, map match `0.72..1.0` smoothly to multiplier `1.0..0.12`.

Teacher world visibility:

```text
distanceFactor = clamp(1 - distance / sightRange, 0, 1)
angleFactor = smoothstep(0.25, 0.8, viewAlignment)
movementFactor = sprinting ? 1.0 : speed > 0.18 ? 0.72 : 0.32
visibility = hasLOS ? distanceFactor * angleFactor * movementFactor * camouflageMultiplier : 0
```

Keep `updateTeacherState()` Babylon-free.

- [ ] **Step 8: Run tests GREEN and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeLogic.test.ts
git add src/games/school-escape/schoolEscapeTypes.ts src/games/school-escape/schoolEscapeLogic.ts src/games/school-escape/schoolEscapeLogic.test.ts
git commit -m "feat: add School Escape deterministic gameplay rules"
```

---

### Task 3: Implement desktop/mobile semantic input and interruption-safe camera look

**Files:**
- Create: `src/games/school-escape/schoolEscapeInput.ts`
- Create: `src/games/school-escape/schoolEscapeInput.test.ts`
- Modify: `src/games/school-escape/SchoolEscapeGame.tsx`
- Modify: `src/games/school-escape/SchoolEscapeGame.test.tsx`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`

**Interfaces:**
- Consumes shared `attachKeyboardInput`, `KeyboardBinding`, `SemanticInputReader/Writer`, `DirectionalControl`, `ActionButton`.
- Produces `schoolEscapeKeyboardBindings`.
- Produces `LookInputReader` and `createLookAccumulator()`.
- Extends runtime options with `input: SemanticInputReader<SchoolEscapeAction>` and `look: LookInputReader`.

- [ ] **Step 1: Lock keyboard bindings in a failing test**

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

Tests also prove look reset clears pending deltas and focused interactive elements remain protected by the shared keyboard adapter.

- [ ] **Step 2: Define the look contract and run RED**

```ts
export type LookDelta = Readonly<{ x: number; y: number }>
export type LookInputReader = {
  consume(): LookDelta
  reset(): void
}
```

`createLookAccumulator()` additionally exposes `add(dx, dy)` to React wiring. Clamp a single consumed frame to `[-120, 120]` pixels per axis.

```bash
npm test -- src/games/school-escape/schoolEscapeInput.test.ts
```

- [ ] **Step 3: Extend `SchoolEscapeRuntimeOptions` explicitly**

```ts
export type SchoolEscapeRuntimeOptions = {
  canvas: HTMLCanvasElement
  input: SemanticInputReader<SchoolEscapeAction>
  look: LookInputReader
  onFatalError(error: Error): void
}
```

Every frame the runtime reads `input.move`, `isHeld('sprint')`, `consumePress('jump')`, and one `look.consume()` result. No input state is mirrored through per-frame React state.

- [ ] **Step 4: Wire React desktop + mobile controls**

`SchoolEscapeGame` owns one semantic input and one look accumulator per run. Attach keyboard listeners on mount. Add:
- shared `DirectionalControl` source `school-escape-touch-move`;
- held Sprint `ActionButton`;
- press/pulse Jump `ActionButton`;
- right-side camera-drag region using pointer capture;
- pointer up/cancel, blur, visibility loss, and retry reset paths.

The camera drag region ignores events whose target is inside interactive paint/action controls.

- [ ] **Step 5: Add UI/input tests**

Assert Sprint/Jump controls exist as buttons, pointer cancellation resets look/input, simultaneous touch sources can coexist, and focused buttons do not trigger global Space jump handling.

- [ ] **Step 6: Run GREEN and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeInput.test.ts src/games/school-escape/SchoolEscapeGame.test.tsx
git add src/games/school-escape
git commit -m "feat: add School Escape desktop and touch input"
```

---

### Task 4: Create the authored asset set and stage the stylized world/lighting

**Files:**
- Create: `public/games/school-escape/assets/characters/player.glb`
- Create: `public/games/school-escape/assets/characters/teacher.glb`
- Create: `public/games/school-escape/assets/environment/golden-slice.glb`
- Create: `public/games/school-escape/ASSET_PROVENANCE.md`
- Create: `src/games/school-escape/schoolEscapeAssets.ts`
- Create: `src/games/school-escape/schoolEscapeAssets.test.ts`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`

**Interfaces:**
- Produces `SCHOOL_ESCAPE_ASSETS` and `loadSchoolEscapeAssets(scene)`.
- `LoadedSchoolEscapeAssets` exposes player/teacher roots, required animation groups, `PlayerPaint`, `TeacherFace`, environment root.

- [ ] **Step 1: Write the asset-contract test first**

Require:

```ts
player.url === '/games/school-escape/assets/characters/player.glb'
player.animations === ['Idle', 'Walk', 'Run', 'Sprint', 'Jump', 'Fall', 'Land']
player.paintMaterialNames includes 'PlayerPaint'
teacher.animations === ['Idle', 'Walk', 'Suspicious', 'Search', 'Run', 'Recover']
teacher.faceMaterialName === 'TeacherFace'
environment.rootName === 'GoldenSliceEnvironment'
```

Also assert every manifest URL is same-origin `/games/school-escape/...` and every committed product asset has a provenance entry.

- [ ] **Step 2: Run asset tests RED**

```bash
npm test -- src/games/school-escape/schoolEscapeAssets.test.ts
```

- [ ] **Step 3: Author/export the three GLBs to the exact contract**

Use Blender or another glTF-capable authoring tool.

**Player:** stylized adventure-hero child proportions, blonde hair, blue eyes, tan skin, dark jacket/pants, paint-mark detail, separate `PlayerPaint` material, exact animations above.

**Teacher:** believable adult teacher silhouette/clothes, `TeacherFace` material authored deep red, exact animations above, no monster anatomy.

**Environment:** author visible art around this fixed spatial envelope so Task 5 collision data matches:

```text
classroom: x -4..4, z -5..4
main hallway: x -1.6..1.6, z 4..24
locker bay: x 1.6..5.6, z 11.5..18.5
cross-hall visible at z ~= 20, spanning at least x -7..7
```

Include desks/stools/cabinets/art props, lockers, classroom numbers, bulletin/mural landmark, windows, fluorescent fixtures, and a visible EXIT sign down the hall. The environment must guide orientation without a waypoint.

Export baked animations and compact textures. Prefer <=1024px ordinary-surface textures; <=2048px only for a justified hero atlas. Strip unused source meshes/animations.

- [ ] **Step 4: Record provenance before commit**

`ASSET_PROVENANCE.md` table columns:

```text
Path | Origin/author | Source URL or Original C00lG@mes+ work | License | Modifications
```

For any third-party seed, confirm raw-file redistribution in this public repository is permitted.

- [ ] **Step 5: Implement same-origin GLB load/validation**

Import `@babylonjs/loaders/glTF` only in the School Escape lazy module graph. Load through modular Babylon scene-loader APIs. Validate required material/animation/root names and throw an `Error` naming any missing contract element.

- [ ] **Step 6: Stage the world and exact lighting direction in runtime**

After asset load, create the visual composition:
- low-intensity neutral hemispheric/ambient contribution for readability;
- warm directional/sun light entering classroom windows (`~3500-4200K` visual intent);
- cool fluorescent hallway/locker lights (`~5000-6000K` visual intent), kept to a small bounded count;
- one primary character-grounding shadow source; quality policy later scales resolution/filtering;
- occasional authored fluorescent flicker on one fixture only, driven by a deterministic bounded timeline, not per-frame randomness.

Do not add SSAO/bloom/volumetric pipelines as a crutch. Low-quality rendering must still preserve silhouettes, landmarks, locker color, and teacher face readability.

- [ ] **Step 7: Run tests/build and manual art gate**

```bash
npm test -- src/games/school-escape/schoolEscapeAssets.test.ts
npm run build
```

Manual gate:
- no missing textures;
- player/teacher silhouette looks authored at gameplay distance;
- animations have correct names and acceptable foot contact;
- `PlayerPaint` recoloring does not touch skin/hair;
- teacher red face reads in warm and cool zones;
- classroom feels warmer/safer than hallway;
- hallway is creepy/tensive but navigable rather than muddy/dark;
- landmarks/signage are readable without waypoints.

- [ ] **Step 8: Commit**

```bash
git add public/games/school-escape src/games/school-escape/schoolEscapeAssets.ts src/games/school-escape/schoolEscapeAssets.test.ts src/games/school-escape/schoolEscapeRuntime.ts
git commit -m "feat: add School Escape authored 3D world"
```

---

### Task 5: Define deterministic level collision, hide surfaces, LOS, navigation, and triggers

**Files:**
- Create: `src/games/school-escape/schoolEscapeLevel.ts`
- Create: `src/games/school-escape/schoolEscapeLevel.test.ts`

**Interfaces:**
- Produces `GOLDEN_SLICE_LEVEL`.
- Produces `resolvePlayerCollision(position, radius)`, `hasLineOfSight(from, to)`, `nearestHideSurface(position)`.
- Produces fixed teacher patrol/search points and near-miss/completion triggers.

- [ ] **Step 1: Lock the coordinate system**

```ts
playerSpawn = { x: 0, y: 0, z: -2.5 }
classroomBounds = { minX: -4, maxX: 4, minZ: -5, maxZ: 4 }
hallwayBounds = { minX: -1.6, maxX: 1.6, minZ: 4, maxZ: 24 }
lockerBayBounds = { minX: 1.6, maxX: 5.6, minZ: 11.5, maxZ: 18.5 }
teacherStart = { x: -7, y: 0, z: 20 }
nearMissTriggerZ = 8
completionTrigger = { minX: 1.8, maxX: 5.3, minZ: 17.2, maxZ: 18.3 }
```

The cross-hall at `z=20` supports a teacher traversal from `x=-7` to `x=7`.

- [ ] **Step 2: Define hide surfaces**

Primary:

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

Add one secondary authored hide surface near the classroom/hall return corner so a detected player can break LOS and re-hide during validation.

- [ ] **Step 3: Write geometry tests RED**

Cover:
- spawn not inside collision;
- classroom doorway traversable;
- patrol/search nodes reachable through authored openings;
- `nearestHideSurface` returns `locker-blue` only within the `0.8` cover distance;
- collision wall blocks LOS while open corridor does not;
- completion trigger sits beyond the first camouflage lesson.

- [ ] **Step 4: Implement simple deterministic geometry**

Use axis-aligned XZ rectangles and player horizontal radius `0.35`. Reuse the same collision rectangles for LOS. Teacher travel uses a small authored waypoint graph; no navmesh dependency.

- [ ] **Step 5: Run GREEN and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeLevel.test.ts
git add src/games/school-escape/schoolEscapeLevel.ts src/games/school-escape/schoolEscapeLevel.test.ts
git commit -m "feat: add School Escape golden-slice level data"
```

---

### Task 6: Build responsive locomotion, animation blending, and premium third-person camera

**Files:**
- Create: `src/games/school-escape/schoolEscapePlayer.ts`
- Create: `src/games/school-escape/schoolEscapeCamera.ts`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`
- Modify: `src/games/school-escape/schoolEscapeLogic.test.ts`

**Interfaces:**
- `SchoolEscapePlayerController.update(dt, input: SchoolEscapeFrameInput, cameraYaw)` returns a player snapshot with position, velocity, grounded, horizontalSpeed, sprinting.
- `SchoolEscapeCameraController.update(dt, playerSnapshot, sprinting, lookDelta)` owns orbit/follow/occlusion/FOV.

- [ ] **Step 1: Lock movement tuning in tests**

```ts
PLAYER_MOVE_SPEED = 3.2
PLAYER_SPRINT_SPEED = 4.8
PLAYER_ACCEL = 16
PLAYER_DECEL = 20
PLAYER_JUMP_VELOCITY = 5.2
PLAYER_GRAVITY = -14
```

Tests prove no overshoot and player sprint > teacher chase.

- [ ] **Step 2: Bind the rigged player model/animations**

`schoolEscapePlayer.ts` owns an invisible collision proxy/root, parents visible model to it, resolves animation groups once, blends locomotion, and handles jump/fall/land. Authoritative movement is kinematic; animation root motion does not create input latency.

- [ ] **Step 3: Implement camera-relative player motion**

Rotate move vector by camera yaw. Use input magnitude for walk/run blend; keyboard full deflection is run speed unless sprint held. Rotate character toward travel direction with bounded interpolation. Resolve collisions through Task 5 geometry.

- [ ] **Step 4: Implement the camera controller**

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

Ray from player pivot to desired camera position against authored occluders/collision geometry. Push inward on obstruction and recover outward smoothly/quickly. Disable recenter for `1.25s` after manual look; otherwise gently bias behind travel direction.

- [ ] **Step 5: Lock runtime frame order**

```text
1. clamp dt <= 1/15s
2. read semantic move/sprint/jump + one look delta
3. update player kinematics/collision
4. update player animation
5. update camera orbit/follow/occlusion/FOV
6. teacher/perception integration (Task 7)
7. emit low-frequency UI snapshot only when changed/bounded
8. render scene
```

- [ ] **Step 6: Manual empty-room quality gate**

Verify quick response without robotic snapping, no skating, clean turns, useful restrained jump, convincing sprint framing, no wall clipping, fast camera recovery, and no noticeable camera-control lag. Tune before proceeding if this fails.

- [ ] **Step 7: Run tests/lint and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeLogic.test.ts src/games/school-escape/schoolEscapeInput.test.ts
npm run lint
git add src/games/school-escape
git commit -m "feat: add School Escape movement and camera"
```

---

### Task 7: Implement teacher perception, near-miss, chase, search, recovery, and re-hide

**Files:**
- Create: `src/games/school-escape/schoolEscapeTeacher.ts`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`
- Modify: `src/games/school-escape/schoolEscapeLogic.ts`
- Modify: `src/games/school-escape/schoolEscapeLogic.test.ts`
- Modify: `src/games/school-escape/schoolEscapeLevel.ts`

**Interfaces:**
- `SchoolEscapeTeacherController.update(dt, perception)` maps deterministic teacher state to world movement/animation.
- Runtime computes perception from Task 2 + Task 5 geometry.
- Teacher controller emits semantic events `teacherApproaching`, `shout`, `caught`, `alertChanged`.

- [ ] **Step 1: Verify perception tests cover real world inputs**

`computeTeacherVisibility()` consumes distance, sight range, view alignment, LOS, player speed/sprint, and camouflage multiplier. Confirm no-LOS zero, sprint > still, camouflage reduces but does not binary-hide.

- [ ] **Step 2: Implement the partially scripted near-miss**

Before player crosses `z=8`, teacher waits outside the visible segment. Trigger once per run: traverse from `(-7, 0, 20)` to `(7, 0, 20)` at patrol speed. Emit `teacherApproaching` before visual entry so Task 9 can cue audio.

Weak evidence enters `suspicious`; the script never teleports/catches the player. Direct clear exposure can enter chase through ordinary perception.

- [ ] **Step 3: Map teacher states to motion/animation**

```text
patrol -> Walk
suspicious -> Suspicious
search -> Search / Walk
chase -> Run
recover -> Recover, then Walk
```

Use authored waypoints and bounded search points. No navmesh.

- [ ] **Step 4: Implement chase fairness and catch**

Teacher chase speed `4.2`, player sprint `4.8`, catch radius `0.7`. While visible chase current player; after LOS break chase last-known position; after `1.25s` no sight enter search. `shout` only on chase entry.

- [ ] **Step 5: Implement completion condition**

Once the near-miss/chase has resolved and the player enters the locker-bay completion trigger, emit `complete`. This is a golden-slice result, not the final game win.

- [ ] **Step 6: Run automated/manual scenarios**

```bash
npm test -- src/games/school-escape/schoolEscapeLogic.test.ts src/games/school-escape/schoolEscapeLevel.test.ts
```

Manual:
1. strong locker match + still -> teacher passes;
2. mediocre match -> suspicion first;
3. open sprint -> chase + one shout;
4. break LOS -> search;
5. strong re-hide -> recover -> patrol;
6. catch -> temporary caught/retry.

- [ ] **Step 7: Commit**

```bash
git add src/games/school-escape
git commit -m "feat: add School Escape teacher encounter"
```

---

### Task 8: Build contextual radial paint UI and minimal world-first HUD

**Files:**
- Modify: `src/games/school-escape/SchoolEscapeGame.tsx`
- Modify: `src/games/school-escape/SchoolEscapeGame.test.tsx`
- Modify: `src/games/school-escape/schoolEscape.css`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`
- Modify: `src/games/school-escape/schoolEscapePlayer.ts`

**Interfaces:**
- React owns `PaintMix` and calls runtime `setPaintMix(mix)`.
- Runtime emits `SchoolEscapeUiSnapshot` at meaningful changes / <=10Hz.
- No numeric RGB/match values or teacher-state labels are rendered.

- [ ] **Step 1: Extend runtime/UI contracts explicitly**

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
```

Runtime options gain `onUiSnapshot(snapshot)`. Runtime controller gains `setPaintMix(mix: PaintMix)`.

- [ ] **Step 2: Write failing UI tests**

Assert palette only near cover; Red/Yellow/Blue/White/Black/Clean controls exist; no numeric RGB/percentages or `POOR|CLOSE|BLENDED|PATROL|SEARCH|CHASE`; alert glyph only when relevant; subtitle `Come back here!`; caught and completion overlays expose correct actions; no minimap/waypoint is introduced.

- [ ] **Step 3: Implement radial five-pigment interaction**

Five 44px+ controls surround current swatch. Pointer/key hold adds pigment at `0.35 units/second`, clamp `0..1`. `Clean paint` resets `EMPTY_PAINT_MIX`. Native focused-button keyboard handling must work without global Space jump interception.

- [ ] **Step 4: Implement match ring without numeric exposure**

Set CSS custom property `--match-progress` from internal score and render a conic-gradient ring. Accessibility text may use broad nonnumeric states (`Paint match improving`, `Paint match strong`) but never percentage/RGB values.

- [ ] **Step 5: Apply paint only to `PlayerPaint`**

Resolve material once. Update base/albedo from `displayedClothingColor(mix)`. Do not modify hair/skin/eye materials.

- [ ] **Step 6: Keep mobile controls clear during palette use**

Reposition/simplify Sprint/Jump while palette visible; movement remains usable; look region ignores pointer events originating in paint/action controls.

- [ ] **Step 7: Run tests/lint and commit**

```bash
npm test -- src/games/school-escape/SchoolEscapeGame.test.tsx src/games/school-escape/schoolEscapeLogic.test.ts
npm run lint
git add src/games/school-escape
git commit -m "feat: add School Escape camouflage HUD"
```

---

### Task 9: Add final-quality continuous music, positional ambience, footsteps, and voice

**Files:**
- Create: audio files listed in File Structure.
- Modify: `public/games/school-escape/ASSET_PROVENANCE.md`
- Create: `src/games/school-escape/schoolEscapeAudio.ts`
- Create: `src/games/school-escape/schoolEscapeAudio.test.ts`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`

**Interfaces:**
- Produces `SchoolEscapeAudioController` with `unlock()`, `setDangerLevel()`, `playWorldCue()`, `playTeacherShout()`, `pause()`, `resume()`, `dispose()`.
- Audio reacts to gameplay events; it never decides gameplay state.

- [ ] **Step 1: Produce/acquire the exact committed audio set with commercial-safe redistribution/use rights**

Required files are the paths listed in File Structure. The three music loops must share one musical identity so danger feels like layering/escalation, not unrelated songs. Voice line is exactly `Come back here!`; subtitle remains authoritative. Record provenance before commit.

- [ ] **Step 2: Write audio-policy tests RED**

Pure mapping:

```text
alert none -> exploration
alert suspicious -> tension
alert alert/chase -> chase
```

Test pause/dispose stops loops and teacher shout de-duplicates per chase episode.

- [ ] **Step 3: Implement authored audio orchestration**

Crossfade music over about `0.6s`, duck music for teacher voice, bound simultaneous SFX, and create/resume Web Audio only after user gesture permits it. Autoplay restriction never blocks gameplay.

Use positional panning for teacher/player world cues where supported; fall back to non-positional playback without changing rules.

- [ ] **Step 4: Integrate footsteps/encounter cues**

Drive footsteps from animation normalized-time markers or a bounded cadence tied to actual locomotion speed. `teacherApproaching` starts audible presence before visual contact. Never emit step/audio every render tick.

- [ ] **Step 5: Manual audio gate**

Verify exploration music does not mask footsteps; suspicion ramps; chase intensifies smoothly; teacher location is understandable on headphones where supported; shout is intelligible/one-shot; tab hide/retry/unmount leaves no orphan loops.

- [ ] **Step 6: Run tests/build and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeAudio.test.ts
npm run build
git add public/games/school-escape src/games/school-escape/schoolEscapeAudio.ts src/games/school-escape/schoolEscapeAudio.test.ts src/games/school-escape/schoolEscapeRuntime.ts
git commit -m "feat: add School Escape adventure audio"
```

---

### Task 10: Add adaptive quality and lifecycle/error/retry hardening

**Files:**
- Create: `src/games/school-escape/schoolEscapeQuality.ts`
- Create: `src/games/school-escape/schoolEscapeQuality.test.ts`
- Modify: `src/games/school-escape/schoolEscapeRuntime.ts`
- Modify: `src/games/school-escape/SchoolEscapeGame.tsx`
- Modify: `src/games/school-escape/SchoolEscapeGame.test.tsx`
- Modify: `src/games/school-escape/schoolEscape.css`

**Interfaces:**
- Produces `QualityTier = 'high' | 'medium' | 'low'`, `QUALITY_SETTINGS`, `chooseInitialQuality()`, `updateQualityPolicy()`.
- Runtime applies quality settings; gameplay geometry/perception is invariant across tiers.

- [ ] **Step 1: Lock quality settings in failing tests**

```ts
export const QUALITY_SETTINGS = {
  high: { dprCap: 1.75, shadowMapSize: 1024, softShadows: true, effectDensity: 1 },
  medium: { dprCap: 1.35, shadowMapSize: 512, softShadows: false, effectDensity: 0.6 },
  low: { dprCap: 1, shadowMapSize: 256, softShadows: false, effectDensity: 0.25 },
} as const
```

Initial tier:
- low when `deviceMemory <= 4` (if exposed) or `hardwareConcurrency <= 4`;
- medium when `deviceMemory <= 8`, `hardwareConcurrency <= 8`, or DPR > 2.5;
- high otherwise;
- missing capability APIs => medium.

- [ ] **Step 2: Test downgrade hysteresis RED**

After 3s warm-up:
- high -> medium only after EMA frame time >22ms continuously for 4s;
- medium -> low only after EMA >30ms continuously for 4s;
- no upgrade during the same play session.

Short spikes must not downgrade.

- [ ] **Step 3: Apply tiers without gameplay changes**

Scale DPR/hardware scaling, shadow size/filter/fallback, and decorative effect density. Low may use a cheap contact/blob fallback. Never change collision, hide-surface canonical colors, perception thresholds, teacher/player speeds, UI semantics, or audio cues required for gameplay.

- [ ] **Step 4: Harden lifecycle/timing**

- clamp simulation `dt <= 1/15s`;
- hidden document pauses nonessential simulation/render/audio and resets held input/look;
- resume resets timestamp before next step;
- resize/fullscreen/orientation updates engine/camera/HUD;
- route unmount disposes scene, engine, observers, timers, media nodes, pointer listeners;
- restart reconstructs/reset all mutable player/teacher/camera/paint/audio/quality session state; no stale suspicion/velocity/timers.

- [ ] **Step 5: Complete loading/error/retry tests**

Mock runtime load rejection: clear recoverable error + Retry + Return to Games; no blank canvas. Mock caught: Retry returns to clean playing state. Mock complete: `Golden slice complete`, not final-game win copy.

- [ ] **Step 6: Run tests/lint and commit**

```bash
npm test -- src/games/school-escape/schoolEscapeQuality.test.ts src/games/school-escape/SchoolEscapeGame.test.tsx
npm run lint
git add src/games/school-escape
git commit -m "feat: harden School Escape quality and lifecycle"
```

---

### Task 11: Integrate, inspect bundle/performance, open the focused PR, and run the player quality gate

**Files:**
- Modify only #26 files as required by integration findings.
- Update `ASSET_PROVENANCE.md` for any polish asset changes.
- PR metadata: one focused PR closing #26.

**Interfaces:**
- Consumes Tasks 1-10.
- Produces one playable branch/Vercel preview and evidence for #26 acceptance.

- [ ] **Step 1: Run focused tests**

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

- [ ] **Step 2: Run repository gate**

```bash
npm test
npm run lint
npm run build
```

All must pass.

- [ ] **Step 3: Inspect production lazy/bundle impact**

Record from Vite output/devtools:
- initial app JS gzip size;
- School Escape page/runtime chunk(s) gzip size;
- Babylon chunk(s) gzip size;
- total School Escape GLB/texture/audio bytes.

Verify `/`, `/games`, and another game route do not request School Escape GLBs/audio or execute Babylon runtime code.

- [ ] **Step 4: Desktop gameplay validation**

Chromium, then Firefox where practical:
1. fresh preview load -> branded loading -> playable scene;
2. movement/run/sprint/jump/turn feel;
3. camera around every wall/corner; no persistent clipping;
4. teacher heard before seen;
5. strong match + still -> passes;
6. mediocre match -> suspicion first;
7. open sprint -> one shout/chase;
8. break LOS + re-hide -> search/recover;
9. catch -> Retry -> fully clean state;
10. complete slice -> correct completion copy;
11. tab hide/restore, blur/focus, fullscreen enter/exit, resize; no stuck input/audio/simulation jump.

- [ ] **Step 5: Mobile gameplay validation**

At minimum iPhone Safari landscape; Android Chrome landscape where practical:
- movement + look simultaneously;
- movement + sprint and movement + jump;
- paint controls reachable and do not block teacher/hide surface;
- look region ignores UI touches;
- safe areas/orientation/resize;
- background/foreground interruption;
- retry;
- sustained session long enough to observe thermal/frame degradation.

- [ ] **Step 6: Lower-powered/adaptive-quality validation**

Observe classroom, teacher crossing, chase, and paint interaction. Force each quality tier once through a temporary local debug harness, verify low remains readable/gameplay-identical, then remove that harness before commit.

Target stable 60 FPS on capable hardware and stable degraded play preferably 30+ FPS on representative lower-powered hardware. Reduce expensive visual work before acceptance if sustained frame time collapses.

- [ ] **Step 7: Final player-experience gate**

User/player explicitly approves:
- premium movement/camera;
- authored school rather than prototype geometry;
- coherent player/teacher models/animation;
- warm-classroom/cool-hall lighting without muddy navigation;
- paint mixing understandable without numbers/tutorial modal;
- fair near-miss/suspicion/chase/search/re-hide;
- continuous adventure music/audio supports tension without annoyance;
- mobile feels first-class;
- adaptive/lower-end behavior acceptable.

If not clearly yes, keep the PR draft and iterate only inside #26 scope. Do not expand the full school.

- [ ] **Step 8: Re-run exact final gate after last polish change**

```bash
npm test
npm run lint
npm run build
```

Record exact results in PR body.

- [ ] **Step 9: Commit final integration polish if working tree is not already clean**

```bash
git add src public package.json package-lock.json
git commit -m "feat: complete School Escape golden slice"
```

- [ ] **Step 10: Open one focused draft PR**

Title:

```text
feat: build School Escape premium golden slice
```

Body includes `Closes #26`, Babylon/local architecture, asset provenance/licensing, automated evidence, bundle/asset-size evidence, desktop/mobile/lower-end validation/gaps, real gameplay screenshots/video when available, and explicit note that PR #17 was superseded and not used as base.

Keep draft until hands-on quality gate passes. Do not merge without explicit user authorization.

---

## Plan Self-Review Checklist

Before execution begins, confirm:

- Every #26 acceptance criterion maps to at least one task above.
- `SchoolEscapePage -> GameViewport -> SchoolEscapeGame` matches the approved component ownership.
- Runtime input/look interfaces are explicitly defined before movement implementation.
- Temporary route is lazy and absent from `gameCatalog`/discovery/recent-game tracking.
- Babylon versions are exact and game-local.
- Paint algorithm family/constants/scoring space are locked.
- Teacher state model includes suspicion fairness and re-hide recovery.
- Player sprint remains faster than teacher chase.
- Camera/movement have an independent quality gate before teacher polish.
- World/art task includes warm/cool lighting and environmental navigation cues, not just asset loading.
- Art/audio have exact filenames/contracts/provenance requirements.
- Final-quality audio/voice is required before acceptance.
- Quality tiers cannot alter gameplay semantics.
- Lifecycle cleanup includes visibility, focus, pointer cancellation, retry, resize, fullscreen/orientation, and route unmount.
- Real desktop/mobile/lower-end validation is mandatory.
- No full-school/outdoor/principal scope leaked into #26.
- No shared 3D abstraction, physics engine, WebGPU requirement, feature-flag platform, analytics, or unrelated cleanup was introduced.
