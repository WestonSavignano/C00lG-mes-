# School Escape 3D Stealth Game Design

## Summary

School Escape is a third-person 3D stealth game for C00lG@mes+ built around one distinctive mechanic: the player manually mixes their clothing color to blend into nearby school walls while a teacher searches for them.

The player starts inside a fixed, creepy school maze after everyone else has left. They explore hallways and classrooms, hide by matching nearby wall colors, escape short chases after being spotted, find the school exit, and then survive a final outdoor chase down a sidewalk to their house. Entering the house wins. Being caught triggers a short principal-office fail cutscene with a red-faced principal yelling at the player, followed by retry.

This first release is intentionally one complete, focused vertical slice: one school, one teacher, one exit, one final chase, and no side systems.

## Product goals

- Make the core idea understandable within seconds: match the wall color, stay still, and do not get caught.
- Make camouflage a player skill rather than an automatic hide button.
- Keep chases tense but recoverable by making the teacher slightly slower than the player's sprint speed.
- Make the school feel grounded, empty, and creepy without requiring photorealistic assets or expensive effects.
- Deliver a complete beginning-to-end game loop suitable for desktop and mobile browsers.
- Keep runtime cost bounded enough for representative lower-powered hardware.
- Keep the game isolated under its own runtime boundary rather than creating speculative shared 3D infrastructure.

## Non-goals

- Procedural school generation.
- Multiple teachers, enemies, or boss encounters.
- Collectibles, keys, quests, currency, upgrades, inventory, or side objectives.
- Multiplayer, networking, accounts, cloud saves, achievements, or leaderboards.
- Photorealistic rendering, large downloaded asset packs, shadow maps, or post-processing pipelines.
- A reusable site-wide 3D engine before a second landed game demonstrates a real shared need.
- Monetization, ads, analytics, or portal SDK integration.

## Runtime architecture

The game follows the existing C00lG@mes+ boundaries:

```text
gameCatalog
  -> lazy import
SchoolEscapePage
  -> GameViewport
SchoolEscapeGame
  -> SchoolEscapeScene (imperative WebGL render/update loop)
  -> schoolEscapeLogic (deterministic gameplay rules)
  -> schoolEscapeLevel (fixed geometry/nav/perception data)
```

### `SchoolEscapePage`

Thin route adapter. It composes the game into the shared game-page infrastructure and does not contain simulation logic.

### `SchoolEscapeGame`

React lifecycle boundary. It owns the canvas mount, HUD/control overlay, shared semantic input wiring, camera pointer/touch gestures, RGB controls, retry/win/fail presentation, and creation/disposal of the scene controller.

Frame-by-frame player, teacher, camera, and rendering state must not flow through React state. React state is reserved for low-frequency UI such as game phase, camouflage readout, subtitles, and retry/win overlays.

### `schoolEscapeLogic`

Pure deterministic logic for:

- RGB match quality;
- camouflage effectiveness;
- teacher visibility/suspicion decisions;
- teacher state transitions;
- chase escape conditions;
- school-exit transition;
- catch/fail transition;
- house/win transition.

This file is the primary unit-test boundary.

### `schoolEscapeLevel`

Static fixed-school data:

- floor and wall rectangles;
- collision bounds;
- wall material/color IDs;
- classroom doors;
- teacher patrol nodes and links;
- start position;
- school exit trigger;
- exterior sidewalk bounds;
- house/win trigger.

The level is data-driven enough to keep scene code understandable, but the first version remains one authored layout rather than a general level-editor format.

### `SchoolEscapeScene`

Imperative native WebGL runtime. It owns:

- WebGL context and resources;
- render loop;
- player transform and simple character animation;
- third-person camera;
- collision resolution;
- jump/gravity;
- teacher movement/path following;
- line-of-sight checks;
- door animation cues;
- exterior finale;
- principal-office cutscene camera/animation;
- bounded audio scheduling;
- resize and disposal.

The renderer may reuse mathematical ideas already proven in the unmerged Bodi Island experiment, but this game must not depend on that branch or import its runtime code.

## Rendering direction

Use dependency-free native WebGL with simple authored geometry and a lightweight lit-material shader.

The target is grounded/stylized realism rather than photorealism:

- believable school proportions;
- long fluorescent-lit corridors;
- lockers, classroom doors, bulletin boards, tiled floors, ceiling panels, desks visible through some doorways, and an exit lobby;
- muted institutional colors;
- dim ambient lighting;
- localized brighter fluorescent fixtures;
- distance fog to deepen hallways and hide hard draw distance;
- occasional inexpensive fluorescent flicker driven by deterministic timers;
- no dynamic shadow maps or post-processing.

Geometry is intentionally low complexity. School readability and atmosphere come from proportions, material color, lighting, fog, sound, and composition rather than dense meshes.

## Player character

The player is a kid with:

- blonde hair;
- blue eyes;
- tan skin;
- black jacket;
- black pants;
- colorful paint spots across the jacket and pants.

The character is constructed from simple low-poly primitives. A bounded set of small colored surface pieces represents paint spots without requiring texture downloads.

Camouflage changes the dominant jacket/pants material toward the player's current mixed RGB color. Hair, skin, eyes, shoes, and subtle paint markings remain recognizable so the character does not visually disappear from the player camera.

## Controls

### Desktop

- `WASD`: move.
- Mouse drag on the non-interactive game surface: rotate the third-person camera.
- `Shift`: sprint.
- `Space`: jump.
- RGB sliders in the HUD: manually mix red, green, and blue camouflage channels.

Camera control intentionally uses drag rather than mandatory pointer lock so the player can immediately use the RGB controls without repeatedly entering and leaving pointer lock.

### Mobile

- Shared semantic directional control: movement.
- Sprint action button.
- Jump action button.
- Right-side drag region on the game surface: camera rotation.
- Three touch-friendly RGB sliders with 44px+ practical interaction height.

Use the landed shared semantic input foundation for movement/actions and its interruption/reset lifecycle. Camera dragging and RGB sliders remain game-specific because they are specific to this interaction model.

The game is landscape-first on handheld devices.

## Player movement and camera

Nominal movement tuning:

- walk speed: `2.8` world units/second;
- sprint speed: `4.8` world units/second;
- teacher patrol speed: `2.0` world units/second;
- teacher chase speed: `4.2` world units/second;
- final-chase teacher speed: `4.4` world units/second;
- jump velocity: tuned to clear small threshold/sidewalk obstacles but not bypass walls.

The teacher is therefore threatening but slightly slower than a clean player sprint.

The camera stays behind and above the player with yaw/pitch input, constrained pitch, short collision push-in near walls, and smooth but bounded interpolation. Camera smoothing must not add noticeable input lag.

## Fixed school layout

The first level is a compact hand-authored maze with recognizable school landmarks rather than random corridors.

Suggested flow:

1. **Start classroom** — safe starting pocket and visual introduction to movement/RGB controls.
2. **Classroom hall** — first patrol exposure and several differently colored walls.
3. **Locker junction** — branching routes, long sight line, and a strong camouflage surface.
4. **Cross hall** — creates navigation uncertainty without a large map.
5. **Quiet classroom wing** — door alcoves and short line-of-sight breaks for rehiding.
6. **Exit lobby** — clearly readable exterior doors that trigger the finale.
7. **Exterior sidewalk** — linear final chase with a few fixed obstacles.
8. **House** — visible destination and win trigger.

The player objective is only to leave the school. No keys or collectibles gate the exit.

## Manual RGB camouflage

The HUD exposes three channels:

- Red: `0-255`;
- Green: `0-255`;
- Blue: `0-255`.

The player's clothing updates continuously as the values change.

### Match score

For player color `P=(r,g,b)` and nearby wall color `W=(wr,wg,wb)`:

```text
distance = sqrt((r-wr)^2 + (g-wg)^2 + (b-wb)^2)
maxDistance = sqrt(3 * 255^2)
match = 1 - distance / maxDistance
```

Clamp `match` to `[0,1]`.

### Hide eligibility

The player receives meaningful camouflage only when all of these are true:

- nearest eligible wall surface is within `0.8` world units;
- player horizontal speed is below `0.18` world units/second;
- player is grounded;
- wall remains between the player's body and the local background direction used for the hiding check.

Color quality then scales how visible the player remains. There is no separate hide button.

Recommended first-pass bands:

- `match >= 0.92`: excellent match; teacher suspicion rises very slowly while the player remains still near the wall;
- `0.84 <= match < 0.92`: partial match; useful but risky;
- `match < 0.84`: poor camouflage; little protection.

These constants live in deterministic logic and may be tuned through playtesting without changing rendering code.

The HUD shows a compact qualitative indicator such as `POOR`, `CLOSE`, or `BLENDED` so the mechanic feels learnable rather than arbitrary.

## Teacher character and presence

The teacher looks like an ordinary teacher with a red face:

- button-up shirt;
- slacks;
- school ID badge;
- simple shoes;
- bright red facial material.

The teacher is the only pursuer in the game.

While searching, the teacher provides positional cues through:

- audible footsteps;
- low muttering/mumbling;
- classroom-door opening/closing sounds and simple door motion;
- directional audio panning where practical.

When the teacher confirms the player and enters chase, the game emits the line:

> COME BACK HERE!

Use browser speech synthesis only as progressive enhancement; always pair it with an on-screen subtitle so gameplay feedback never depends on voice availability.

## Teacher perception

Teacher perception is deterministic and based on geometry plus player camouflage state.

A player can contribute to suspicion only when:

- within perception range;
- inside the teacher's forward field of view;
- not occluded by school collision walls;
- not already in a non-interactive cutscene/win/fail state.

Initial tuning:

- patrol/suspicious sight range: `14` world units;
- chase sight range: `18` world units;
- horizontal field of view: `100` degrees.

A visibility factor is derived from:

- distance;
- player movement;
- sprinting;
- camouflage eligibility;
- RGB match score.

Movement substantially increases visibility. Standing still beside a well-matched wall substantially reduces it.

The result feeds a suspicion meter rather than causing every visible frame to become an instant chase. Clear, close, moving exposure fills suspicion rapidly; distant excellent camouflage fills it slowly enough for the teacher to walk past.

## Teacher state machine

Use four explicit states.

### `patrol`

The teacher follows a fixed patrol graph through the school. Door nodes can trigger a brief door-opening animation/sound before continuing.

Transition to `suspicious` when the teacher receives non-trivial player visibility.

Transition directly to `chase` when exposure is unmistakable, such as a close moving player in clear line of sight.

### `suspicious`

The teacher slows, turns toward the suspected position, and accumulates/decays suspicion based on continuing perception.

- suspicion reaches threshold -> `chase`;
- suspicion decays to zero -> `patrol`.

### `chase`

The teacher navigates toward the player/last visible position using the fixed nav graph and local steering.

On entry, fire the `COME BACK HERE!` cue once per chase episode.

If the teacher reaches catch radius, transition to fail cutscene.

If line of sight is lost long enough, transition to `search` at the last seen position.

### `search`

The teacher checks a small deterministic sequence of nearby nav nodes around the last seen position for approximately `5` seconds.

- player is clearly detected -> `chase`;
- search timeout expires -> `patrol`.

A player who breaks line of sight, reaches a wall, stops moving, and creates a strong color match can therefore escape an active pursuit.

## Navigation and collision

Do not add a general pathfinding library.

The fixed level provides a small authored navigation graph. Teacher travel uses shortest-path traversal over that graph with simple local target following. Because the layout is fixed and small, this is cheaper and easier to debug than introducing navmesh generation.

Player/world collision uses axis-aligned wall rectangles and circle/capsule-style horizontal resolution. Doors used for atmosphere do not dynamically invalidate the main navigation graph; they are either non-blocking visual doors or have fixed authored open passages.

Line-of-sight checks use segment-versus-wall-rectangle intersection against the same collision data so navigation, perception, and hiding agree about where walls exist.

## Game flow

### Start

The game begins inside a classroom. The teacher is already patrolling elsewhere, giving the player a brief natural learning window.

A minimal prompt teaches:

- move;
- look;
- sprint/jump;
- mix RGB;
- stand still near a matching wall to blend.

### School stealth loop

```text
explore
-> hear teacher
-> choose route or hiding wall
-> mix color
-> stay still
-> teacher passes OR notices player
-> if noticed: chase
-> break line of sight
-> rehide
-> continue toward exit
```

### Exit trigger

Entering the exit-lobby trigger while in normal school gameplay transitions immediately into the finale. The player does not need a key or button prompt.

## Final outdoor chase

The exterior finale intentionally changes the rules:

- camouflage is disabled;
- the route is mostly linear;
- the teacher begins behind the player;
- the teacher remains slightly slower than the player's sprint;
- fixed sidewalk obstacles punish poor movement without becoming a platforming level;
- music/audio intensity increases;
- the house is visible as the destination.

Entering the house trigger ends the chase and transitions to the win state.

The finale should feel like a short payoff, not a second full level.

## Win state

Once inside the house:

- player control stops;
- the door closes behind the player;
- the teacher remains outside;
- show a clear `YOU ESCAPED` result;
- provide `Play Again` and return-to-games actions.

## Catch and principal-office fail cutscene

Catch occurs when the teacher reaches a small player catch radius during school or final-chase gameplay.

The fail sequence uses the same lightweight 3D renderer:

- cut to the principal's office;
- player sits/stands in front of a desk;
- normal-looking principal stands behind the desk with a bright red face;
- teacher is visible nearby;
- principal performs simple angry pointing/arm motion;
- short non-specific yelling presentation appears as subtitle/audio cue;
- screen presents `Retry`.

Retry reconstructs a clean run from the start classroom. It must not reuse stale movement, suspicion, audio, or camera state.

## Audio

Keep audio generated/procedural or browser-native for this first version so no asset pack is required.

Use Web Audio for inexpensive cues such as:

- teacher footsteps;
- player footsteps;
- door creak/close;
- low teacher muttering texture;
- detection sting;
- chase pulse;
- win/fail stings.

Use `speechSynthesis` only for `COME BACK HERE!` as optional enhancement, with an always-visible subtitle fallback.

Audio creation must wait until a user gesture has occurred and must be disposed/suspended safely on unmount or hidden-page lifecycle changes.

## HUD and UI

The HUD remains minimal:

- compact RGB mixer;
- current blend quality indicator;
- short contextual instruction/subtitle region;
- optional small chase/search status cue only when needed.

Do not add minimaps, objective lists, inventories, scores, timers, or collectibles.

The school exit and house should be readable through world composition so the player does not need waypoint arrows in the first version.

## Performance requirements

- Lazy-load the entire School Escape runtime through the typed game catalog.
- Add no new runtime dependency.
- Keep simulation/render state outside React's frame loop.
- Prefer one shared shader/program for opaque scene geometry where practical.
- Reuse buffers/typed arrays rather than allocate per frame.
- Bound draw calls and character sub-parts.
- No dynamic shadow maps.
- No post-processing passes.
- Cap device pixel ratio at `1.5` by default; allow a lower cap when reduced quality is detected or requested.
- Pause simulation/audio when the document is hidden.
- Clamp frame delta after interruption so returning to a tab cannot advance the simulation dramatically.
- Target stable `60 FPS` on capable hardware and stable `30+ FPS` degraded behavior on representative lower-powered hardware.
- Fog/draw distance should prevent rendering unnecessary distant rooms.
- Respect `prefers-reduced-motion` by reducing camera shake, flicker amplitude, and nonessential animation.

## Lifecycle and failure behavior

The game must handle:

- resize;
- fullscreen enter/exit through shared `GameViewport`;
- orientation change;
- browser focus loss;
- document hide/show;
- pointer cancel/lost pointer capture;
- component unmount;
- WebGL context creation failure.

Input is cleared on interruption through the shared input lifecycle. Game-specific camera pointers are also cleared explicitly.

If WebGL is unavailable, show a usable in-game fallback explaining that 3D graphics are unavailable, with a return-to-games action. Do not crash the application shell.

## Catalog integration

Register the game in `src/games/catalog/gameCatalog.ts` with:

- id: `school-escape`;
- route: `/games/school-escape`;
- title: `School Escape`;
- category: `3D stealth`;
- orientation: `landscape`;
- inputs: `touch`, `keyboard`, and pointer/mouse behavior represented according to the existing catalog type;
- lazy page import only.

Discovery should not import the runtime eagerly.

## Testing strategy

### Deterministic unit tests

`schoolEscapeLogic.test.ts` covers at minimum:

- exact RGB match returns `1`;
- maximum RGB mismatch approaches `0`;
- match bands classify poor/close/blended correctly;
- moving player cannot receive full camouflage benefit;
- player too far from a wall cannot receive camouflage benefit;
- excellent still wall match strongly suppresses visibility;
- poor match remains visible;
- suspicion rises with valid exposure and decays when exposure ends;
- `patrol -> suspicious -> chase` transitions;
- direct obvious exposure can enter chase;
- lost line of sight enters search;
- successful hidden search timeout returns to patrol;
- catch produces fail state;
- school exit produces final-chase state;
- camouflage is disabled in final chase;
- house trigger produces win state.

### Level tests

`schoolEscapeLevel.test.ts` verifies:

- player spawn is inside a valid walkable region;
- exit and house triggers exist;
- teacher patrol graph nodes have valid links;
- fixed wall colors referenced by hiding surfaces are valid RGB triples;
- final chase route remains connected.

### Integration tests

Catalog/route tests verify:

- game appears in the typed catalog;
- lazy route resolves;
- catalog metadata advertises the supported inputs/orientation;
- importing Home/Games discovery does not eagerly load the School Escape scene module.

### Manual validation before merge

Desktop:

- WASD, mouse camera, Shift sprint, Space jump;
- RGB sliders and visible clothing color;
- poor/close/blended hiding behavior;
- teacher patrol/suspicion/search/chase;
- `COME BACK HERE!` subtitle/audio behavior;
- chase, break line of sight, rehide;
- school exit -> sidewalk chase -> house -> win;
- catch -> principal cutscene -> retry.

Mobile:

- directional touch control;
- sprint + movement multi-touch;
- jump;
- camera drag without fighting RGB controls;
- RGB slider usability;
- landscape safe-area layout;
- rotate/resize/interruption recovery.

Lifecycle/performance:

- fullscreen enter/exit;
- focus loss/regain;
- hidden tab and restore;
- no stuck movement/camera pointers;
- no duplicate render loops after retry/remount;
- frame stability on representative lower-powered hardware;
- reduced-motion behavior.

## Delivery boundary

Issue #16 owns this feature. Normal delivery remains:

```text
Issue #16
-> feature/school-escape
-> focused draft PR
-> automated validation
-> real gameplay/device validation
-> review
-> merge only when explicitly authorized
```

The PR should remain draft until the full repository validation gate is green and the player-facing manual validation is recorded honestly.
