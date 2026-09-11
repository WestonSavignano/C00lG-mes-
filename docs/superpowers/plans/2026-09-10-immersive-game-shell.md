# C00lG@mes+ Immersive Game Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize every catalog game route on one immersive, mobile-first `GamePageShell` with orientation guidance, resilient lazy-route states, improved viewport focus/fullscreen behavior, and a future shared-input mount point without changing game mechanics.

**Architecture:** Keep `gameCatalog` as the product source of truth and make `gameRoutes.tsx` the single place that wraps lazy game page adapters in shared route infrastructure. `GamePageShell` owns site-level game chrome and orientation guidance; `GameViewport` owns the actual interactive viewport, fullscreen/focus behavior, and the future input-overlay mount point. Individual `*Page.tsx` files become thin runtime adapters so they no longer duplicate generic `Page/PageHeader/H1` chrome.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Lucide React, CSS, Vitest, Testing Library, Vite 8.

**Spec:** `docs/superpowers/specs/2026-09-10-mobile-first-arcade-shell-design.md`

## Global Constraints

- This PR is stacked on `feature/2027-arcade-shell-discovery` / PR #7 and must not modify PR #7's discovery behavior except where game-route presentation requires it.
- Preserve all current game mechanics, simulation code, controls, Chat behavior, networking, and server behavior.
- Do not introduce the shared semantic touch-control system in this PR; only establish the `GameViewport` mount point needed by the next slice.
- `GamePageShell` must be the only site-level wrapper around catalog game routes.
- All catalog game routes must keep lazy loading; Home and Games must not eagerly import runtime modules.
- Orientation guidance is advisory, not a hard blocker, and must be dismissible.
- Orientation guidance must only appear when the catalog declares a non-`either` orientation and the current device/viewport is plausibly handheld.
- Fullscreen remains progressive enhancement; game routes must be usable without it.
- Mobile game mode must respect safe-area insets and dynamic viewport units, hide competing global navigation chrome, and avoid page scrolling around the active game surface.
- Desktop game mode keeps compact global navigation and a framed game presentation.
- Preserve and extend `GameViewport` rather than replacing it.
- Runtime errors must not take down global navigation; players need retry and return-to-Games recovery paths.
- All nonessential motion must respect `prefers-reduced-motion`.
- No new dependency is allowed.
- Require `npm test`, `npm run lint`, and `npm run build` green on the final head.

---

### Task 1: Orientation guidance as an isolated shared behavior

**Files:**
- Create: `src/games/shared/orientation.ts`
- Create: `src/games/shared/orientation.test.ts`
- Create: `src/games/shared/GameOrientationNotice.tsx`
- Create: `src/games/shared/GameOrientationNotice.css`
- Create: `src/games/shared/GameOrientationNotice.test.tsx`

**Interfaces:**
- Consumes: `GameOrientation` from `src/games/catalog/gameTypes.ts`.
- Produces: `getViewportOrientation(width: number, height: number): 'portrait' | 'landscape'`.
- Produces: `shouldSuggestOrientation(required: GameOrientation, width: number, height: number, coarsePointer: boolean): boolean`.
- Produces: `GameOrientationNotice({ orientation, title })` which observes viewport changes, renders an accessible advisory only when `shouldSuggestOrientation` is true, and allows a player to dismiss it for the lifetime of that mounted route.

- [ ] **Step 1: Write failing pure orientation tests**

Create `src/games/shared/orientation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getViewportOrientation, shouldSuggestOrientation } from './orientation'

describe('game orientation guidance', () => {
  it('classifies viewport orientation deterministically', () => {
    expect(getViewportOrientation(390, 844)).toBe('portrait')
    expect(getViewportOrientation(844, 390)).toBe('landscape')
    expect(getViewportOrientation(600, 600)).toBe('landscape')
  })

  it('suggests a declared landscape orientation on a portrait handheld', () => {
    expect(shouldSuggestOrientation('landscape', 390, 844, true)).toBe(true)
    expect(shouldSuggestOrientation('landscape', 844, 390, true)).toBe(false)
  })

  it('does not force guidance for either-orientation games or ordinary desktop use', () => {
    expect(shouldSuggestOrientation('either', 390, 844, true)).toBe(false)
    expect(shouldSuggestOrientation('landscape', 900, 1200, false)).toBe(false)
  })
})
```

- [ ] **Step 2: Write failing component behavior tests**

Create `GameOrientationNotice.test.tsx` with a small `matchMedia` mock. Verify a portrait coarse-pointer viewport renders `Rotate your device to play <title> in landscape`, clicking `Play anyway` removes the notice, and a landscape viewport renders no notice.

```tsx
it('lets a portrait handheld player continue without rotating', async () => {
  installViewport({ width: 390, height: 844, coarsePointer: true })
  const user = userEvent.setup()

  render(<GameOrientationNotice orientation="landscape" title="Neon Drift" />)

  expect(screen.getByRole('status')).toHaveTextContent(
    'Rotate your device to play Neon Drift in landscape',
  )

  await user.click(screen.getByRole('button', { name: 'Play anyway' }))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Push test-only changes and verify RED in GitHub Actions**

Expected failure: `orientation.ts` and `GameOrientationNotice.tsx` do not exist.

- [ ] **Step 4: Implement the pure orientation functions**

Use equal width/height as landscape to avoid flip-flopping around a square viewport. Guidance is allowed when the pointer is coarse or the smaller viewport dimension is at most 540px; require an actual orientation mismatch.

```ts
import type { GameOrientation } from '../catalog/gameTypes'

export type ViewportOrientation = 'portrait' | 'landscape'

export function getViewportOrientation(width: number, height: number): ViewportOrientation {
  return height > width ? 'portrait' : 'landscape'
}

export function shouldSuggestOrientation(
  required: GameOrientation,
  width: number,
  height: number,
  coarsePointer: boolean,
): boolean {
  if (required === 'either') return false

  const current = getViewportOrientation(width, height)
  const handheld = coarsePointer || Math.min(width, height) <= 540

  return handheld && current !== required
}
```

- [ ] **Step 5: Implement `GameOrientationNotice`**

The component must initialize from `window.innerWidth`/`window.innerHeight`, read `(pointer: coarse)` safely, subscribe only to `resize`, and clean the listener on unmount. It should render a compact advisory with a `RotateCcw` icon, title-specific copy, and a `Play anyway` button. Do not persist dismissal to storage.

- [ ] **Step 6: Style the notice for safe-area-aware mobile overlay use**

Keep the component lightweight: opaque enough for readable text, no animated backdrop, one border/shadow, and no continuous motion. Include a reduced-motion rule if any transition is used.

- [ ] **Step 7: Verify GREEN**

Require the new orientation suites and the full repository gate to pass before Task 2.

---

### Task 2: Create the shared `GamePageShell` and immersive mobile layout

**Files:**
- Create: `src/games/shared/GamePageShell.tsx`
- Create: `src/games/shared/GamePageShell.css`
- Create: `src/games/shared/GamePageShell.test.tsx`
- Modify: `src/shell/shell.css`

**Interfaces:**
- Consumes: `GameDefinition`.
- Consumes: `GameOrientationNotice` from Task 1.
- Produces: `GamePageShell({ game, children })`.
- The shell renders one route-level title, category metadata, a Back-to-Games link, a runtime stage, and orientation guidance.

- [ ] **Step 1: Write failing `GamePageShell` tests**

Verify one Back-to-Games link, one visible game title, category metadata, `data-orientation` from catalog metadata, and a runtime slot containing passed children.

```tsx
it('renders one compact route shell around the game runtime', () => {
  render(
    <MemoryRouter>
      <GamePageShell game={gameCatalog[2]!}>
        <div data-testid="runtime">Runtime</div>
      </GamePageShell>
    </MemoryRouter>,
  )

  const shell = screen.getByTestId('game-page-shell')
  expect(shell).toHaveAttribute('data-orientation', 'landscape')
  expect(screen.getByRole('link', { name: 'Back to Games' })).toHaveAttribute('href', '/games')
  expect(screen.getByRole('heading', { level: 1, name: 'Neon Drift' })).toBeInTheDocument()
  expect(screen.getByText('Arcade survival')).toBeInTheDocument()
  expect(screen.getByTestId('runtime')).toBeInTheDocument()
})
```

- [ ] **Step 2: Verify RED**

Expected failure: `GamePageShell` does not exist.

- [ ] **Step 3: Implement the shell**

Use explicit product markup rather than generic layout props:

```text
main.game-page-shell
├─ div.game-page-shell__chrome
│  ├─ Back to Games
│  └─ title + category
└─ div.game-page-shell__stage
   ├─ div.game-page-shell__runtime
   │  └─ children
   └─ GameOrientationNotice
```

Keep the chrome outside the runtime node so game implementation cannot accidentally own site navigation.

- [ ] **Step 4: Implement responsive shell CSS**

Desktop:
- keep existing global header;
- center a wide stage with restrained frame/border;
- allow the viewport to remain aspect-ratio-driven;
- preserve ordinary page scrolling if a game has supplemental content.

Mobile (`max-width: 720px`):
- hide the global `.app-header` and bottom navigation on exact game routes;
- set `.app-shell[data-game-route='true']` and its content to `height: 100dvh; overflow: hidden`;
- make `GamePageShell` fill `100dvh`;
- place compact chrome over the top safe area rather than consuming a large page header;
- give the stage the remaining space;
- remove decorative outer borders/radii;
- keep Back-to-Games at least 44px high.

- [ ] **Step 5: Add shell regression tests for route mode**

Extend `AppShell.test.tsx` only if required to assert the global header remains in DOM for desktop semantics while CSS route mode uses `data-game-route="true"`. Do not add viewport-width implementation tests that merely duplicate CSS.

- [ ] **Step 6: Verify GREEN**

Require full CI pass.

---

### Task 3: Evolve `GameViewport` for focus, fullscreen resilience, and future input mounting

**Files:**
- Modify: `src/games/shared/GameViewport.tsx`
- Modify: `src/games/shared/GameViewport.test.tsx`
- Create: `src/games/shared/GameViewport.css`
- Modify: `src/App.css`

**Interfaces:**
- Existing props remain compatible: `children`, `game`, `label`, `ref`.
- Adds optional `inputOverlay?: ReactNode`.
- The input overlay renders in `.game-viewport__input-overlay` after runtime children and before the fullscreen affordance.
- Pointer interaction with the viewport focuses it with `{ preventScroll: true }` unless the interaction target is an interactive form/control element.
- Fullscreen rejection must not throw an unhandled promise; the viewport remains usable and focused.

- [ ] **Step 1: Extend tests first**

Add tests that verify:

```tsx
it('exposes a dedicated future input-overlay mount point', () => {
  render(
    <GameViewport
      game="neon-drift"
      inputOverlay={<button type="button">Boost</button>}
      label="Neon Drift game"
    >
      <canvas />
    </GameViewport>,
  )

  expect(screen.getByTestId('game-input-overlay')).toContainElement(
    screen.getByRole('button', { name: 'Boost' }),
  )
})
```

Also test clicking/tapping a non-interactive runtime child focuses the viewport, while clicking the fullscreen button still focuses and performs the fullscreen action. Add a rejection test where `requestFullscreen` rejects and assert the interaction resolves without an unhandled test failure.

- [ ] **Step 2: Verify RED**

Expected failure: `inputOverlay` and the input-layer test ID do not exist.

- [ ] **Step 3: Implement focus behavior**

Use one helper that recognizes `button`, `a`, `input`, `select`, `textarea`, and `[contenteditable="true"]` as interactive descendants. On `pointerdown`, focus the viewport only when the target is not inside one of those elements.

- [ ] **Step 4: Implement the input-overlay mount point**

Render it only when provided. The wrapper itself defaults to `pointer-events: none`; future shared controls may opt their actionable descendants into pointer events. Do not create any touch-control semantics in this PR.

- [ ] **Step 5: Harden fullscreen behavior**

Wrap `requestFullscreen`/`exitFullscreen` calls in `try/catch`; always refocus the viewport after the attempt. Preserve the current `fullscreenchange` resize dispatch so existing runtimes continue to recalculate dimensions.

- [ ] **Step 6: Move viewport styling out of `App.css`**

Create `GameViewport.css` and import it directly from `GameViewport.tsx`. Keep only unrelated shared game CSS in `App.css`. Mobile rules under `.game-page-shell` should allow `.game-viewport` to fill its stage (`height: 100%; min-height: 0; aspect-ratio: auto; border: 0; border-radius: 0`) while the desktop default remains the current framed 16:9 presentation.

- [ ] **Step 7: Verify GREEN**

Require full CI pass.

---

### Task 4: Make catalog routes own shared loading/error states and remove duplicated page chrome

**Files:**
- Create: `src/games/shared/GameRuntimeErrorBoundary.tsx`
- Create: `src/games/shared/GameRuntimeErrorBoundary.test.tsx`
- Create: `src/games/shared/GameRouteLoading.tsx`
- Create: `src/games/shared/GameRouteLoading.css`
- Modify: `src/games/catalog/gameRoutes.tsx`
- Modify: `src/games/catalog/gameRoutes.test.tsx`
- Modify: `src/games/bit-planes/BitPlanesPage.tsx`
- Modify: `src/games/donut-run/DonutRunPage.tsx`
- Modify: `src/games/neon-drift/NeonDriftPage.tsx`
- Modify: `src/games/worm-battles/WormBattlesPage.tsx`
- Modify: `src/games/warrior/WarriorPage.tsx`
- Modify: `src/games/warrior2/WarriorPage.tsx`

**Interfaces:**
- `GameRouteLoading({ game })` renders a stage-preserving status inside the shared shell.
- `GameRuntimeErrorBoundary({ game, children })` catches lazy/runtime render errors and renders recovery actions inside the existing `GamePageShell`: `Try again` resets the boundary; `Back to Games` routes to `/games`.
- `gameRouteEntries` wraps every lazy page exactly once as `GamePageShell -> GameRuntimeErrorBoundary -> Suspense -> GamePage`.
- The six `*Page.tsx` modules no longer render generic site `Page`, `PageHeader`, or route-level `H1`; they return only their existing runtime component.

- [ ] **Step 1: Write error-boundary tests**

Use a component that throws during render. Verify the boundary shows `Something interrupted <title>.`, exposes a `Try again` button and a Back-to-Games link, and does not remove outer shell content.

- [ ] **Step 2: Update game-route tests before implementation**

Assert each `gameRouteEntries` element is backed by catalog metadata and route application tests resolve one `game-page-shell` for Plane Blaster and Neon Drift. Preserve the lightweight lazy loading expectation.

- [ ] **Step 3: Verify RED**

Expected failures: shared shell/error/loading components are not connected to routes and current game page modules still render old route chrome.

- [ ] **Step 4: Implement `GameRouteLoading`**

Render a fixed aspect-ratio/fill-safe placeholder with the game's title and a simple pulse that is disabled under reduced-motion. Reuse shell tokens and do not load artwork/runtime assets.

- [ ] **Step 5: Implement `GameRuntimeErrorBoundary`**

Use a small class error boundary because React render errors still require that pattern. Reset only its own `hasError` state; do not mutate global state or reload the whole site. `Try again` should re-render children in place; returning to Games must always remain available.

- [ ] **Step 6: Wrap every route in `gameRoutes.tsx`**

For each catalog item:

```tsx
const GamePage = lazy(game.loadPage)

element: (
  <GamePageShell game={game}>
    <GameRuntimeErrorBoundary game={game}>
      <Suspense fallback={<GameRouteLoading game={game} />}>
        <GamePage />
      </Suspense>
    </GameRuntimeErrorBoundary>
  </GamePageShell>
)
```

- [ ] **Step 7: Strip duplicated site chrome from all six page adapters**

Each page becomes this shape, using its existing runtime component and no new props:

```tsx
import NeonDriftGame from './NeonDriftGame'

function NeonDriftPage() {
  return <NeonDriftGame />
}

export default NeonDriftPage
```

Repeat the explicit equivalent for Plane Blaster, Donut Run, Worm Battles, Warrior, and Warrior2. Do not edit the runtime component files in this task.

- [ ] **Step 8: Verify GREEN**

Require all route/application tests plus full CI.

---

### Task 5: Route-level regression, accessibility, performance, and PR packaging

**Files:**
- Modify: `src/App.test.tsx`
- Modify production files only if verification finds a concrete defect.

**Interfaces:**
- No new public interface unless a verified defect requires one.

- [ ] **Step 1: Expand application regression coverage**

Verify:
- `/games/plane-blaster` eventually renders exactly one `game-page-shell`, one H1 `Plane Blaster`, and the existing `data-game="bit-planes"` viewport;
- `/games/neon-drift` does the same for Neon Drift;
- game route shells expose Back-to-Games;
- `/games` remains a discovery route, not an immersive route;
- Chat and legacy redirect tests remain unchanged.

- [ ] **Step 2: Audit the complete diff against the stacked base**

Require that no simulation/scene/loop files changed. Expected runtime component files such as `BitPlanesGame.tsx`, `NeonDriftGame.tsx`, `Warrior.tsx`, and equivalent mechanics files must be absent from the diff.

- [ ] **Step 3: Verify architecture constraints**

Confirm:
- one route wrapper applies `GamePageShell` to every catalog game;
- no `*Page.tsx` duplicates `Page/PageHeader/H1` site chrome;
- `GamePageShell` does not import a specific runtime;
- `GameViewport` does not import catalog or app navigation;
- orientation behavior reads catalog metadata but is otherwise game-agnostic;
- the input-overlay mount point has no game-specific action vocabulary;
- Home/Games remain lazy with respect to game runtimes;
- no package dependency changed.

- [ ] **Step 4: Verify final GitHub Actions head**

Require:

```bash
npm test
npm run lint
npm run build
```

All must pass on the exact head used to open the PR.

- [ ] **Step 5: Open the stacked PR**

Base the PR on `feature/2027-arcade-shell-discovery` while PR #7 remains open. Document that manual validation is still required on real devices for:
- iPhone portrait orientation notice and dismiss behavior;
- iPhone landscape full-bleed/safe areas;
- Android portrait/landscape parity;
- desktop framed presentation;
- browser Back and in-shell Back-to-Games behavior;
- fullscreen enter/exit;
- keyboard focus after clicking the game surface;
- rotation/resize while a game is active;
- no accidental body scroll during mobile gameplay;
- all six existing games still play exactly as before;
- frame stability on a lower-powered device.

The PR description must also state that the semantic touch-control foundation remains intentionally deferred to the next slice.