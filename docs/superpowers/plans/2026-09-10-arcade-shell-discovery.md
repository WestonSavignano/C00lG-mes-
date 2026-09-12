# Cool Games Plus Arcade Shell + Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first code slice of the 2027 mobile-first arcade redesign: one typed game catalog, lazy game routing, an app shell with desktop/mobile navigation, and visual Home/Games discovery without changing game mechanics.

**Architecture:** The catalog becomes the single source of truth for game identity, route, discovery metadata, artwork treatment, and lazy page loading. The application shell owns global chrome and route-mode presentation; discovery components consume catalog data but do not own ordering or persistence rules; game runtimes remain isolated under their existing folders. Product-level components are preferred over generic prop-heavy layout abstractions.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Lucide React, CSS, Vitest, Testing Library, Vite 8.

**Spec:** `docs/superpowers/specs/2026-09-10-mobile-first-arcade-shell-design.md`

## Global Constraints

- Preserve all current game mechanics and current Chat behavior.
- Do not load Phaser or individual game runtime modules on Home or Games routes.
- Mobile navigation uses Home, Games, and Party; Party points to the existing `/chat` route.
- Mobile primary navigation uses a persistent bottom bar and respects `env(safe-area-inset-bottom)`.
- Game routes hide mobile bottom navigation so game space remains dominant.
- Desktop uses compact top navigation driven by the same navigation model as mobile.
- The game catalog is authoritative for game discovery metadata and game-route registration.
- Do not introduce a global state-management dependency.
- Recent-game persistence uses local storage and fails safely when storage is unavailable or invalid.
- Shell/discovery animation must respect `prefers-reduced-motion` and avoid continuous expensive effects.
- Keep existing CSS variables used by current Chat/game pages as compatibility aliases while introducing clearer shell tokens.
- Preserve repository validation: `npm test`, `npm run lint`, and `npm run build`.

---

### Task 1: Typed game catalog and lazy route registration

**Files:**
- Create: `src/games/catalog/gameTypes.ts`
- Create: `src/games/catalog/gameCatalog.ts`
- Create: `src/games/catalog/gameRoutes.tsx`
- Create: `src/games/catalog/gameCatalog.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces: `GameDefinition`, `GameArtworkTheme`, `GameInput`, `gameCatalog`, `featuredGame`, `getGameByRoute(pathname)`, `gameRouteEntries`.
- `GameDefinition.loadPage` has type `() => Promise<{ default: ComponentType }>`.
- `gameRouteEntries` contains `{ game: GameDefinition; element: ReactNode }` entries whose page component is React-lazy loaded.

- [ ] **Step 1: Write failing catalog tests**

Create `src/games/catalog/gameCatalog.test.ts` with tests that assert all six current games are registered once, IDs/routes are unique, `/games/plane-blaster` has no trailing whitespace, Neon Drift is the single featured title, and `getGameByRoute('/games/neon-drift')` resolves the expected game.

```ts
import { describe, expect, it } from 'vitest'
import { featuredGame, gameCatalog, getGameByRoute } from './gameCatalog'

describe('game catalog', () => {
  it('registers each current game exactly once with unique ids and routes', () => {
    expect(gameCatalog).toHaveLength(6)
    expect(new Set(gameCatalog.map((game) => game.id)).size).toBe(gameCatalog.length)
    expect(new Set(gameCatalog.map((game) => game.route)).size).toBe(gameCatalog.length)
    expect(gameCatalog.every((game) => game.route === game.route.trim())).toBe(true)
  })

  it('defines one featured game and resolves games by route', () => {
    expect(featuredGame.title).toBe('Neon Drift')
    expect(getGameByRoute('/games/neon-drift')?.id).toBe('neon-drift')
    expect(getGameByRoute('/games/not-real')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Update App route tests to expect catalog-driven lazy game routes**

Keep existing canonical Chat and legacy redirects, but make game-route assertions asynchronous with `findByRole`/`findByTestId` because game pages are lazy-loaded.

```ts
it('renders Neon Drift from the catalog-backed game routes', async () => {
  renderRoute('/games/neon-drift')

  expect(await screen.findByRole('heading', { level: 1, name: 'Neon Drift' }))
    .toBeInTheDocument()
  expect(await screen.findByTestId('game-viewport')).toHaveAttribute(
    'data-game',
    'neon-drift',
  )
})
```

- [ ] **Step 3: Push test-only changes and verify RED in GitHub Actions**

Expected failure: catalog module imports do not exist and App tests still reflect old route ownership.

- [ ] **Step 4: Implement `GameDefinition` and catalog data**

Use this shape:

```ts
import type { ComponentType } from 'react'

export type GameInput = 'touch' | 'keyboard' | 'mouse' | 'gamepad'
export type GameOrientation = 'portrait' | 'landscape' | 'either'
export type GameArtworkTheme =
  | 'sky'
  | 'candy'
  | 'neon'
  | 'arena'
  | 'forest'
  | 'shadow'

export type GameDefinition = {
  id: string
  route: `/games/${string}`
  title: string
  shortDescription: string
  category: string
  featured?: boolean
  new?: boolean
  multiplayer?: boolean
  orientation: GameOrientation
  inputs: GameInput[]
  artwork: { theme: GameArtworkTheme; label: string }
  loadPage: () => Promise<{ default: ComponentType }>
}
```

Register the six current games and load each page with a dynamic import. Set Neon Drift as the featured game. Use categories/descriptions already consistent with the current product rather than introducing a taxonomy system.

- [ ] **Step 5: Implement lazy route entries**

At module scope, create a lazy component per catalog item and wrap it in a lightweight `Suspense` fallback so Home/Games do not import game modules.

- [ ] **Step 6: Replace explicit game imports/routes in `App.tsx`**

`App.tsx` may map `gameRouteEntries` inside `<Routes>`, but it must no longer import the six game pages directly.

- [ ] **Step 7: Verify GREEN**

Run CI and require tests, lint, and build to pass before Task 2.

---

### Task 2: Global app shell and shared navigation model

**Files:**
- Create: `src/shell/navigation.ts`
- Create: `src/shell/AppShell.tsx`
- Create: `src/shell/DesktopHeader.tsx`
- Create: `src/shell/MobileBottomNavigation.tsx`
- Create: `src/shell/shell.css`
- Create: `src/shell/AppShell.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Delete after replacement: `src/components/HeaderNav.tsx`

**Interfaces:**
- Produces: `primaryNavigationItems` with Home `/`, Games `/games`, Party `/chat`.
- Produces: `AppShell({ children })` which sets `data-game-route` based on `getGameByRoute(location.pathname)`.
- Desktop and mobile nav both consume `primaryNavigationItems`; they must not define their own destination arrays.

- [ ] **Step 1: Write failing AppShell tests**

Render `AppShell` under a `MemoryRouter` and verify:

```ts
it('renders the same Home, Games, and Party destinations in desktop and mobile navigation', () => {
  renderShell('/')

  const desktop = screen.getByRole('navigation', { name: 'Primary' })
  const mobile = screen.getByRole('navigation', { name: 'Mobile primary' })

  for (const name of ['Home', 'Games', 'Party']) {
    expect(within(desktop).getByRole('link', { name })).toBeInTheDocument()
    expect(within(mobile).getByRole('link', { name })).toBeInTheDocument()
  }
})
```

Also verify a game route sets `data-game-route="true"` on the shell while `/games` does not.

- [ ] **Step 2: Push tests and verify RED**

Expected failure: `src/shell/AppShell` does not exist.

- [ ] **Step 3: Implement shared navigation model**

`navigation.ts` contains only one array. Icons may be stored as Lucide component references so both presentations use the same semantic model.

- [ ] **Step 4: Implement desktop header and mobile bottom navigation**

Desktop: brand + text navigation. Mobile: icon + label bottom tabs. Active state must use both `aria-current` from `NavLink` and a visible non-color affordance in CSS.

- [ ] **Step 5: Implement AppShell route mode**

Use `useLocation()` plus `getGameByRoute()` to identify exact game routes. Render desktop header globally; render mobile bottom navigation globally but hide it at mobile widths on exact game routes.

- [ ] **Step 6: Replace old HeaderNav usage in App**

Wrap all routes inside `AppShell`. Remove the hamburger implementation rather than leaving two competing mobile navigation systems.

- [ ] **Step 7: Establish shell tokens in `index.css`**

Default to the approved dark graphite/navy foundation and introduce semantic variables, while preserving current aliases:

```css
:root {
  color-scheme: dark;
  --color-bg: #060914;
  --color-surface: #0e1524;
  --color-surface-raised: #151f31;
  --color-text: #b9c5d6;
  --color-text-strong: #f7fbff;
  --color-muted: #77859a;
  --color-accent: #5eead4;
  --color-accent-strong: #2dd4bf;
  --color-border: rgba(148, 163, 184, 0.18);

  --bg: var(--color-bg);
  --surface: var(--color-surface);
  --text: var(--color-text);
  --text-h: var(--color-text-strong);
  --accent: var(--color-accent);
  --border: var(--color-border);
}
```

Keep `--link` and `--shadow` compatibility values for existing components.

- [ ] **Step 8: Verify GREEN**

Require full CI pass.

---

### Task 3: Discovery components and recent-game persistence

**Files:**
- Create: `src/games/discovery/GameArtwork.tsx`
- Create: `src/games/discovery/GameTile.tsx`
- Create: `src/games/discovery/GameGrid.tsx`
- Create: `src/games/discovery/GameRail.tsx`
- Create: `src/games/discovery/FeaturedGame.tsx`
- Create: `src/games/discovery/PartyCallout.tsx`
- Create: `src/games/discovery/recentGames.ts`
- Create: `src/games/discovery/RecentGameTracker.tsx`
- Create: `src/games/discovery/discovery.css`
- Create: `src/games/discovery/recentGames.test.ts`
- Create: `src/games/discovery/GameTile.test.tsx`

**Interfaces:**
- `GameTile({ game })`, `FeaturedGame({ game })`, `GameGrid({ games })`, `GameRail({ title, games })` accept catalog definitions and remain presentation-only.
- `recordRecentGame(gameId: string)`, `readRecentGameIds(): string[]`, and `resolveRecentGames(): GameDefinition[]` own local-storage behavior.
- `RecentGameTracker` observes the current exact game route and records its stable catalog ID.

- [ ] **Step 1: Write failing persistence tests**

Test most-recent-first ordering, deduplication, a bounded maximum of four IDs, corrupt JSON fallback, and unavailable storage fallback.

```ts
it('moves a replayed game to the front without duplicating it', () => {
  recordRecentGame('warrior')
  recordRecentGame('neon-drift')
  recordRecentGame('warrior')

  expect(readRecentGameIds()).toEqual(['warrior', 'neon-drift'])
})
```

- [ ] **Step 2: Write failing tile semantics test**

Verify the full tile is one link, contains the game title/category, has no redundant `Open <game>` action copy, and its artwork is hidden from assistive technology when the same title is already visible.

- [ ] **Step 3: Push tests and verify RED**

Expected failure: discovery modules do not exist.

- [ ] **Step 4: Implement storage adapter**

Use a single key such as `coolgames.recent-games.v1`, `try/catch` all browser storage access, validate parsed values as strings, deduplicate, and cap at four.

- [ ] **Step 5: Implement `GameArtwork` with lightweight CSS art treatments**

Use the catalog `artwork.theme` to render static layered CSS art with no downloaded image requirement and no animation loop. Themes must remain swappable for real screenshots/cover images later without changing `GameTile` or `FeaturedGame` APIs.

- [ ] **Step 6: Implement tile/grid/rail/featured/party components**

Keep each component narrow. `GameGrid` and `GameRail` receive preselected games; they do not decide featured/recent ordering.

- [ ] **Step 7: Implement RecentGameTracker**

Use `useLocation()` and `getGameByRoute()`. Record only exact catalog game routes. Do not record `/games` itself.

- [ ] **Step 8: Verify GREEN**

Require full CI pass.

---

### Task 4: Redesign Home and Games around the catalog

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/GamesPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Home consumes `featuredGame`, `gameCatalog`, and `resolveRecentGames()`.
- Games consumes only `gameCatalog` plus discovery components.
- `RecentGameTracker` mounts once at app-shell level.

- [ ] **Step 1: Rewrite App tests first for the desired product experience**

Home test must assert:

```ts
expect(screen.getByRole('heading', { level: 1, name: /Pick a game/i })).toBeInTheDocument()
expect(screen.getByRole('link', { name: /Play Neon Drift/i })).toHaveAttribute(
  'href',
  '/games/neon-drift',
)
expect(screen.getByRole('link', { name: /Start a party/i })).toHaveAttribute(
  'href',
  '/chat',
)
```

Games test must assert six `game-tile` elements and the expected clean Plane Blaster URL.

Add a recent-game test by seeding `localStorage` before rendering Home and verifying the Continue Playing rail resolves IDs through the catalog.

- [ ] **Step 2: Push tests and verify RED**

Expected failure: old hero/card UI does not match the new discovery contract.

- [ ] **Step 3: Implement new Home composition**

Use this structure:

```text
main.arcade-home
├─ intro/brand microcopy
├─ FeaturedGame
├─ Continue Playing (conditional GameRail)
├─ PartyCallout
└─ GameGrid
```

The first viewport should prioritize the featured game over explanatory copy.

- [ ] **Step 4: Implement new Games page**

Use a concise page heading and `GameGrid`. Remove generic `Card`, `CardLabel`, `CardAction`, and per-game duplicated metadata from this page.

- [ ] **Step 5: Mount RecentGameTracker once**

The tracker must live outside individual tiles/pages so direct deep links are recorded too.

- [ ] **Step 6: Refine responsive CSS**

Requirements:

- two-column game grid on ordinary phones;
- single-column fallback for very narrow screens;
- responsive 3–6 column expansion on larger screens using CSS Grid/minmax;
- featured card has a strong 16:9-ish visual area without forcing the whole page to 16:9;
- mobile body gets bottom padding for navigation safe area on non-game routes;
- game routes do not retain that bottom-nav reservation;
- hover motion only inside `@media (hover: hover) and (pointer: fine)`;
- reduced motion disables nonessential transitions/transforms;
- no continuous shell animation.

- [ ] **Step 7: Remove obsolete home hero/card shell styles only when no longer used**

Do not delete generic `Card`, `Hero`, or `Section` primitives if Chat or another current page still imports them. Remove only dead imports/usages created by this change.

- [ ] **Step 8: Verify GREEN with the full repository gate**

Require:

```bash
npm test
npm run lint
npm run build
```

All three must pass in GitHub Actions.

---

### Task 5: PR-level verification and review package

**Files:**
- No new production behavior unless verification finds a defect.

- [ ] **Step 1: Inspect the complete PR diff for scope**

Confirm the implementation does not alter game simulation/mechanics, networking, server coordination, or Chat behavior.

- [ ] **Step 2: Verify architecture constraints**

Confirm:

- `App.tsx` has no direct imports of individual game pages;
- one navigation model feeds desktop and mobile navigation;
- `GamesPage` does not hard-code six game cards;
- discovery components do not own catalog selection rules;
- no game runtime imports exist in Home/Games discovery modules;
- no new dependency was added;
- the Plane Blaster trailing-space route defect is eliminated.

- [ ] **Step 3: Verify CI on the final head commit**

Require all test/lint/build checks green.

- [ ] **Step 4: Open a focused implementation PR**

Base it on the approved design branch while PR #5 is still open, or retarget to `main` once PR #5 lands. The PR description must call out visual review items that require local/browser testing: phone safe areas, touch scrolling around rails, game-route chrome, and low-end animation smoothness.
