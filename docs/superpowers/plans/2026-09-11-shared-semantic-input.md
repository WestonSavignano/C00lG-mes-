# Shared Semantic Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Issue #14 with a reusable semantic keyboard/Pointer Events input foundation, then prove it in Donut Run and Neon Drift without frame-rate React state or desktop-control regressions.

**Architecture:** Each game owns one stable mutable semantic-input instance with separate read/write interfaces. Shared keyboard, lifecycle-reset, virtual-stick, and action-button adapters feed semantic intent; game-specific mappings and control compositions translate that intent into existing mechanics through `GameViewport.inputOverlay`.

**Tech Stack:** TypeScript 6, React 19, Pointer Events, Vitest, Testing Library, Phaser 4 for Donut Run, Canvas 2D for Neon Drift.

**Spec:** `docs/superpowers/specs/2026-09-11-shared-semantic-input-design.md`

## Global Constraints

- Owning Issue: GitHub #14 — `Add shared semantic input foundation`.
- Shared input infrastructure lives under `src/games/shared/input/`.
- Use Pointer Events for common pointer/touch handling.
- Keep frame-by-frame game/input state out of React.
- Keep one stable movement vector object and avoid per-frame shared-input allocation.
- Directional input clamps to magnitude `1` and uses an approximately `0.12` normalized radial dead zone.
- Shared touch targets must remain at least `44px`; primary action controls should normally be approximately `56–64px`.
- Preserve Donut Run `Tap, click, or press SPACE` behavior; game-surface pointer presses, keyboard, and visible Jump control all feed semantic `jump`.
- Neon Drift processes `start`, `pause`, and `deploy` intents before the simulation early return; `P` must both pause and resume, and invalid Deploy presses must be consumed instead of firing later.
- Shared `ActionButton` must preserve focused Enter/Space keyboard activation and must not double-fire from Pointer Events plus the resulting native click.
- Reset input on blur, hidden visibility, page hide, fullscreen transition, orientation transition, and unmount. Do not reset merely because of ordinary resize.
- Keep `GameViewport.inputOverlay`; do not create a competing control mount.
- Do not touch Fart Attack, Bodi Island, networking, Chat, server behavior, monetization, analytics, accounts, unrelated roadmap status, or speculative gamepad infrastructure.
- Final repository gate: `npm test`, `npm run lint`, `npm run build`.
- Do not merge the resulting PR.

---

## File Structure

### Shared input foundation

- `src/games/shared/input/semanticInput.ts` — mutable source-aware semantic state and contracts.
- `src/games/shared/input/semanticInput.test.ts` — movement/held/press/reset tests.
- `src/games/shared/input/keyboardInput.ts` — keyboard-to-semantic bindings.
- `src/games/shared/input/keyboardInput.test.ts` — keyboard lifecycle tests.
- `src/games/shared/input/inputLifecycle.ts` — interruption reset listeners.
- `src/games/shared/input/inputLifecycle.test.ts` — interruption/unmount tests.
- `src/games/shared/input/useSemanticInput.ts` — stable per-game input instance and listener attachment.
- `src/games/shared/input/DirectionalControl.tsx` — fixed single-pointer virtual stick.
- `src/games/shared/input/DirectionalControl.test.tsx` — dead-zone/capture/cancel tests.
- `src/games/shared/input/ActionButton.tsx` — semantic press/hold native button.
- `src/games/shared/input/ActionButton.test.tsx` — pointer/keyboard/double-fire tests.
- `src/games/shared/input/inputControls.css` — shared control focus/pressed presentation.

### Donut Run

- `src/games/donut-run/donutRunInput.ts`
- `src/games/donut-run/donutRunInput.test.ts`
- `src/games/donut-run/DonutRunControls.tsx`
- `src/games/donut-run/donutRun.css`
- modify `src/games/donut-run/DonutRun.tsx`

### Neon Drift

- `src/games/neon-drift/neonDriftInput.ts`
- `src/games/neon-drift/neonDriftInput.test.ts`
- `src/games/neon-drift/NeonDriftControls.tsx`
- `src/games/neon-drift/NeonDriftControls.test.tsx`
- modify `src/games/neon-drift/NeonDriftGame.tsx`
- modify `src/games/neon-drift/neonDrift.css`

### Catalog

- modify `src/games/catalog/gameCatalog.ts`
- modify `src/games/catalog/gameCatalog.test.ts`

---

### Task 1: Build the source-aware semantic input store

**Files:**
- Create: `src/games/shared/input/semanticInput.ts`
- Create: `src/games/shared/input/semanticInput.test.ts`

**Interfaces:**

```ts
export type MovementVector = Readonly<{ x: number; y: number }>

export type MovementInputWriter = {
  setMoveSource(sourceId: string, x: number, y: number): void
  clearMoveSource(sourceId: string): void
}

export type SemanticInputReader<Action extends string> = {
  readonly move: MovementVector
  isHeld(action: Action): boolean
  consumePress(action: Action): boolean
}

export type SemanticInputWriter<Action extends string> = MovementInputWriter & {
  setActionSource(sourceId: string, action: Action, held: boolean): void
  pulseAction(action: Action): void
  clearSource(sourceId: string): void
  reset(): void
}

export type SemanticInput<Action extends string> = {
  reader: SemanticInputReader<Action>
  writer: SemanticInputWriter<Action>
}

export function createSemanticInput<Action extends string>(): SemanticInput<Action>
```

- [ ] **Step 1: Write failing semantic-store tests**

Cover stable movement-object identity, zero initial state, source aggregation, opposite-direction cancellation, radial clamping, held action ownership by multiple sources, source-specific release, buffered press consumption, `clearSource`, and `reset`.

Core assertions:

```ts
const input = createSemanticInput<'boost' | 'deploy'>()
const move = input.reader.move
input.writer.setMoveSource('right', 1, 0)
input.writer.setMoveSource('down', 0, 1)
expect(input.reader.move).toBe(move)
expect(move.x).toBeCloseTo(Math.SQRT1_2)
expect(move.y).toBeCloseTo(Math.SQRT1_2)
```

```ts
input.writer.setActionSource('keyboard:Space', 'boost', true)
input.writer.setActionSource('button:boost', 'boost', true)
input.writer.setActionSource('keyboard:Space', 'boost', false)
expect(input.reader.isHeld('boost')).toBe(true)
input.writer.clearSource('button:boost')
expect(input.reader.isHeld('boost')).toBe(false)
```

```ts
input.writer.pulseAction('deploy')
input.writer.pulseAction('deploy')
expect(input.reader.consumePress('deploy')).toBe(true)
expect(input.reader.consumePress('deploy')).toBe(true)
expect(input.reader.consumePress('deploy')).toBe(false)
```

- [ ] **Step 2: Run red**

```bash
npm test -- src/games/shared/input/semanticInput.test.ts
```

Expected: FAIL because `semanticInput.ts` does not exist.

- [ ] **Step 3: Implement the minimal store**

Use a `Map<string, {x:number;y:number}>` for movement sources, source-aware held-action sets, and a pending press-count map. Recompute the same mutable movement object only when a source changes; clamp the aggregate radially to magnitude `1`. `clearSource` removes movement plus held-action ownership for that source. `reset` clears every source/count and mutates movement to `{x:0,y:0}`.

- [ ] **Step 4: Run green**

```bash
npm test -- src/games/shared/input/semanticInput.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/games/shared/input/semanticInput.ts src/games/shared/input/semanticInput.test.ts
git commit -m "feat: add semantic input state"
```

---

### Task 2: Add keyboard and interruption lifecycle adapters

**Files:**
- Create: `src/games/shared/input/keyboardInput.ts`
- Create: `src/games/shared/input/keyboardInput.test.ts`
- Create: `src/games/shared/input/inputLifecycle.ts`
- Create: `src/games/shared/input/inputLifecycle.test.ts`
- Create: `src/games/shared/input/useSemanticInput.ts`

**Interfaces:**

```ts
export type KeyboardBinding<Action extends string> = {
  code: string
  move?: Readonly<{ x: number; y: number }>
  hold?: Action
  press?: Action
  preventDefault?: boolean
}

export function attachKeyboardInput<Action extends string>(
  target: Window,
  writer: SemanticInputWriter<Action>,
  bindings: readonly KeyboardBinding<Action>[],
): () => void

export function attachInputResetLifecycle<Action extends string>(
  windowTarget: Window,
  documentTarget: Document,
  writer: SemanticInputWriter<Action>,
): () => void

export function useSemanticInput<Action extends string>(
  bindings: readonly KeyboardBinding<Action>[],
): SemanticInput<Action>
```

- [ ] **Step 1: Write failing keyboard tests**

Cover directional keydown/up, held action keydown/up, discrete non-repeat press, one key with both `hold` and `press`, mapped-key `preventDefault`, and interactive-target handling.

Required stuck-input regression:

```ts
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
expect(input.reader.isHeld('boost')).toBe(true)
button.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }))
expect(input.reader.isHeld('boost')).toBe(false)
```

Global gameplay mappings ignore interactive-target **keydown** events, but mapped **keyup** always clears the physical key source so focus changes cannot strand held state.

- [ ] **Step 2: Implement keyboard adapter**

Use source ID `keyboard:${event.code}`. Initial keydown applies move/hold and pulses press actions only when `event.repeat === false`. Cleanup removes listeners and clears all mapped key sources. Interactive selector: `button, a, input, select, textarea, [contenteditable="true"]`.

- [ ] **Step 3: Write failing lifecycle tests**

Assert reset on `window.blur`, hidden `visibilitychange`, `pagehide`, `fullscreenchange`, `orientationchange`, and cleanup/unmount. Assert ordinary `resize` does not reset.

- [ ] **Step 4: Implement lifecycle helper and hook**

`attachInputResetLifecycle` registers the bounded listener set once and resets during cleanup. `useSemanticInput` lazily creates one input instance in a ref and attaches keyboard/lifecycle listeners in an effect. It never mirrors movement or held actions into React state.

- [ ] **Step 5: Run focused tests**

```bash
npm test -- src/games/shared/input/semanticInput.test.ts src/games/shared/input/keyboardInput.test.ts src/games/shared/input/inputLifecycle.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/games/shared/input
git commit -m "feat: add semantic input device adapters"
```

---

### Task 3: Build reusable Pointer Events controls

**Files:**
- Create: `src/games/shared/input/DirectionalControl.tsx`
- Create: `src/games/shared/input/DirectionalControl.test.tsx`
- Create: `src/games/shared/input/ActionButton.tsx`
- Create: `src/games/shared/input/ActionButton.test.tsx`
- Create: `src/games/shared/input/inputControls.css`

**Interfaces:**

```ts
export type DirectionalControlProps = {
  writer: MovementInputWriter
  sourceId: string
  label: string
  deadZone?: number
  className?: string
}

export type ActionButtonProps<Action extends string> = {
  writer: Pick<
    SemanticInputWriter<Action>,
    'setActionSource' | 'pulseAction' | 'clearSource'
  >
  sourceId: string
  action: Action
  mode: 'press' | 'hold'
  className?: string
  children: ReactNode
}
```

- [ ] **Step 1: Write failing `DirectionalControl` tests**

Mock pointer capture/release and use a deterministic `120x120` bounding box. Cover first-pointer ownership, `0.12` dead zone, smooth dead-zone rescaling, radial clamping, ignored secondary pointer, pointerup, pointercancel, lost capture, unmount, and deterministic zero.

- [ ] **Step 2: Implement `DirectionalControl`**

Use refs for pointer ownership/root/thumb. Measure current bounds on owned pointer events, compute center/radius, dead-zone-rescale and clamp the vector, write it through one source, and update thumb CSS variables/pressed attributes imperatively. No pointer-coordinate React state.

- [ ] **Step 3: Write failing `ActionButton` tests**

Stub a deterministic button bounding box. Cover press and hold pointer ownership, leave/re-entry in hold mode, pointer cancel/lost-capture/unmount cleanup, Enter/Space keyboard behavior, and this exact invariant:

```ts
fireEvent.pointerDown(button, { pointerId: 7, clientX: 20, clientY: 20 })
fireEvent.pointerUp(button, { pointerId: 7, clientX: 20, clientY: 20 })
fireEvent.click(button, { detail: 1 })
expect(pulseAction).toHaveBeenCalledTimes(1)
```

Then verify native keyboard/synthetic activation with `click.detail === 0` emits exactly one press.

- [ ] **Step 4: Implement `ActionButton`**

For `press`, valid pointer completion inside emits one semantic press and marks the following pointer-generated native click consumed; `onClick` emits only for keyboard/assistive activation or a click not already handled by the pointer path. For `hold`, pointerdown sets held state, pointermove toggles based on current inside/outside bounds, and pointerup/cancel/lost-capture/unmount clears it. Local Enter/Space keydown/up uses a `${sourceId}:keyboard` source because the global adapter ignores focused buttons.

- [ ] **Step 5: Add shared control CSS**

Use `pointer-events:auto` and `touch-action:none` only on real controls; visible `:focus-visible` and `[data-pressed="true"]`; action targets >= `44px` with primary size around `60px`; fixed circular stick; no continuous expensive effects.

- [ ] **Step 6: Run focused tests and commit**

```bash
npm test -- src/games/shared/input/DirectionalControl.test.tsx src/games/shared/input/ActionButton.test.tsx
git add src/games/shared/input
git commit -m "feat: add shared touch input controls"
```

---

### Task 4: Migrate Donut Run without changing behavior

**Files:**
- Create: `src/games/donut-run/donutRunInput.ts`
- Create: `src/games/donut-run/donutRunInput.test.ts`
- Create: `src/games/donut-run/DonutRunControls.tsx`
- Create: `src/games/donut-run/donutRun.css`
- Modify: `src/games/donut-run/DonutRun.tsx`
- Modify: `src/games/catalog/gameCatalog.ts`
- Modify: `src/games/catalog/gameCatalog.test.ts`

**Interfaces:**

```ts
export type DonutRunAction = 'jump'

export const donutRunKeyboardBindings: readonly KeyboardBinding<DonutRunAction>[] = [
  { code: 'Space', press: 'jump', preventDefault: true },
  { code: 'ArrowUp', press: 'jump', preventDefault: true },
]
```

- [ ] **Step 1: Write failing mapping/catalog tests**

Assert the exact bindings and, after migration, Donut catalog inputs `['touch', 'keyboard']`.

- [ ] **Step 2: Add game-specific Jump composition**

`DonutRunControls` renders one shared press-mode Jump button with source `button:donut-run:jump` inside a safe-area-aware wrapper.

- [ ] **Step 3: Migrate `DonutRun.tsx`**

Create one `useSemanticInput(donutRunKeyboardBindings)` instance. Move the Phaser parent ref to a full-size `.donut-run__surface` inside `GameViewport`; that Donut-specific surface `onPointerDown` pulses `jump`. Pass `DonutRunControls` through `inputOverlay`. Remove Phaser raw pointer/keyboard registrations. At the beginning of scene update, consume `jump` and call the existing `handleAction()` path.

Keep the existing `Tap, click, or press SPACE` copy and menu/running/dead mechanics unchanged. The surface, Jump overlay, and fullscreen button remain siblings so Jump/fullscreen pointer events cannot bubble into the surface and double-fire.

- [ ] **Step 4: Add Donut styles and catalog metadata**

`.donut-run__surface` fills the viewport and locally uses `touch-action:none`. Touch Jump sits near the lower-right safe area and is hidden on pointer-fine desktop layouts. Change only Donut's catalog inputs to `['touch', 'keyboard']`.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- src/games/donut-run/donutRunInput.test.ts src/games/catalog/gameCatalog.test.ts
git add src/games/donut-run src/games/catalog/gameCatalog.ts src/games/catalog/gameCatalog.test.ts
git commit -m "feat: migrate Donut Run to semantic input"
```

---

### Task 5: Define Neon Drift semantic mappings and lifecycle ordering

**Files:**
- Create: `src/games/neon-drift/neonDriftInput.ts`
- Create: `src/games/neon-drift/neonDriftInput.test.ts`

**Interfaces:**

```ts
export type NeonDriftAction = 'boost' | 'deploy' | 'start' | 'pause'

export const neonDriftKeyboardBindings: readonly KeyboardBinding<NeonDriftAction>[]

export type NeonDriftControlRuntime = {
  isRunning(): boolean
  isPaused(): boolean
  isGameOver(): boolean
  start(): void
  togglePause(): void
  deploy(): void
}

export function processNeonDriftControlIntents(
  reader: SemanticInputReader<NeonDriftAction>,
  runtime: NeonDriftControlRuntime,
): void
```

Bindings:

```ts
[
  { code: 'KeyW', move: { x: 0, y: -1 } },
  { code: 'ArrowUp', move: { x: 0, y: -1 }, preventDefault: true },
  { code: 'KeyA', move: { x: -1, y: 0 } },
  { code: 'ArrowLeft', move: { x: -1, y: 0 }, preventDefault: true },
  { code: 'KeyS', move: { x: 0, y: 1 } },
  { code: 'ArrowDown', move: { x: 0, y: 1 }, preventDefault: true },
  { code: 'KeyD', move: { x: 1, y: 0 } },
  { code: 'ArrowRight', move: { x: 1, y: 0 }, preventDefault: true },
  { code: 'Space', hold: 'boost', press: 'start', preventDefault: true },
  { code: 'Enter', press: 'start' },
  { code: 'KeyR', press: 'deploy' },
  { code: 'KeyP', press: 'pause' },
]
```

- [ ] **Step 1: Write failing mapping/order tests**

Required state cases:

1. `start` works while not running/game-over;
2. `pause` toggles running `false -> true` and `true -> false` paused state;
3. deploy while paused is consumed and never fires after a later resume;
4. when `pause` and `deploy` are queued while paused, pause is processed first, runtime state is re-read, and deploy may execute after same-frame resume;
5. start is processed before later control/simulation gating.

- [ ] **Step 2: Implement exact control processing order**

```ts
const startPressed = reader.consumePress('start')
if (startPressed && (!runtime.isRunning() || runtime.isGameOver())) runtime.start()

const pausePressed = reader.consumePress('pause')
if (pausePressed && runtime.isRunning() && !runtime.isGameOver()) runtime.togglePause()

const deployPressed = reader.consumePress('deploy')
if (
  deployPressed &&
  runtime.isRunning() &&
  !runtime.isPaused() &&
  !runtime.isGameOver()
) runtime.deploy()
```

`deploy` is consumed even when invalid.

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/games/neon-drift/neonDriftInput.test.ts
git add src/games/neon-drift/neonDriftInput.ts src/games/neon-drift/neonDriftInput.test.ts
git commit -m "feat: define Neon Drift semantic inputs"
```

---

### Task 6: Migrate Neon Drift runtime and add multi-touch controls

**Files:**
- Create: `src/games/neon-drift/NeonDriftControls.tsx`
- Create: `src/games/neon-drift/NeonDriftControls.test.tsx`
- Modify: `src/games/neon-drift/NeonDriftGame.tsx`
- Modify: `src/games/neon-drift/neonDrift.css`
- Modify: `src/games/catalog/gameCatalog.ts`
- Modify: `src/games/catalog/gameCatalog.test.ts`

- [ ] **Step 1: Write failing composed multi-touch tests**

With distinct pointers, prove stick movement + held Boost and stick movement + Deploy press coexist. Releasing/canceling one pointer must leave the other intent intact.

- [ ] **Step 2: Implement `NeonDriftControls`**

Compose lower-left `DirectionalControl`, lower-right hold-mode Boost `ActionButton`, and adjacent/above press-mode Deploy `ActionButton`, each with a unique source ID.

- [ ] **Step 3: Replace raw key mechanics in `NeonDriftGame.tsx`**

Create one `useSemanticInput(neonDriftKeyboardBindings)` instance; delete raw `Set<string>` and keydown/keyup listeners. Read `reader.move` and `reader.isHeld('boost')`. Create a `NeonDriftControlRuntime` facade over current mutable runtime state and call `processNeonDriftControlIntents(reader, runtime)` before any `!running || paused || gameOver` simulation return.

Keep the current game-specific blur-to-pause behavior; shared lifecycle reset owns semantic-input clearing. Route the intro/game-over button into `writer.pulseAction('start')` instead of calling `start()` directly. Remove the obsolete `startRef` bridge after the semantic path is in place.

- [ ] **Step 4: Mount touch controls via `GameViewport.inputOverlay`**

```tsx
<GameViewport
  game="neon-drift"
  inputOverlay={overlayVisible ? null : <NeonDriftControls writer={input.writer} />}
  label="Neon Drift game"
  ref={viewportRef}
>
  {/* existing runtime */}
</GameViewport>
```

Unmounting the overlay on game-over clears touch sources through primitive cleanup.

- [ ] **Step 5: Add touch layout and catalog metadata**

Use coarse-pointer/compact-layout CSS, safe-area insets, and bounded HUD spacing so thumb controls do not obscure the Start/game-over panel or Boost meter. Change only Neon Drift's catalog inputs to `['touch', 'keyboard']`. Catalog tests assert both migrated games advertise touch + keyboard.

- [ ] **Step 6: Run all focused tests and commit**

```bash
npm test -- \
  src/games/shared/input/semanticInput.test.ts \
  src/games/shared/input/keyboardInput.test.ts \
  src/games/shared/input/inputLifecycle.test.ts \
  src/games/shared/input/DirectionalControl.test.tsx \
  src/games/shared/input/ActionButton.test.tsx \
  src/games/donut-run/donutRunInput.test.ts \
  src/games/neon-drift/neonDriftInput.test.ts \
  src/games/neon-drift/NeonDriftControls.test.tsx \
  src/games/catalog/gameCatalog.test.ts

git add src/games/neon-drift src/games/catalog/gameCatalog.ts src/games/catalog/gameCatalog.test.ts
git commit -m "feat: migrate Neon Drift to semantic input"
```

Expected: PASS.

---

### Task 7: Validate, audit, and open the focused PR

**Files:**
- Modify implementation/tests only if validation exposes an Issue #14 defect.
- Use `.github/pull_request_template.md` for the PR body.

- [ ] **Step 1: Run the complete repository gate**

```bash
npm test
npm run lint
npm run build
```

Expected: all exit `0`. Fix only branch-caused failures with focused red/green cycles; do not absorb unrelated warnings or roadmap cleanup.

- [ ] **Step 2: Audit final diff against `main`**

Allowed scope: approved spec/plan, `src/games/shared/input/`, Donut Run input integration/tests/styles, Neon Drift input integration/tests/styles, and catalog input metadata/tests.

- [ ] **Step 3: Perform all available hands-on validation**

Desktop/browser: Donut Space/ArrowUp/click-anywhere/start/death/restart; Neon WASD/arrows/Boost/Deploy/P pause-resume/Enter-Space start-restart; fullscreen, focus loss/regain, resize, interruption recovery, latency, and frame stability.

Touch/device where available: Donut tap-anywhere + Jump; Neon stick, move+Boost, move+Deploy; portrait/landscape, safe areas, fullscreen, interruption, accidental page gestures, lower-powered performance. State exact hardware/browser gaps rather than manufacturing evidence.

- [ ] **Step 4: Push final branch and verify GitHub Actions**

Confirm the branch validation workflow passes the same test/lint/build gate. Inspect logs and fix only branch-caused failures.

- [ ] **Step 5: Open PR to `main`**

Title:

```text
feat: add shared semantic input foundation
```

Use the repository PR template, include `Closes #14`, separate automated evidence from manual evidence/gaps, document performance impact and reset/ownership/double-fire review focus, and leave the PR unmerged with auto-merge disabled.
