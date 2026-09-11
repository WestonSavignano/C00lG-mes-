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

- `src/games/shared/input/semanticInput.ts` — mutable source-aware semantic state and read/write contracts.
- `src/games/shared/input/semanticInput.test.ts` — deterministic movement/held/press/reset coverage.
- `src/games/shared/input/keyboardInput.ts` — keyboard-to-semantic bindings and listener lifecycle.
- `src/games/shared/input/keyboardInput.test.ts` — key mapping, repeat, interactive-target, and cleanup coverage.
- `src/games/shared/input/inputLifecycle.ts` — interruption/reset listeners.
- `src/games/shared/input/inputLifecycle.test.ts` — blur/visibility/pagehide/fullscreen/orientation/unmount reset coverage.
- `src/games/shared/input/useSemanticInput.ts` — stable per-game input instance plus keyboard/lifecycle attachment.
- `src/games/shared/input/DirectionalControl.tsx` — single-pointer fixed virtual stick.
- `src/games/shared/input/DirectionalControl.test.tsx` — dead-zone, capture, cancellation, ownership, and cleanup coverage.
- `src/games/shared/input/ActionButton.tsx` — semantic press/hold native button.
- `src/games/shared/input/ActionButton.test.tsx` — pointer lifecycle, keyboard accessibility, double-fire prevention, and cleanup coverage.
- `src/games/shared/input/inputControls.css` — bounded shared control presentation/focus/pressed styling.

### Donut Run consumer

- `src/games/donut-run/donutRunInput.ts` — `DonutRunAction` and keyboard bindings.
- `src/games/donut-run/donutRunInput.test.ts` — binding contract.
- `src/games/donut-run/DonutRunControls.tsx` — game-specific visible Jump layout using shared `ActionButton`.
- `src/games/donut-run/DonutRun.tsx` — semantic reader integration and Donut-specific game-surface pointer mapping.
- `src/games/donut-run/donutRun.css` — Donut surface and safe-area-aware touch-control placement.

### Neon Drift consumer

- `src/games/neon-drift/neonDriftInput.ts` — action type, keyboard bindings, and ordered lifecycle/control intent processor.
- `src/games/neon-drift/neonDriftInput.test.ts` — mapping plus start/pause/deploy ordering behavior.
- `src/games/neon-drift/NeonDriftControls.tsx` — game-specific stick/Boost/Deploy composition.
- `src/games/neon-drift/NeonDriftControls.test.tsx` — composed multi-touch movement + Boost/Deploy coverage.
- `src/games/neon-drift/NeonDriftGame.tsx` — replace raw key-set mechanics with semantic reader; route overlay Start through semantic intent.
- `src/games/neon-drift/neonDrift.css` — safe-area touch layout and HUD spacing.

### Catalog

- `src/games/catalog/gameCatalog.ts` — add `touch` to Donut Run and Neon Drift metadata only after each consumer works.
- `src/games/catalog/gameCatalog.test.ts` — assert both migrated games advertise `touch` + `keyboard`.

---

### Task 1: Build the source-aware semantic input store

**Files:**
- Create: `src/games/shared/input/semanticInput.ts`
- Create: `src/games/shared/input/semanticInput.test.ts`

**Interfaces:**
- Produces:

```ts
export type MovementVector = Readonly<{ x: number; y: number }>

export type SemanticInputReader<Action extends string> = {
  readonly move: MovementVector
  isHeld(action: Action): boolean
  consumePress(action: Action): boolean
}

export type SemanticInputWriter<Action extends string> = {
  setMoveSource(sourceId: string, x: number, y: number): void
  clearMoveSource(sourceId: string): void
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

- Later tasks depend on the stable identity of `reader.move` and source-aware semantics.

- [ ] **Step 1: Write failing semantic-store tests**

Cover these exact behaviors:

```ts
it('keeps one stable zero movement vector', () => {
  const input = createSemanticInput<'boost'>()
  const move = input.reader.move
  expect(move).toEqual({ x: 0, y: 0 })
  input.writer.setMoveSource('keyboard:KeyD', 1, 0)
  expect(input.reader.move).toBe(move)
  expect(move).toEqual({ x: 1, y: 0 })
})

it('aggregates, cancels, and radially clamps movement sources', () => {
  const input = createSemanticInput<'boost'>()
  input.writer.setMoveSource('right', 1, 0)
  input.writer.setMoveSource('down', 0, 1)
  expect(input.reader.move.x).toBeCloseTo(Math.SQRT1_2)
  expect(input.reader.move.y).toBeCloseTo(Math.SQRT1_2)
  input.writer.setMoveSource('left', -1, 0)
  expect(input.reader.move).toEqual({ x: 0, y: 1 })
})

it('keeps held actions active until every owning source releases', () => {
  const input = createSemanticInput<'boost'>()
  input.writer.setActionSource('keyboard:Space', 'boost', true)
  input.writer.setActionSource('button:boost', 'boost', true)
  input.writer.setActionSource('keyboard:Space', 'boost', false)
  expect(input.reader.isHeld('boost')).toBe(true)
  input.writer.clearSource('button:boost')
  expect(input.reader.isHeld('boost')).toBe(false)
})

it('buffers discrete presses and resets every semantic state', () => {
  const input = createSemanticInput<'deploy'>()
  input.writer.pulseAction('deploy')
  input.writer.pulseAction('deploy')
  expect(input.reader.consumePress('deploy')).toBe(true)
  expect(input.reader.consumePress('deploy')).toBe(true)
  expect(input.reader.consumePress('deploy')).toBe(false)
  input.writer.setMoveSource('move', 1, 0)
  input.writer.setActionSource('hold', 'deploy', true)
  input.writer.pulseAction('deploy')
  input.writer.reset()
  expect(input.reader.move).toEqual({ x: 0, y: 0 })
  expect(input.reader.isHeld('deploy')).toBe(false)
  expect(input.reader.consumePress('deploy')).toBe(false)
})
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
npm test -- src/games/shared/input/semanticInput.test.ts
```

Expected: FAIL because `semanticInput.ts` / `createSemanticInput` does not exist yet.

- [ ] **Step 3: Implement the minimal semantic store**

Use a `Map<string, {x:number;y:number}>` for movement sources, source-aware held-action sets, and a pending press-count map. Recompute the single mutable movement vector only when sources change, normalizing the aggregate when its magnitude exceeds `1`.

`clearSource(sourceId)` must remove that source from both movement and every held action. `reset()` must clear all maps/counts and mutate the stable movement object back to `{x:0,y:0}`.

- [ ] **Step 4: Run focused tests and verify green**

```bash
npm test -- src/games/shared/input/semanticInput.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the semantic core**

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
- Consumes: `SemanticInputWriter<Action>` and `createSemanticInput<Action>()` from Task 1.
- Produces:

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

- [ ] **Step 1: Write failing keyboard-adapter tests**

Test cardinal movement keydown/up, held actions, non-repeat press edges, one key containing both `hold` and `press`, mapped-key `preventDefault`, and interactive targets.

Important regression test:

```ts
it('ignores interactive keydown but always allows keyup to clear an owned source', () => {
  const input = createSemanticInput<'boost'>()
  const detach = attachKeyboardInput(window, input.writer, [
    { code: 'Space', hold: 'boost', preventDefault: true },
  ])

  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
  expect(input.reader.isHeld('boost')).toBe(true)

  const button = document.createElement('button')
  document.body.append(button)
  button.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }))
  expect(input.reader.isHeld('boost')).toBe(false)

  detach()
  button.remove()
})
```

Keydown from a focused/interactive target must not activate global gameplay semantics. Keyup still clears the mapped source so focus changes cannot leave a held key stuck.

- [ ] **Step 2: Run keyboard tests and verify red**

```bash
npm test -- src/games/shared/input/keyboardInput.test.ts
```

Expected: FAIL because the adapter is not implemented.

- [ ] **Step 3: Implement `attachKeyboardInput`**

Use one source ID per physical key: `keyboard:${event.code}`. On keydown, ignore interactive targets; otherwise apply move/hold contributions and pulse press actions only when `event.repeat === false`. On keyup, clear that key source regardless of event target. Cleanup removes listeners and clears every configured keyboard source.

The interactive selector must cover `button`, `a`, `input`, `select`, `textarea`, and `[contenteditable="true"]`.

- [ ] **Step 4: Write failing lifecycle-reset tests**

Spy on `writer.reset()` and verify exactly one reset for each of:

- `window.blur`;
- `document.visibilitychange` while `document.hidden === true`;
- `window.pagehide`;
- `document.fullscreenchange`;
- `window.orientationchange`;
- cleanup/unmount.

Also dispatch ordinary `resize` and assert it does not reset.

- [ ] **Step 5: Implement `attachInputResetLifecycle`**

Register the bounded listener set once. The returned cleanup removes every listener and calls `writer.reset()` once so unmount cannot retain held input.

- [ ] **Step 6: Implement `useSemanticInput`**

Create one `SemanticInput<Action>` lazily with a ref. In one effect, attach the keyboard and lifecycle adapters and detach both on unmount. The hook must never mirror `reader.move` or held actions into React state.

- [ ] **Step 7: Run shared adapter tests**

```bash
npm test -- src/games/shared/input/keyboardInput.test.ts src/games/shared/input/inputLifecycle.test.ts src/games/shared/input/semanticInput.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit keyboard/lifecycle glue**

```bash
git add src/games/shared/input/keyboardInput.ts src/games/shared/input/keyboardInput.test.ts src/games/shared/input/inputLifecycle.ts src/games/shared/input/inputLifecycle.test.ts src/games/shared/input/useSemanticInput.ts
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
- Consumes: `SemanticInputWriter<Action>`.
- Produces:

```ts
export type DirectionalControlProps = {
  writer: Pick<SemanticInputWriter<string>, 'setMoveSource' | 'clearMoveSource'>
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

If TypeScript variance makes `SemanticInputWriter<string>` too broad for movement-only usage, introduce and export a non-generic `MovementInputWriter` interface from `semanticInput.ts` containing only `setMoveSource` and `clearMoveSource`; do not weaken action typing.

- [ ] **Step 1: Write failing `DirectionalControl` tests**

Mock `setPointerCapture` / `releasePointerCapture` in JSDOM. Stub the control's `getBoundingClientRect()` to a deterministic `120x120` square.

Cover:

- first pointer claims ownership and calls `setPointerCapture`;
- center and movement within the `0.12` dead zone writes zero;
- edge movement produces a magnitude-1 vector;
- diagonal beyond the radius is radially clamped;
- second pointer is ignored while the first owns the stick;
- pointerup, pointercancel, lostpointercapture, and unmount clear the move source;
- returning to neutral mutates input without React-render-driven frame state.

- [ ] **Step 2: Implement `DirectionalControl`**

Use refs for pointer ownership, root element, and thumb element. On each owned pointer event, measure current bounds, compute center/radius, clamp magnitude, apply dead-zone rescaling, write the vector, and update CSS custom properties/`data-pressed` imperatively.

Do not store pointer coordinates in React state.

- [ ] **Step 3: Write failing `ActionButton` tests**

Cover press and hold modes, pointer capture, leave/re-entry for hold, pointerup/cancel/lost-capture cleanup, unmount cleanup, Enter/Space keyboard behavior, and this required regression:

```ts
it('emits one press for a pointer activation even when a native click follows', () => {
  const pulseAction = vi.fn()
  render(/* press ActionButton using pulseAction */)
  const button = screen.getByRole('button', { name: 'Deploy' })

  fireEvent.pointerDown(button, { pointerId: 7, clientX: 10, clientY: 10 })
  fireEvent.pointerUp(button, { pointerId: 7, clientX: 10, clientY: 10 })
  fireEvent.click(button, { detail: 1 })

  expect(pulseAction).toHaveBeenCalledTimes(1)
})
```

Also verify a native keyboard/synthetic `click` with `detail: 0` emits one press in `press` mode.

- [ ] **Step 4: Implement `ActionButton`**

For `press` mode, pointer completion inside the button emits the semantic press and records that the following pointer-generated click is already consumed. `onClick` emits only for keyboard/assistive activation (`detail === 0`) or another activation not already handled by the pointer path.

For `hold` mode, pointerdown sets the held source, pointermove toggles it according to current inside/outside bounds, and pointerup/cancel/lost-capture/unmount clears it. Local Enter/Space keydown/up handlers own a separate `${sourceId}:keyboard` source because the global keyboard adapter intentionally ignores focused buttons.

- [ ] **Step 5: Add bounded shared styles**

`inputControls.css` must provide:

- `pointer-events: auto` only on actual controls;
- `touch-action: none` only on actual controls;
- visible `:focus-visible` treatment;
- visible `[data-pressed="true"]` treatment;
- minimum `44px` action target with primary sizing in the `56–64px` range;
- a fixed circular stick with a bounded thumb transform;
- no continuous expensive blur/shader animation.

- [ ] **Step 6: Run pointer-control tests**

```bash
npm test -- src/games/shared/input/DirectionalControl.test.tsx src/games/shared/input/ActionButton.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit shared Pointer Events primitives**

```bash
git add src/games/shared/input/DirectionalControl.tsx src/games/shared/input/DirectionalControl.test.tsx src/games/shared/input/ActionButton.tsx src/games/shared/input/ActionButton.test.tsx src/games/shared/input/inputControls.css src/games/shared/input/semanticInput.ts
git commit -m "feat: add shared touch input controls"
```

---

### Task 4: Migrate Donut Run without changing player behavior

**Files:**
- Create: `src/games/donut-run/donutRunInput.ts`
- Create: `src/games/donut-run/donutRunInput.test.ts`
- Create: `src/games/donut-run/DonutRunControls.tsx`
- Create: `src/games/donut-run/donutRun.css`
- Modify: `src/games/donut-run/DonutRun.tsx`
- Modify: `src/games/catalog/gameCatalog.ts`
- Modify: `src/games/catalog/gameCatalog.test.ts`

**Interfaces:**
- Produces:

```ts
export type DonutRunAction = 'jump'

export const donutRunKeyboardBindings: readonly KeyboardBinding<DonutRunAction>[] = [
  { code: 'Space', press: 'jump', preventDefault: true },
  { code: 'ArrowUp', press: 'jump', preventDefault: true },
]
```

- `DonutRunControls` receives `SemanticInputWriter<DonutRunAction>` and renders one shared press-mode Jump `ActionButton`.

- [ ] **Step 1: Write failing Donut mapping/catalog tests**

Assert the exact keyboard bindings above and assert `getGameByRoute('/games/donut-run')?.inputs` contains both `keyboard` and `touch` once migration lands.

- [ ] **Step 2: Implement Donut mapping/control composition**

Create `DonutRunControls.tsx` with a game-specific safe-area wrapper and:

```tsx
<ActionButton
  action="jump"
  mode="press"
  sourceId="button:donut-run:jump"
  writer={writer}
>
  Jump
</ActionButton>
```

- [ ] **Step 3: Migrate Donut runtime input**

In `DonutRun.tsx`:

1. create one `useSemanticInput(donutRunKeyboardBindings)` instance;
2. move the Phaser parent ref to a full-size Donut surface element inside `GameViewport`;
3. route that surface's `onPointerDown` directly to `writer.pulseAction('jump')` as a Donut-specific mapping;
4. pass `DonutRunControls` through `GameViewport.inputOverlay`;
5. remove Phaser `pointerdown`, `keydown-SPACE`, and `keydown-UP` registrations;
6. at the beginning of the Phaser scene update, consume pending `jump` input and call the existing `handleAction()` mechanics path;
7. retain the existing menu/dead/running behavior and existing player-facing `Tap, click, or press SPACE` copy.

The touch Jump overlay and fullscreen button are siblings of the Donut surface, not descendants, so their pointer events cannot bubble into the surface mapping and double-fire `jump`.

- [ ] **Step 4: Add Donut layout styles**

Create a full-size `.donut-run__surface` with local `touch-action: none`. Position the touch Jump control via the overlay near the lower-right safe area. Hide visual thumb controls on pointer-fine desktop layouts while preserving game-surface mouse click and keyboard behavior.

- [ ] **Step 5: Update Donut catalog metadata**

Change only Donut Run's catalog `inputs` from `['keyboard']` to `['touch', 'keyboard']`.

- [ ] **Step 6: Run Donut-focused tests**

```bash
npm test -- src/games/donut-run/donutRunInput.test.ts src/games/catalog/gameCatalog.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Donut migration**

```bash
git add src/games/donut-run src/games/catalog/gameCatalog.ts src/games/catalog/gameCatalog.test.ts
git commit -m "feat: migrate Donut Run to semantic input"
```

---

### Task 5: Define and test Neon Drift semantic lifecycle ordering

**Files:**
- Create: `src/games/neon-drift/neonDriftInput.ts`
- Create: `src/games/neon-drift/neonDriftInput.test.ts`

**Interfaces:**
- Produces:

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

Keyboard bindings must preserve:

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

- [ ] **Step 1: Write failing mapping tests**

Assert the exact semantic mapping above and that no game-mechanics-facing mapping exposes raw key values beyond this device adapter configuration.

- [ ] **Step 2: Write failing lifecycle-order tests**

Use a real `createSemanticInput<NeonDriftAction>()` reader and mutable test runtime.

Required cases:

1. queued `start` invokes `start()` while `running === false`;
2. queued `pause` changes `paused: false -> true` while running;
3. a later queued `pause` changes `paused: true -> false` while running;
4. `deploy` while paused is consumed without invoking `deploy()` and does not fire after a later resume;
5. when `pause` and `deploy` are both queued while paused, processing `pause` first resumes and then allows the same-frame Deploy because runtime state is re-read after each lifecycle handler;
6. `start` is processed before deploy/simulation gating.

- [ ] **Step 3: Implement `processNeonDriftControlIntents`**

Process in this exact order:

```ts
const startPressed = reader.consumePress('start')
if (startPressed && (!runtime.isRunning() || runtime.isGameOver())) {
  runtime.start()
}

const pausePressed = reader.consumePress('pause')
if (pausePressed && runtime.isRunning() && !runtime.isGameOver()) {
  runtime.togglePause()
}

const deployPressed = reader.consumePress('deploy')
if (
  deployPressed &&
  runtime.isRunning() &&
  !runtime.isPaused() &&
  !runtime.isGameOver()
) {
  runtime.deploy()
}
```

The `deploy` edge is consumed whether or not deployment is currently valid.

- [ ] **Step 4: Run Neon semantic tests**

```bash
npm test -- src/games/neon-drift/neonDriftInput.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Neon semantic contract**

```bash
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

**Interfaces:**
- Consumes: `useSemanticInput`, `DirectionalControl`, `ActionButton`, `neonDriftKeyboardBindings`, and `processNeonDriftControlIntents`.
- `NeonDriftControls` receives `SemanticInputWriter<NeonDriftAction>`.

- [ ] **Step 1: Write failing composed multi-touch tests**

Render `NeonDriftControls` with a real semantic input writer. Use distinct pointer IDs and deterministic stick bounds.

Required cases:

```text
pointer 17 -> stick right
pointer 22 -> Boost held
reader.move.x > 0 AND reader.isHeld('boost') === true
```

and:

```text
pointer 17 -> stick up
pointer 24 -> Deploy press
reader.move.y < 0 AND reader.consumePress('deploy') === true
```

Cancel/release one pointer and assert the other intent remains active.

- [ ] **Step 2: Implement `NeonDriftControls`**

Compose one lower-left `DirectionalControl`, one lower-right hold-mode Boost `ActionButton`, and one adjacent/above press-mode Deploy `ActionButton`. Give each a unique source ID.

- [ ] **Step 3: Migrate raw-key runtime reads**

In `NeonDriftGame.tsx`:

1. create one `useSemanticInput(neonDriftKeyboardBindings)` instance;
2. delete the raw `Set<string>` and global `keydown`/`keyup` handlers;
3. replace `ix`/`iy` calculations with `reader.move.x` / `reader.move.y`;
4. replace `keys.has('Space')` with `reader.isHeld('boost')`;
5. construct a `NeonDriftControlRuntime` facade over current `running`, `paused`, `gameOver`, `start`, pause toggle, and `deployTurret` behavior;
6. call `processNeonDriftControlIntents(reader, runtime)` before the active-simulation early return on every update;
7. only after lifecycle/control processing, return early when `!running || paused || gameOver`;
8. keep the existing game-specific blur-to-pause behavior, but remove key clearing because shared lifecycle reset now owns semantic-input clearing;
9. change the intro/game-over panel button handler from calling `startRef` mechanics directly to `writer.pulseAction('start')`;
10. preserve keyboard `Space`/`Enter` start/restart, `P` pause/resume, `R` deploy, movement, and boost behavior.

- [ ] **Step 4: Mount touch controls through `GameViewport.inputOverlay`**

Render Neon touch controls only while the run overlay is not visible:

```tsx
<GameViewport
  game="neon-drift"
  inputOverlay={
    overlayVisible ? null : <NeonDriftControls writer={input.writer} />
  }
  label="Neon Drift game"
  ref={viewportRef}
>
  {/* existing runtime */}
</GameViewport>
```

Unmounting the controls on overlay/game-over must clear their owned sources through the shared primitive cleanup paths.

- [ ] **Step 5: Add safe-area-aware Neon control layout**

Update `neonDrift.css` so visual touch controls appear for coarse pointers and compact mobile layouts, preserve the fullscreen control, use safe-area insets, and do not obscure the Start/game-over panel. Shift the bottom Boost meter only enough to remain readable above thumb controls on touch layouts.

Do not add continuous visual effects to the controls.

- [ ] **Step 6: Update Neon catalog metadata**

Change only Neon Drift's `inputs` from `['keyboard']` to `['touch', 'keyboard']`. Extend `gameCatalog.test.ts` to assert both Donut Run and Neon Drift advertise those two inputs.

- [ ] **Step 7: Run all focused shared-input/game tests**

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
```

Expected: PASS.

- [ ] **Step 8: Commit Neon migration**

```bash
git add src/games/neon-drift src/games/catalog/gameCatalog.ts src/games/catalog/gameCatalog.test.ts
git commit -m "feat: migrate Neon Drift to semantic input"
```

---

### Task 7: Run the release gate, perform player validation, and open the focused PR

**Files:**
- Modify only implementation/tests if validation exposes Issue #14 defects.
- Use `.github/pull_request_template.md` as the PR body structure.

**Interfaces:**
- Consumes the complete Issue #14 branch.
- Produces a reviewable, unmerged PR to `main` containing `Closes #14`.

- [ ] **Step 1: Run the complete automated repository gate**

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit `0`.

If a validation failure is caused by this branch, fix it using a focused red/green cycle and rerun the full gate. Do not fix unrelated pre-existing warnings or roadmap status in this PR.

- [ ] **Step 2: Audit the final diff against current `main`**

Verify the diff is limited to:

- the approved spec/plan;
- `src/games/shared/input/`;
- Donut Run input integration/styles/tests;
- Neon Drift input integration/styles/tests;
- catalog input metadata/tests.

Reject unrelated game, networking, Chat, server, monetization, analytics, account, deployment, or roadmap-status changes.

- [ ] **Step 3: Perform available desktop hands-on validation**

Exercise in a real browser where tooling allows:

- Donut Run Space, ArrowUp, game-surface mouse click, Start/death/restart;
- Donut visible Jump control where touch emulation is available;
- Neon WASD/arrows, Space Boost, R Deploy, P pause and resume, Enter/Space Start/Run It Back;
- fullscreen enter/exit;
- focus loss/regain;
- resize;
- no stuck input after interruption;
- perceived latency and frame stability;
- React controls do not render at frame rate.

- [ ] **Step 4: Perform available touch/mobile validation**

Where actual hardware/browser access is available, test:

- Donut tap-anywhere and Jump control;
- Neon stick movement;
- Neon move + Boost multi-touch;
- Neon move + Deploy multi-touch;
- portrait/landscape rotation;
- safe-area/control placement;
- fullscreen transitions;
- focus/interruption recovery;
- accidental page/browser gestures around controls;
- lower-powered-device frame stability.

If iPhone/Android hardware or pointer-cancel tooling is unavailable, state that exact gap in the PR instead of implying coverage.

- [ ] **Step 5: Confirm branch CI**

After pushing the final branch head, wait for the repository's branch validation workflow and confirm the same test/lint/build gate is green. If GitHub Actions fails, inspect the job logs and repair only branch-caused failures.

- [ ] **Step 6: Open the PR to `main` using the repository template**

Use a focused title such as:

```text
feat: add shared semantic input foundation
```

The PR body must include:

```text
Closes #14
```

and clearly separate:

- automated validation evidence;
- hands-on browser/device evidence;
- any manual validation gaps;
- performance impact;
- review focus around input ownership/reset/double-fire behavior.

- [ ] **Step 7: Leave the PR unmerged**

Do not enable auto-merge and do not merge the PR without explicit user authorization.
