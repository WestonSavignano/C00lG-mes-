# C00lG@mes+ Shared Semantic Input Design

Date: 2026-09-11
Status: Approved in chat; awaiting written-spec review
Owning Issue: #14 — Add shared semantic input foundation

## Goal

Create a small reusable semantic input foundation under `src/games/shared/input/` so game runtimes consume player intent rather than duplicating raw keyboard/touch handling.

The first proving consumers are Donut Run and Neon Drift:

- Donut Run proves a simple discrete action that must behave the same across keyboard, game-surface click/tap, and a visible touch action button.
- Neon Drift proves continuous two-axis movement, held Boost, discrete Deploy, lifecycle actions, multi-touch, interruption reset, and cheap game-loop polling.

This work is a focused Stage 0 engineering slice. It does not migrate every game, add gamepad infrastructure, introduce a global state library, redesign mechanics, or change networking/Chat/server behavior.

## Current-state constraints

The implementation must preserve the existing shell boundaries already on `main`:

- `GameViewport` owns viewport, focus, fullscreen, and the shared `inputOverlay` mount.
- Individual games own their control layouts and mechanics.
- Shared input infrastructure belongs under `src/games/shared/input/`.
- Game loops must not move frame-by-frame state through React.
- Pointer Events are the shared pointer/touch foundation.
- Touch controls must use practical 44px+ targets, safe-area-aware placement, visible focus/pressed states, and no hover dependency.

`ROADMAP.md` contains stale status text about previously open shell PRs, but correcting that status is explicitly out of scope for Issue #14 and this branch.

## Design principles

### 1. Semantic intent is the runtime boundary

Game mechanics should read intent such as `move`, `jump`, `boost`, `deploy`, `start`, and `pause` rather than DOM values such as `KeyW`, `Space`, or pointer IDs.

Device-specific adapters translate keyboard or pointer interactions into the same semantic state. This prevents touch and keyboard from becoming separate gameplay implementations.

### 2. Mutable state, stable identity, cheap reads

Each mounted game owns one semantic input instance for its lifetime. The underlying state is mutable and ref-backed rather than React state.

The read API exposes:

- one stable movement vector object;
- held-action lookup;
- buffered discrete-press consumption.

The game loop may poll this state every frame without allocating new objects or triggering React renders.

React is used only for bounded presentation changes that a player needs rendered. Pointer movement and frame-by-frame input state never use React state.

### 3. Read/write separation

The runtime and device adapters use distinct interfaces.

Conceptually:

```ts
type MovementVector = Readonly<{ x: number; y: number }>

type SemanticInputReader<Action extends string> = {
  readonly move: MovementVector
  isHeld: (action: Action) => boolean
  consumePress: (action: Action) => boolean
}

type SemanticInputWriter<Action extends string> = {
  setMoveSource: (sourceId: string, x: number, y: number) => void
  clearMoveSource: (sourceId: string) => void
  setActionSource: (sourceId: string, action: Action, held: boolean) => void
  pulseAction: (action: Action) => void
  clearSource: (sourceId: string) => void
  reset: () => void
}
```

Exact names may adjust during implementation, but the responsibilities and dependency direction should remain this narrow.

Gameplay code reads semantic intent. Device adapters write semantic intent. Gameplay code must not depend on raw keyboard codes or pointer IDs for migrated actions.

## Semantic state model

### Movement

Directional sources contribute independent vectors.

Examples:

- `keyboard:KeyW` -> `(0, -1)`
- `keyboard:KeyD` -> `(1, 0)`
- `stick:neon-drift` -> continuous analog vector

The store aggregates all active movement sources, then clamps the final vector to magnitude 1. Opposing directions cancel naturally. Multiple sources cannot produce movement faster than the game's intended normalized range.

The final movement vector is stored in one stable object whose `x` and `y` fields are mutated internally. Reading movement therefore does not allocate per frame.

### Held actions

Held actions such as Neon Drift `boost` are source-aware.

An action is held while at least one active source holds it. Releasing one source must not clear another source that still owns the same semantic action.

### Discrete presses

Discrete actions such as `jump`, `deploy`, `start`, and `pause` use buffered press edges rather than a transient boolean.

A press increments a small pending count. `consumePress(action)` consumes one pending edge and returns `true`; otherwise it returns `false`.

This prevents short pointer/keyboard presses from being lost between animation frames while still making consumption deterministic.

`reset()` clears movement sources, held actions, and all pending press edges so no action fires after interruption recovery.

## Source ownership

Every device contribution has a source identifier.

Examples:

- `keyboard:KeyW`
- `keyboard:Space`
- `stick:neon-drift`
- `button:boost`
- `button:deploy`

Source-aware ownership is required for mixed input. Keyboard and touch may be active at the same time without one release incorrectly clearing the other's state.

`clearSource(sourceId)` removes every contribution owned by that source.

## Keyboard adapter

A shared keyboard adapter maps DOM key codes to semantic bindings declared beside each game.

A binding may represent:

- a directional vector;
- a held action;
- a discrete press action.

One physical key may contribute more than one semantic binding when preserving existing behavior requires it. For example, Neon Drift `Space` may both hold `boost` and pulse `start` on initial keydown so the old behavior remains possible without making the runtime inspect `Space` directly.

The adapter attaches a stable listener set rather than re-registering handlers per frame or render.

### Keyboard event rules

- Ignore global gameplay mappings when the event originates from an interactive DOM control such as a `button`, `a`, `input`, `select`, `textarea`, or editable element.
- Prevent default browser scrolling only for mapped gameplay keys that require it.
- Direction and held-action sources activate on `keydown` and clear on `keyup`.
- Discrete press bindings fire only on the initial non-repeat `keydown` unless a specific existing behavior proves otherwise.
- Adapter cleanup clears its owned sources.

This preserves native keyboard accessibility for focused shared controls while keeping game mechanics semantic.

## Shared Pointer Events primitives

Issue #14 requires reusable primitives, not one universal control component.

The shared layer will provide two focused concepts:

- a directional/virtual-stick primitive;
- a semantic action-button primitive.

Each game composes these primitives into its own layout through `GameViewport.inputOverlay`.

### Directional control

The directional control is a fixed virtual stick.

Behavior:

- claim one pointer on `pointerdown` when currently unowned;
- call `setPointerCapture(pointerId)`;
- ignore additional pointers until the owning pointer ends;
- compute the current vector from the pointer position relative to the control's current bounds;
- clamp radial magnitude to 1;
- apply an approximately `0.12` normalized radial dead zone;
- rescale magnitude outside the dead zone so movement begins smoothly rather than jumping from zero to the dead-zone threshold;
- write the resulting vector through one source ID;
- clear that source on `pointerup`, `pointercancel`, `lostpointercapture`, and unmount.

Geometry should be measured from current control bounds so resize/rotation does not depend on stale mount-time measurements.

The control should update its thumb/pressed visuals imperatively with element refs/CSS variables or attributes. Pointer movement must not cause React renders.

### Action button

`ActionButton` is a semantic native `<button>` with two supported modes:

- `hold` — semantic action remains held while the owning pointer or keyboard key is actively held over the control;
- `press` — one successful activation queues one discrete press edge.

The component owns at most one pointer at a time and uses Pointer Events for pointer lifecycle, capture, cancellation, and pressed-state presentation.

Primary touch buttons should normally be approximately 56–64px while never dropping below a practical 44px target.

### Native keyboard accessibility and double-fire prevention

Focused `ActionButton`s must preserve native keyboard accessibility even though the global keyboard adapter ignores interactive elements.

For `press` mode:

- pointer input is handled through the Pointer Events lifecycle;
- one semantic press is emitted only when the owning pointer completes a valid activation inside the button;
- the later pointer-generated native `click` must not emit a second press;
- keyboard or assistive activation continues to use the native button activation path and must emit exactly one semantic press.

A practical implementation may distinguish pointer-generated clicks from keyboard/synthetic activation using the event's pointer/click provenance, but the invariant is more important than the exact mechanism: one physical activation produces one semantic press.

For `hold` mode:

- pointer down inside activates the held source;
- pointer movement outside the button clears the held action immediately;
- re-entry while the same captured pointer remains down may reactivate it;
- pointer up/cancel/lost-capture clears the source;
- focused Enter/Space keyboard interaction must set and clear the held source using local button key handling because the global gameplay keyboard adapter intentionally ignores the focused button.

Native focus semantics and visible `:focus-visible` treatment remain intact.

## Multi-touch ownership

Pointer ownership is local to each control rather than global.

Example:

```text
pointer 17 -> directional stick -> move
pointer 22 -> Boost button      -> boost held
```

or:

```text
pointer 17 -> directional stick -> move
pointer 24 -> Deploy button     -> deploy press
```

The runtime never sees those pointer IDs.

A stick pointer and one or more action-button pointers may coexist. Releasing or canceling one pointer clears only its source.

## Interruption and cleanup semantics

The shared lifecycle must guarantee deterministic neutral input after interruption.

Reset the semantic input state on:

- `window.blur`;
- document transition to hidden;
- `pagehide`;
- fullscreen transition;
- orientation transition;
- component/runtime unmount.

A normal resize by itself should not automatically reset input because mobile browser chrome can generate frequent resize events during legitimate play. Instead, the virtual stick uses current bounds for every pointer calculation.

Fullscreen/orientation transitions may substantially move controls, so resetting to neutral is safer than preserving stale pointer state.

Pointer controls additionally clear their own sources on pointer up, cancel, lost capture, and unmount.

The shared input layer clears intent; it does not impose one universal pause policy on games.

## `GameViewport` integration

`GameViewport` remains the mount boundary.

```text
GameViewport
├─ runtime / canvas
└─ inputOverlay
   └─ game-specific control composition
      ├─ DirectionalControl
      └─ ActionButton(s)
```

The existing overlay container remains `pointer-events: none`. Shared interactive controls opt back in with `pointer-events: auto`.

Game-specific wrappers own control placement, safe-area offsets, and which controls are visible for that game.

`touch-action: none` applies only to actual interactive control regions or game surfaces that intentionally consume touch gestures. The implementation must not globally suppress browser gestures outside regions that need gameplay ownership.

## Donut Run migration

Donut Run proves the simple/discrete side of the architecture while preserving existing player-visible behavior.

### Semantic action

Donut Run defines one migrated gameplay action:

```ts
type DonutRunAction = 'jump'
```

The existing Phaser `handleAction()` remains the mechanics authority:

- menu -> start;
- running -> jump when allowed;
- dead -> restart.

The Phaser scene consumes `jump` press edges and calls that existing semantic gameplay path.

### Input mappings

All of these must feed the same `jump` intent:

- `Space`;
- `ArrowUp`;
- game-surface pointer press;
- visible shared `ActionButton` labeled Jump.

The current copy tells players `Tap, click, or press SPACE`, so click/tap-anywhere is part of the behavior contract and must remain.

The game-surface mapping is intentionally Donut-specific rather than introducing a generic whole-surface shared-control abstraction with only one consumer.

A practical composition is to give the Phaser canvas/runtime its own full-size Donut surface wrapper inside `GameViewport`. That surface owns the Donut-specific `pointerdown` mapping, while `inputOverlay` remains a sibling for the visible Jump button. This prevents the Jump button or fullscreen control from bubbling into the surface mapping and double-firing.

The Donut surface is an intentional active touch-control region, so local `touch-action: none` is appropriate there.

Phaser should no longer own raw keyboard or pointer mappings for migrated actions once the semantic path is active.

Catalog metadata becomes `['touch', 'keyboard']`.

## Neon Drift migration

Neon Drift proves continuous, held, discrete, lifecycle, and multi-touch behavior.

### Semantic actions

Conceptually:

```ts
type NeonDriftAction = 'boost' | 'deploy' | 'start' | 'pause'
```

Movement is the shared continuous `move` vector rather than a named action.

### Keyboard mappings

Preserve existing desktop behavior:

- `W` / `ArrowUp` -> move up;
- `A` / `ArrowLeft` -> move left;
- `S` / `ArrowDown` -> move down;
- `D` / `ArrowRight` -> move right;
- `Space` -> hold Boost;
- `Space` / `Enter` -> Start when gameplay is not running;
- `R` -> Deploy;
- `P` -> Pause/resume.

The migrated runtime no longer queries raw keyboard codes for these actions.

### Runtime ordering: lifecycle/control intents before simulation gating

`start`/restart and `pause` must be processed outside the paused/running simulation early-return path.

Each animation-frame iteration should conceptually follow this order:

1. consume lifecycle/control press intents;
2. process `start` when gameplay is not running/game-over;
3. process `pause` when gameplay is running, allowing the same action to both pause and resume;
4. consume `deploy` and execute it only when gameplay is currently running and not paused;
5. only then decide whether simulation advancement should return early for not-running, paused, or game-over state;
6. when simulation is active, read `move` and held `boost` while updating the player.

Invalid Deploy presses should be consumed/discarded while Deploy is unavailable rather than remaining queued and unexpectedly firing after resume/start.

This ordering ensures:

- `P` can always resume a paused run;
- Start/restart works while simulation is stopped;
- lifecycle actions do not depend on `update()` entering the active-simulation path;
- Deploy remains gameplay-state dependent.

### Touch composition

Neon Drift's game-specific overlay composes:

- virtual stick lower-left;
- held Boost action button lower-right;
- Deploy press button adjacent to or above Boost.

The intro/game-over panel remains the primary Start/Run It Back affordance and should feed the same semantic `start` intent rather than calling mechanics through a separate device-specific path.

Touch controls should not obscure that panel when it is visible.

The existing bottom-center Boost meter may receive a small touch-layout spacing adjustment so thumb controls do not cover important HUD information. This is an input-layout change, not a mechanic redesign.

Catalog metadata becomes `['touch', 'keyboard']`.

## Touch-control visibility and layout

Do not maintain a React `isTouchDevice` flag just to show controls.

Render the game-specific control overlay and use CSS media conditions such as `any-pointer: coarse` and compact viewport sizing to expose touch controls where appropriate. Large pointer-fine desktop layouts may hide the visual thumb controls while retaining keyboard behavior.

Controls must respect:

- `env(safe-area-inset-left)`;
- `env(safe-area-inset-right)`;
- `env(safe-area-inset-bottom)`;
- the existing fullscreen button and game chrome;
- practical thumb reach;
- 44px minimum targets.

## Performance contract

The input foundation must be cheap enough to query every frame.

Required properties:

- no frame-by-frame React state;
- no per-frame semantic-input object allocation;
- stable listener registration;
- bounded event work;
- no unnecessary global listener duplication;
- imperative virtual-stick visual updates;
- simple CSS feedback rather than expensive continuous visual effects.

Each game owns one semantic input instance and one normal keyboard/lifecycle listener set.

## Testing strategy

Use test-driven development where practical.

### Semantic store tests

Cover deterministic behavior for:

- initial zero movement;
- movement-source aggregation;
- opposing movement cancellation;
- diagonal normalization/clamping;
- multiple source ownership;
- held-action aggregation;
- source-specific release;
- discrete press buffering/consumption;
- full reset clearing movement, held actions, and press edges;
- no stuck input after cleanup.

### Keyboard adapter tests

Cover:

- directional keydown/keyup mappings;
- held action keydown/keyup;
- discrete action press behavior;
- key-repeat suppression for press actions;
- multiple semantic bindings from one key where configured;
- prevention of browser defaults only for relevant mapped keys;
- ignoring events from interactive DOM controls;
- adapter cleanup clearing owned sources.

### Directional-control tests

Cover:

- pointer claim/capture;
- normalized directional output;
- dead-zone behavior;
- radial clamping;
- ignoring secondary pointers while owned;
- pointer release;
- pointer cancel;
- lost pointer capture;
- unmount cleanup;
- deterministic return to zero.

### Action-button tests

Cover:

- press pointer activation;
- held pointer activation/release;
- pointer movement outside clearing held state;
- pointer cancel/lost capture cleanup;
- focused Enter/Space activation;
- no double press from one pointer activation plus subsequent native click;
- unmount cleanup;
- visible semantic pressed/focus state hooks.

### Composed multi-touch tests

Exercise different pointer IDs simultaneously to prove:

- movement + Boost;
- movement + Deploy;
- releasing/canceling one pointer does not clear the other's intent.

### Donut Run mapping tests

Verify:

- Space -> `jump`;
- ArrowUp -> `jump`;
- game-surface pointer -> `jump`;
- Jump button -> `jump`;
- all paths converge on the existing `handleAction()` mechanics path;
- no duplicate jump from button activation bubbling into the game surface.

### Neon Drift mapping/runtime tests

Verify:

- WASD/arrows -> semantic movement;
- Space -> held Boost and Start press behavior as configured;
- R -> Deploy;
- P -> Pause/resume;
- Enter -> Start;
- lifecycle intents are processed before simulation early returns;
- pause can resume a paused game;
- start/restart can execute while simulation is not running;
- invalid Deploy press is consumed without firing later;
- movement + Boost and movement + Deploy work simultaneously.

### Catalog tests

Donut Run and Neon Drift must advertise both `touch` and `keyboard` input metadata.

## Repository validation

The full repository gate is mandatory:

```bash
npm test
npm run lint
npm run build
```

Automated tests are necessary but not sufficient.

## Manual gameplay validation

Before the PR is called ready, exercise as much of the following as available and record both evidence and gaps honestly:

### Donut Run

- touch Jump button;
- game-surface tap anywhere;
- desktop mouse click anywhere;
- Space and ArrowUp parity;
- start, jump, death, and restart behavior;
- no double jump from visible button interaction.

### Neon Drift

- directional touch movement;
- movement + Boost simultaneously;
- movement + Deploy simultaneously;
- keyboard parity;
- Start/Run It Back from button and keyboard;
- pause and resume with `P`;
- invalid Deploy while paused does not fire after resume.

### Lifecycle / environment

- portrait/landscape transitions;
- resize;
- fullscreen enter/exit;
- focus loss/regain;
- pointer cancellation where tooling allows;
- pause/resume/interruption;
- no stuck input after blur, visibility change, orientation change, fullscreen transition, pointer cancel, or unmount;
- touch-target size/readability and safe-area placement;
- accidental browser/page gestures around active controls;
- perceived input latency/game feel;
- frame stability and React render behavior;
- representative lower-powered hardware where available;
- iPhone and Android parity where practical.

Do not manufacture device evidence. The PR must distinguish automated coverage from hands-on browser/device validation.

## Expected file boundary

The implementation should remain focused around these areas:

```text
src/games/shared/input/
  semantic input store
  keyboard adapter
  interruption/reset lifecycle helper
  DirectionalControl
  ActionButton
  shared input-control styles
  focused tests

src/games/donut-run/
  semantic mapping/control composition
  Donut-specific game-surface pointer mapping
  existing runtime integration
  focused tests/styles as needed

src/games/neon-drift/
  semantic mapping/control composition
  runtime intent integration
  touch layout/styles
  focused tests

src/games/catalog/
  input metadata/tests
```

Do not touch Fart Attack, Bodi Island, networking, Chat, server behavior, monetization, analytics, accounts, unrelated roadmap status, or other games merely to adopt the new abstraction.

## Acceptance summary

The design is successful when:

- keyboard and Pointer Events feed one shared semantic contract;
- game loops read mutable/ref-backed intent without frame-rate React rendering;
- directional input is normalized, clamped, and reset safely;
- held and press actions preserve source ownership and cannot get stuck;
- shared action buttons remain keyboard accessible and cannot double-fire from pointer + native activation;
- multi-touch supports movement + action;
- Donut Run preserves keyboard plus click/tap-anywhere behavior and gains a visible touch Jump button through the same `jump` intent;
- Neon Drift uses semantic movement/Boost/Deploy/Start/Pause and handles lifecycle intents before simulation gating;
- migrated catalog metadata accurately advertises touch + keyboard;
- the full repository validation gate passes;
- manual gameplay evidence and remaining gaps are recorded in the PR;
- the PR closes Issue #14, stays focused, and is not merged without explicit authorization.
