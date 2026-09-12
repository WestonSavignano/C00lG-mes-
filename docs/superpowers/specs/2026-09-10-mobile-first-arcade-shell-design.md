# Cool Games Plus Mobile-First Arcade Shell Design

Date: 2026-09-10
Status: Direction approved in chat; pending written-spec review

## Goal

Evolve Cool Games Plus from a clean website that contains browser games into a first-class, mobile-first gaming destination that feels intentional on phones, scales naturally to desktop, and remains fast on older hardware.

The product target is a **premium boutique arcade** rather than a large portal clone: a small, curated catalog where the games provide most of the visual energy and the site shell makes discovery, launch, replay, and multiplayer entry effortless.

The redesign must improve product quality and engineering quality together. The site should be easy for a player to navigate and equally easy for an engineer or AI agent to reason about, extend, test, and review.

The core architectural principle is:

> **Prefer explicit product-level composition over either duplicated page code or overly generic UI abstractions.**

A future contributor should be able to open the component tree and recognize Cool Games Plus concepts such as `AppShell`, `GameTile`, `GameRail`, `GamePageShell`, and `GameViewport` without tracing styling props through layers of generic wrappers.

## Current state

The current application already has several useful foundations:

- React, TypeScript, Vite, and Phaser are established and should remain the platform foundation.
- `HeaderNav` provides responsive global navigation.
- `Page`, `Section`, `Card`, and typography components provide basic composition primitives.
- `GameViewport` centralizes game framing and fullscreen behavior.
- `src/games/shared` provides a natural home for reusable game infrastructure.
- Chat and WebRTC room work provide a future multiplayer/party foundation.
- Repository validation already includes tests, lint, TypeScript/build, and GitHub Actions.

The current product experience is still website-shaped:

- Home is dominated by a marketing-style hero and two section links.
- Games are represented as text-heavy generic cards.
- Mobile navigation hides primary destinations behind a hamburger.
- Game pages retain ordinary page chrome above the game surface.
- Game metadata and routes are manually repeated in multiple files.
- Mobile game controls are not yet a shared first-class capability.

This design preserves the good infrastructure and changes the product hierarchy around it.

## Product principles

### 1. Game first

The shortest meaningful path from arrival to gameplay should dominate the design.

A player should not need to read an explanation of the site before choosing a game. Home should immediately expose a featured game and visually scannable catalog content.

### 2. Mobile first, not mobile compatible

Phone layout, touch reach, safe areas, orientation, browser chrome, interruption/resume behavior, and thumb controls are primary design constraints.

Desktop should expand the same information architecture rather than define it.

### 3. The shell supports the games instead of competing with them

The shell uses a restrained dark foundation, strong typography, a small brand accent system, and limited atmospheric motion. Individual games provide the color, art, and personality.

### 4. Fast by default

Visual polish must scale down gracefully. The shell should never require expensive continuous effects to feel premium.

Game code and heavy assets should load only when needed. Animated previews should be intent-driven rather than all running simultaneously.

### 5. Composition over duplication

Pages are assembled from product concepts with narrow responsibilities. Shared behavior is centralized where it is genuinely shared.

Do not copy game metadata, game launch chrome, responsive rules, or navigation logic across pages.

### 6. DRY without abstraction for abstraction's sake

Avoid both extremes:

- duplicated JSX/CSS for each game or page;
- highly generic components that accept large sets of layout/style props and make the product hierarchy difficult to read.

A reusable component should represent a stable concept or repeated behavior, not merely save a few lines.

### 7. Progressive enhancement

Features such as View Transitions, hover motion, fullscreen, installation, and richer effects should improve capable browsers without becoming requirements for navigation or gameplay.

## Information architecture

The initial top-level destinations are intentionally small:

- **Home** — immediate discovery and return-to-play surface.
- **Games** — complete visual catalog.
- **Party** — social/multiplayer entry point. In the first iteration this routes to the existing Chat room experience while creating a durable place for future multiplayer lobby functionality.

Do not add accounts, stores, achievements, feeds, virtual currency, or other platform systems as part of this redesign.

### Mobile navigation

Use a persistent bottom navigation bar for Home, Games, and Party.

Requirements:

- respect `env(safe-area-inset-bottom)`;
- minimum 44px interactive targets, with 48px preferred for primary mobile navigation;
- active destination must be clear without relying on color alone;
- game-play mode may hide or collapse the bottom bar to maximize usable play area;
- route changes remain normal browser navigation and deep links continue to work.

### Desktop navigation

Use a compact top shell with brand identity and the same destinations. Do not duplicate destination definitions between mobile and desktop navigation; both consume one navigation model.

## Home experience

Home becomes a discovery surface rather than a marketing hero.

Recommended composition:

```text
HomePage
└─ ArcadeHome
   ├─ FeaturedGame
   ├─ ContinuePlayingRail       // rendered only when history exists
   ├─ PartyCallout
   ├─ GameRail                  // featured/new/curated games
   └─ GameGrid                  // broader catalog entry
```

### Featured game

The first viewport should make one game immediately playable.

The feature includes:

- artwork or a performant art treatment;
- game title;
- very short metadata/category line;
- optional one-line description where space permits;
- one unmistakable **Play** action;
- restrained ambient motion only when it can be delivered cheaply and disabled by reduced-motion preferences.

The entire feature should not become a complex carousel in the first implementation. One deterministic featured game is simpler, faster, and easier to evaluate.

### Continue playing

Persist a small recent-game history in local storage. This is convenience state, not an account system.

Store only stable game IDs and timestamps. If storage is blocked or corrupt, discovery remains fully usable.

The rail is omitted when there is no history rather than displaying an empty state.

### Party callout

Expose the social capability as part of the gaming experience instead of treating Chat as an unrelated utility.

For the first shell, Party can route to the existing `/chat` flow. The naming and composition should allow future room/lobby/multiplayer functionality to live here without restructuring global navigation.

## Games catalog experience

Replace generic text cards with game-specific visual tiles.

### Mobile

Use a dense two-column grid for ordinary tiles with occasional full-width or larger featured treatment when explicitly configured by catalog metadata.

### Desktop

Scale into a responsive multi-column grid. Do not hard-code a fixed six-column assumption; use CSS grid/minmax/container constraints so the layout adapts naturally.

### Game tile anatomy

A normal tile contains only what is useful during scanning:

- cover/art treatment;
- title;
- concise category/status metadata;
- optional multiplayer or new/featured badge.

The full tile is interactive. Avoid redundant `Open <game>` copy.

Hover effects are desktop enhancements. Touch devices must not depend on hover for information or actions.

## Single source of truth: game catalog

Introduce a typed game catalog as the authoritative product registry for browser games.

Recommended location:

```text
src/games/catalog/
├─ gameCatalog.ts
├─ gameTypes.ts
└─ gameRoutes.tsx
```

A game definition should conceptually contain:

```ts
type GameDefinition = {
  id: string
  route: `/games/${string}`
  title: string
  shortDescription: string
  category: GameCategory
  featured?: boolean
  new?: boolean
  multiplayer?: boolean
  orientation: 'portrait' | 'landscape' | 'either'
  inputs: Array<'touch' | 'keyboard' | 'mouse' | 'gamepad'>
  artwork: GameArtwork
  loadPage: () => Promise<{ default: ComponentType }>
}
```

Exact naming may change during implementation, but the responsibilities should not.

### Catalog responsibilities

The catalog supplies:

- `/games` discovery content;
- home featured/curated content;
- recent-game ID resolution;
- game-route generation;
- UI badges/input/orientation metadata;
- future search/category filtering.

### Route loading

Each game page should be lazy-loaded through its catalog definition so visiting Home or Games does not eagerly evaluate every game runtime.

Do not import game implementation code into visual catalog components.

Route generation should eliminate the current duplication where `App.tsx` and `GamesPage.tsx` each know the complete game list.

### Separation from runtime configuration

The product catalog describes a game to the shell. It must not become a dumping ground for game simulation constants or engine internals.

Game-specific runtime configuration stays with the game.

## Application component hierarchy

Recommended shell structure:

```text
App
└─ AppShell
   ├─ DesktopHeader
   │  ├─ BrandMark
   │  └─ PrimaryNavigation
   ├─ AppRouteOutlet
   │  ├─ HomePage
   │  ├─ GamesPage
   │  ├─ Party/ChatPage
   │  └─ GameRoute
   │     └─ GamePageShell
   │        ├─ GameChrome
   │        └─ GameViewport
   └─ MobileBottomNavigation
```

This hierarchy intentionally separates:

- **application shell** — navigation and global layout;
- **discovery UI** — choosing a game;
- **game page shell** — shared transition from site UI into play;
- **game viewport/runtime** — actual game rendering and interaction;
- **game-specific internals** — simulation, scenes, assets, mechanics.

A game should not know how global navigation works. Global navigation should not know how a game renders.

## Component boundaries

### `AppShell`

Owns global chrome, page background, safe-area behavior, and whether the current route is in immersive game mode.

It should not own game data beyond what is needed to recognize route mode.

### `PrimaryNavigation`

Consumes one shared navigation definition and renders accessible destinations.

Desktop and mobile presentations may differ, but destination data and active-route semantics are shared.

### `GameTile`

Pure discovery presentation for one `GameDefinition`. It does not read local storage or decide catalog ordering.

### `GameRail`

Layout/composition for a titled horizontal collection of games. It receives definitions as data.

It should not embed business rules such as which games are recent or featured.

### `GameGrid`

Responsive visual collection for a supplied set of games.

### `FeaturedGame`

A deliberately richer presentation than `GameTile`; do not make `GameTile` accept enough variants to impersonate every feature placement.

This is an example of preferring two clear concepts over one over-configurable component.

### `GamePageShell`

Shared site-level wrapper around all games.

Responsibilities:

- entry/exit chrome;
- game title/metadata when appropriate;
- immersive-mode transition;
- orientation guidance;
- shell-level loading/error boundary;
- future shared pause/settings affordances.

It should not implement individual game controls or simulation behavior.

### `GameViewport`

Continue evolving the existing shared viewport rather than replacing it.

Responsibilities:

- resize boundary;
- fullscreen handling;
- focus management;
- safe-area/full-bleed sizing;
- normalized lifecycle hooks needed by game runtimes;
- future shared input overlay mounting point.

### Layout primitives

Retain small generic primitives only where they genuinely improve consistency.

The redesign should avoid expanding the current pattern of components that expose arbitrary CSS layout values as props. Prefer product-level components with locally understandable CSS and a small number of semantic variants.

## Styling architecture

Introduce a compact token layer for shell-level consistency.

Recommended token groups:

- background/surface/elevated surface;
- text primary/secondary/muted;
- brand accent and accent-emphasis;
- border/divider;
- focus ring;
- spacing scale;
- radius scale;
- elevation/shadow scale;
- motion duration/easing;
- navigation and safe-area dimensions.

Do not create a large design-system framework in this phase.

### Visual direction

Use:

- dark graphite/navy foundation;
- bright artwork supplied by individual games;
- electric aqua primary brand accent;
- restrained secondary indigo/violet where useful;
- strong display typography for game titles;
- limited translucency and blur;
- subtle depth and lighting rather than constant neon glow.

Avoid:

- generic esports/neon-dashboard styling;
- blur-heavy glass on every surface;
- continuous background shaders;
- large decorative animation that consumes CPU/GPU while the user is simply browsing.

## Game play mode

Opening a game should shift the hierarchy from site-first to game-first.

### Mobile

The game surface should occupy essentially all usable space. Site chrome collapses to the minimum controls necessary to leave or manage the experience.

Requirements:

- safe-area aware;
- correct use of dynamic viewport units;
- no accidental body scrolling while actively interacting with the game surface;
- no browser gesture suppression outside the game/control regions where it is required;
- orientation guidance appears only for games that declare a meaningful orientation constraint;
- fullscreen remains progressive enhancement rather than the only path to a usable layout.

### Desktop

The game can remain framed inside the site initially, with an obvious path to immersive/fullscreen play. The design should allow the game surface to become visually dominant without making navigation confusing.

## Shared input direction

The first shell redesign should establish the mounting and metadata contracts for shared input, but each game does not need to be migrated to touch controls in the same PR.

Future shared input infrastructure belongs under `src/games/shared/input` and should support:

- Pointer Events as the default pointer/touch abstraction;
- virtual stick/directional controls;
- semantic action buttons;
- multi-touch when mechanics require it;
- keyboard/gamepad mappings where applicable;
- per-game declarative control layouts rather than copy-pasted DOM controls.

The API should expose **player intent** (`move`, `attack`, `boost`, `deploy`) rather than raw DOM key names wherever practical. That creates a durable boundary between game mechanics and input devices.

Do not force games with materially different interaction models into one giant universal control component.

## State and persistence

The shell may persist small convenience state locally:

- recently played game IDs/timestamps;
- optional last-used presentation preference when such a preference is introduced later.

Do not introduce an application state library for this work unless implementation evidence demonstrates a real need. React state/context plus small storage adapters are sufficient for the planned shell.

Persistence adapters should fail safely when browser storage is unavailable.

## Performance contract

Performance is a release requirement, not a later cleanup phase.

### Shell goals

- Keep initial shell JavaScript small enough that discovery does not require loading Phaser/game runtimes.
- Lazy-load each game route/runtime.
- Prefer static responsive cover artwork; animated previews only activate on explicit intent or a tightly bounded featured placement.
- Use AVIF/WebP where practical with appropriate fallbacks.
- Avoid unnecessary React re-renders in animation/game loops.
- Do not move frame-by-frame game state into React.
- Pause nonessential animation when the document is hidden.
- Respect `prefers-reduced-motion`.

### Experience targets

Use these as engineering targets rather than synthetic guarantees:

- shell interaction p75 INP target: <= 200 ms;
- game target: stable 60 FPS on capable hardware;
- degraded mode: stable >= 30 FPS is preferable to unstable 60 FPS;
- expensive canvas DPR should be capped or adapted where visual benefit no longer justifies render cost;
- no home/discovery animation should materially compete with an active game for CPU/GPU resources.

### Adaptive quality

Games may independently use quality tiers based on measured frame rate or device capability. Shared infrastructure may expose useful signals later, but this redesign should not centralize game rendering policy prematurely.

## Accessibility and input quality

The shell must remain fully navigable without a pointer.

Requirements:

- semantic links/buttons;
- visible focus treatment;
- minimum interactive target sizing;
- adequate text/background contrast;
- non-color active and status indicators where needed;
- meaningful image alternative treatment without duplicating nearby game titles;
- reduced-motion behavior;
- no hover-only actions;
- landscape/rotation instructions readable by assistive technology when shown.

Canvas games remain responsible for their own practical accessibility constraints, but the site shell should not introduce avoidable barriers.

## Loading and error behavior

### Discovery artwork

Reserve aspect-ratio space so images do not cause layout shifts. Failed artwork falls back to a branded game-specific treatment rather than broken-image UI.

### Game route loading

`GamePageShell` owns a consistent lightweight loading presentation while a lazy game bundle is fetched.

Loading UI should preserve the game's intended frame/viewport size so the page does not jump when the runtime appears.

### Runtime errors

A shell-level error boundary should allow the player to return to Games or retry loading without taking down global navigation.

Game runtime errors must remain isolated from unrelated routes.

## Motion and transitions

Use motion to clarify spatial relationships and state changes, not simply to decorate the interface.

Good candidates:

- subtle tile elevation/scale on hover-capable devices;
- selection/press feedback;
- featured artwork ambient motion with a static reduced-motion fallback;
- progressive-enhanced route transition from game artwork into game play;
- bottom-navigation active-state movement.

View Transitions may be added progressively where browser support and implementation simplicity justify them. Normal React Router navigation remains the fallback.

## PWA direction

The redesign should keep the shell compatible with an installable web-app experience, but installation prompts are not part of the first implementation.

Foundation expectations:

- valid web app manifest;
- quality icons/theme metadata;
- safe-area-aware standalone layout;
- no assumption that browser chrome is always present.

Offline game caching can be considered game by game later; do not add broad aggressive service-worker caching without a cache/versioning strategy.

## Repository organization

Target organization after the first implementation phases:

```text
src/
├─ app/
│  ├─ AppShell.tsx
│  ├─ AppShell.css
│  ├─ navigation.ts
│  └─ components/
│     ├─ BrandMark.tsx
│     ├─ DesktopHeader.tsx
│     └─ MobileBottomNavigation.tsx
├─ components/
│  └─ ...small genuinely generic primitives...
├─ games/
│  ├─ catalog/
│  │  ├─ gameTypes.ts
│  │  ├─ gameCatalog.ts
│  │  └─ gameRoutes.tsx
│  ├─ shared/
│  │  ├─ GamePageShell.tsx
│  │  ├─ GameViewport.tsx
│  │  └─ input/              // introduced when touch migration begins
│  ├─ warrior/
│  ├─ warrior2/
│  ├─ neon-drift/
│  └─ ...
├─ discovery/
│  ├─ FeaturedGame.tsx
│  ├─ GameGrid.tsx
│  ├─ GameRail.tsx
│  ├─ GameTile.tsx
│  └─ recentGames.ts
└─ pages/
   ├─ HomePage.tsx
   ├─ GamesPage.tsx
   └─ ChatPage.tsx
```

The exact folders may adjust during implementation if an existing boundary is cleaner, but maintain these conceptual layers.

### Dependency direction

Use this dependency direction:

```text
pages/app shell
    ↓
discovery + game page shell
    ↓
game catalog + shared game infrastructure
    ↓
game-specific runtimes
```

Game-specific runtimes must not import discovery UI or app navigation.

Shared game infrastructure must not import a specific game's implementation.

## Testing strategy

Automated checks remain necessary but are not sufficient.

### Unit/component tests

Cover at minimum:

- catalog IDs/routes are unique;
- generated routes correspond to catalog entries;
- featured/recent filtering is deterministic;
- invalid recent IDs are safely ignored;
- desktop/mobile navigation share destination semantics;
- active-navigation state is correct;
- game tiles expose accessible names/links;
- `GamePageShell` loading/error states preserve recovery paths;
- existing `GameViewport` fullscreen tests continue to pass and expand for new shell behavior.

### Route/application tests

Verify:

- every catalog game route renders through the shared game page shell;
- Home, Games, Party/Chat, and game deep links remain reachable;
- unknown routes still resolve to Not Found;
- adding a catalog entry does not require duplicate game-card registration.

### Manual validation

Each UI PR must be manually checked at representative sizes:

- small phone portrait;
- modern phone portrait;
- phone landscape;
- tablet;
- typical laptop;
- large desktop.

Gameplay-affecting PRs also require real-play validation for controls, focus, resize/orientation, fullscreen, pause/resume, and frame stability.

Do not accept visual snapshots alone as proof that a game feels good.

## Migration plan and PR boundaries

Implement the redesign as focused PRs rather than one large rewrite.

### PR 1 — Shell foundation and discovery

Primary scope:

- typed game catalog and route generation;
- new shell/token foundation;
- desktop header and mobile bottom navigation;
- redesigned Home discovery surface;
- redesigned Games catalog surface;
- recent-game persistence;
- Party destination mapped to current Chat;
- preserve existing game runtimes and behavior.

This is the first implementation PR after this spec is approved.

### PR 2 — Immersive game page shell

Primary scope:

- `GamePageShell` standardization;
- mobile full-bleed play hierarchy;
- orientation metadata behavior;
- route loading/error treatment;
- improved fullscreen/focus/safe-area behavior;
- preserve game-specific mechanics.

### PR 3 — Shared input foundation

Primary scope:

- semantic shared input model;
- touch controls and Pointer Events primitives;
- migrate one representative game first;
- validate ergonomics before broad rollout.

### PR 4+ — Game-by-game quality passes

Migrate each game independently for:

- touch/gamepad inputs where appropriate;
- HUD and onboarding;
- sound/feedback;
- visual polish;
- performance/adaptive quality;
- multiplayer integration where applicable.

### Later polish

Only after the fundamentals are validated:

- richer View Transitions;
- animated previews;
- PWA/offline enhancements;
- search/categories if catalog size justifies them.

## Alternatives considered

### A. Keep current site structure and restyle it

Lowest implementation cost, but it preserves the core problem: Cool Games Plus continues to feel like a website containing experiments rather than a gaming destination. It also leaves duplicated catalog/routing knowledge in place.

Rejected.

### B. Build a large generic design system first

Could maximize theoretical reuse, but would front-load abstraction and make it harder to understand which components represent real product concepts. The current product is small enough that this would be unnecessary architecture.

Rejected.

### C. Product-level composition over a small primitive layer

Build a compact shell/token foundation, then explicit components for stable arcade concepts. Centralize game metadata/routing and shared game behavior while leaving game-specific implementation isolated.

Selected.

This approach provides the best balance of DRYness, readability, performance, and long-term extensibility.

## Non-goals

This redesign does not introduce:

- user accounts or cloud profiles;
- achievements/XP;
- store or virtual currency;
- social feed;
- public matchmaking;
- new server persistence for game state;
- broad multiplayer conversion of existing games;
- mandatory service worker/offline gameplay;
- a large third-party UI/design-system dependency;
- a state-management library without demonstrated need;
- universal rendering abstractions that force Canvas and Phaser games into the same internal implementation.

## Success criteria

The redesign is successful when:

1. A new mobile visitor can identify and start a game from the first screen with minimal ceremony.
2. Home and Games feel like an arcade, not a documentation/catalog site.
3. Mobile primary navigation requires no hamburger interaction.
4. Existing games remain isolated and functional while the shell evolves around them.
5. Adding a new game requires one authoritative catalog registration plus the game's own implementation, not repeated edits across discovery and routing files.
6. Shared game page/viewport behavior lives in one place.
7. The component tree communicates product concepts clearly enough that a contributor can reason about the shell without tracing large generic configuration objects.
8. Initial discovery does not eagerly load all game runtimes.
9. Visual polish remains smooth on modest hardware and reduced-motion users receive an equally usable experience.
10. Test, lint, TypeScript/build, and relevant manual mobile/gameplay validation remain part of every delivery step.

## Decision summary

Cool Games Plus will evolve into a **mobile-first premium boutique arcade** using explicit, reusable product-level composition.

The architecture centers on:

- one typed game catalog as the source of truth for discovery and routing;
- one application shell with adaptive desktop/mobile navigation;
- dedicated discovery components (`FeaturedGame`, `GameTile`, `GameRail`, `GameGrid`);
- one shared game page shell and viewport boundary;
- lazy-loaded isolated game runtimes;
- future semantic shared input infrastructure;
- restrained, adaptive visual effects under an explicit performance contract.

The first implementation should focus on shell + discovery and leave game mechanics unchanged, creating a clean foundation for subsequent immersive-shell and touch-control PRs.