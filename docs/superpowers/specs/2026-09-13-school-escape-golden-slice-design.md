# School Escape Golden-Slice Rebuild Design

## Status

Approved in product/design discussion on September 13, 2026. This document records the replacement design direction for School Escape before implementation planning.

This design supersedes the visual/runtime direction embodied by draft PR #17 and its branch-only `2026-09-11-school-escape-design.md`. PR #17 remains useful as a mechanics prototype and reference implementation, but its dependency-free native-WebGL renderer, cube-built characters/environment, debug-style HUD, and full-game-first scope are not the target architecture for the production-quality game.

Issue #16 remains the parent product outcome for the complete School Escape game. The next executable implementation boundary should be a separate focused golden-slice Issue created only after this written design is reviewed and approved.

## Summary

School Escape is a third-person 3D stealth-adventure game built around one distinctive mechanic: the player manually mixes paint colors on their clothing to blend into school surfaces while evading a single red-faced teacher.

The final game still targets the original complete arc: escape a creepy school, survive recoverable teacher chases, reach the exit, sprint home in a cinematic outdoor finale, and see a stylized principal-office fail sequence when caught.

The rebuild changes how we get there. Instead of implementing the whole game with a minimal custom renderer, we first prove a premium **golden slice** using Babylon.js:

`art classroom -> main hallway -> locker bay -> first teacher near-miss -> successful camouflage`

The slice must prove that the camera, movement, art, lighting, animation, audio, camouflage interaction, teacher presence, mobile controls, and lower-end performance all meet the intended player-experience bar before the rest of the school is built.

## Product quality target

The target is **stylized realism with premium third-person adventure game feel**.

The design may borrow broad genre qualities from polished third-person adventure games: restrained contextual UI, strong camera work, expressive animation, readable landmarks, responsive movement, authored materials, and world-first feedback. It must not copy Nintendo assets, UI trade dress, character designs, music, maps, or other protected expression.

The game should feel:

- believable enough to read immediately as a school;
- painterly/stylized rather than photorealistic;
- creepy and tense rather than full horror;
- responsive and adventurous rather than simulation-heavy;
- visually rich without depending on expensive effects;
- intentionally designed for desktop and mobile browsers;
- stable on lower-powered hardware after adaptive quality scaling.

The quality gate is not “does the mechanic work?” PR #17 already answered that. The new gate is:

> Does this look, move, sound, and feel like the real School Escape we want to finish?

If the answer is no, do not expand the level.

## Golden-slice scope

The first implementation slice contains only the systems and content required to prove the experience.

### Included

- One warm, sunset-lit art classroom as the starting space.
- One cooler fluorescent main hallway.
- One locker bay that serves as the first strong camouflage tutorial/hiding space.
- One stylized rigged player character.
- One stylized rigged red-faced teacher.
- Premium third-person camera and responsive adventure movement.
- Desktop keyboard/mouse controls.
- First-class mobile dual-zone touch controls.
- Contextual five-pigment paint-mixing UI.
- Clothing color/material changes driven by the current paint mixture.
- Deterministic camouflage scoring based on color quality, cover proximity, stillness/movement, and teacher perception.
- Teacher patrol, suspicion, investigation/search, chase, and recovery behavior sufficient for the golden-slice spaces.
- A partially scripted first near-miss that teaches the mechanic without a tutorial panel.
- A short chase/re-hide path for failure-to-hide testing.
- Continuous adventure music with dynamic danger intensity.
- Environmental and positional audio cues.
- Adaptive visual/audio quality tiers.
- Loading, pause/focus/visibility, resize/orientation, retry, and disposal behavior suitable for real browser playtesting.
- Focused automated tests around deterministic/gameplay logic and lifecycle boundaries.

### Explicitly deferred from the golden slice

- The full school maze.
- Quiet wing, cross hall, exit lobby, and other later-school spaces.
- The complete outdoor sprint-home finale.
- The house win scene.
- The finished principal-office fail cutscene.
- Multiple enemies.
- Collectibles, keys, inventory, quests, progression, upgrades, or side objectives.
- Multiplayer/networking.
- Accounts, persistence, achievements, monetization, analytics, or portal SDKs.
- A site-wide/shared 3D-engine abstraction.
- WebGPU-only rendering.
- Expensive post-processing stacks whose player value has not been proven.

If the teacher catches the player during the golden slice, use a concise temporary caught/retry presentation. The final principal-office sequence remains a later full-game slice.

## Experience flow

### 1. Art classroom

The player begins in an art classroom late in the afternoon. Warm sunset light enters through the windows. The room introduces the player character, camera, movement, jump, and environmental style without a modal tutorial.

The character is already wearing dark clothing with visible paint marks, establishing the camouflage concept visually before it is required.

### 2. Main hallway

Leaving the classroom shifts the visual tone. The hallway is cooler, dimmer, and more fluorescent, with stronger pools of light and shadow. The soundtrack becomes slightly more uneasy while retaining the same adventurous musical identity.

The player hears the teacher before seeing them: footsteps, a distant door, and environmental directionality establish danger spatially.

### 3. Scripted near-miss

The teacher crosses the far end of the hall on a believable patrol path. This beat is partially scripted only to guarantee that the player encounters the camouflage lesson under fair conditions.

The player has enough time to reach the locker bay and experiment. A weak color match or too much movement makes the teacher suspicious first; it must not instantly produce an unavoidable chase.

### 4. Locker-bay camouflage

Near a valid hiding surface, the contextual paint palette appears. The player adjusts the five pigment controls while the outfit changes in real time. A subtle match ring communicates progress without exposing RGB values or percentages.

The player stays close to the surface and mostly still. A good match lowers teacher detection enough for the teacher to pass.

### 5. Optional detection/chase/re-hide

If the player is clearly seen, the teacher says “Come back here!”, chases, and remains slightly slower than a clean player sprint. The player can break line of sight, reach another viable cover surface, re-establish camouflage, and survive the search.

The slice is not complete until both the near-miss path and chase/re-hide path feel readable and fair.

## Runtime architecture

School Escape remains isolated under its game boundary. Babylon.js is a game-local runtime choice, not a new site-wide engine layer.

```text
C00lG@mes+ shell / routing
  -> lazy School Escape route
    -> thin SchoolEscapePage
      -> shared GameViewport
        -> SchoolEscapeGame (React lifecycle/UI boundary)
          -> schoolEscapeRuntime (Babylon scene + imperative update loop)
          -> schoolEscapeLogic (pure deterministic rules)
          -> schoolEscapeLevel (authored golden-slice data)
          -> schoolEscapeInput (semantic input -> game intents)
          -> schoolEscapeAudio (music/ambience/voice orchestration)
          -> schoolEscapeQuality (adaptive quality policy)
```

### `SchoolEscapePage`

A thin route adapter. It composes School Escape into the existing game shell and must not contain simulation logic.

The golden slice should be launchable through a branch/preview and may have an unlisted direct route after merge, but it should not be promoted as a finished catalog game until the complete School Escape release meets its own acceptance gate. Do not invent a general feature-flag platform solely for this purpose.

### `SchoolEscapeGame`

The React boundary owns:

- canvas/runtime mount and teardown;
- low-frequency HUD state;
- contextual paint palette presentation;
- touch-control overlays;
- loading/error/retry presentation;
- shared semantic input integration;
- lifecycle signaling to the imperative runtime.

Frame-by-frame transforms, camera state, teacher movement, animation weights, perception accumulation, particles, and rendering state must stay out of React state.

### `schoolEscapeRuntime`

Owns the Babylon engine/scene and the frame loop:

- scene creation and disposal;
- model/material/light setup;
- player collision proxy and movement integration;
- camera spring/occlusion behavior;
- character transforms and animation blending;
- teacher path following and perception sampling;
- authored triggers;
- visual camouflage updates;
- world-space feedback;
- adaptive render-quality application;
- pause/resume/visibility behavior.

### `schoolEscapeLogic`

Pure deterministic logic remains the primary unit-test boundary. It owns:

- paint-mixture color calculation;
- perceptual color-match score;
- camouflage eligibility/effectiveness;
- teacher perception/suspicion integration;
- teacher state transitions;
- chase/search/recovery rules;
- catch and golden-slice completion conditions.

This preserves the best architectural lesson from PR #17: gameplay rules should not be inseparable from rendering code.

### `schoolEscapeLevel`

Holds authored golden-slice gameplay data such as:

- spawn point;
- collision/navigation bounds;
- teacher patrol/search nodes;
- hideable-surface IDs and canonical camouflage colors;
- scripted near-miss trigger/timing data;
- retry/completion triggers;
- quality-tier decoration groups where appropriate.

It should be data-driven enough to keep runtime code readable, but this is not a general level-editor format.

## Babylon.js rendering direction

Use the standard Babylon.js engine/runtime with modular packages and glTF/GLB loading. The implementation plan should pin the exact package versions used at that time.

Design constraints:

- WebGL remains the compatibility baseline.
- WebGL 2 is preferred when available; used features must degrade safely for older WebGL-capable devices supported by Babylon.
- WebGPU is optional future enhancement, not a requirement and not a reason to fork gameplay behavior.
- Babylon must be lazy-loaded with School Escape so unrelated routes do not pay its runtime cost.
- Do not create a reusable C00lG@mes+ 3D engine abstraction until another landed game demonstrates a real shared need.
- Do not add a general physics engine for the golden slice unless profiling/behavior proves the simpler collision approach insufficient.

The purpose of Babylon is to stop rebuilding commodity 3D-engine features ourselves and spend engineering time on player experience.

## Asset and material strategy

Use a **small custom stylized asset set** created specifically for School Escape.

Golden-slice assets should include only what the approved spaces require, such as:

- modular classroom/hallway architectural pieces;
- desks, stools, cabinets, art-room props;
- lockers;
- classroom/hall doors;
- fluorescent fixtures;
- bulletin boards/signage;
- a small number of hero props/landmarks;
- player character and animation set;
- teacher character and animation set.

Use GLB/glTF for authored characters and visible environment assets. Use simple invisible collision geometry/proxies where that improves stability and performance.

Avoid broad premade asset packs that create visual inconsistency. Any external source material must have a license compatible with commercial distribution and redistribution requirements, and provenance should be recorded during implementation. Original/custom assets are preferred.

Materials should favor compact stylized PBR or similarly efficient authored materials. Reuse material families and trim/detail textures where practical. Avoid large 4K texture sets. Decorative surface detail should support readability rather than photorealism.

The environment must remain readable on the lowest quality tier; gameplay-critical silhouettes, hideable surfaces, landmarks, and the teacher’s red face cannot depend on expensive post-processing.

## Art direction and lighting

### Tone

The school is **creepy and tense**, not full horror.

The environment may use empty halls, distant doors, unsettling silence between musical phrases, fluorescent hum, occasional deliberate light flicker, and deep recesses. Avoid gore, jump-scare dependence, grotesque character distortion, or oppressive darkness that makes navigation frustrating.

### Time of day

The golden slice occurs in late afternoon approaching dusk.

The art classroom uses warm sunset light from windows. The hallway uses cooler fluorescent lighting and stronger shadow separation. This warm/cool transition becomes a visual storytelling device as the player leaves relative safety.

### Lighting principles

- Use a small number of purposeful lights rather than dense dynamic lighting.
- Reserve dynamic shadow cost for elements that materially improve character/world grounding.
- Low-quality mode may simplify or replace expensive shadows, but must preserve readable contact and depth.
- Fluorescent flicker should be authored and occasional, not a constant randomized distraction.
- Do not rely on heavy SSAO/bloom/volumetrics to make the scene attractive.
- Composition, materials, silhouettes, color contrast, and animation should carry the look first.

## Player character

The player is a stylized adventure-hero kid with believable but slightly exaggerated proportions and a strong silhouette.

Required traits:

- blonde hair;
- blue eyes;
- tan skin;
- dark jacket and pants;
- visible colorful paint marks;
- expressive face and readable pose language.

The character must be a rigged model, not a stack of primitive cubes. Animation should include at minimum:

- idle;
- walk;
- run;
- sprint;
- turn/locomotion blending;
- jump;
- fall/airborne;
- landing;
- subtle contextual mixing/hiding pose if it improves feedback without slowing input.

Hair, skin, eyes, and core facial features remain unchanged during camouflage. Paint/color changes are concentrated on the outfit so the player remains visually readable to themselves.

## Teacher character

The teacher should look mostly normal at first glance:

- believable adult proportions;
- ordinary teacher clothing;
- calm patrol posture;
- one immediately unsettling feature: an unnatural deep-red face.

Avoid monster anatomy or exaggerated horror proportions.

Animation/body language is a primary feedback channel. The teacher needs readable states for:

- relaxed patrol;
- hearing/noticing something;
- suspicious look/turn;
- investigation/search;
- full alert;
- chase;
- recovery back to patrol.

The teacher’s behavior should become more intense when the player is detected without transforming the teacher into a different creature.

## Player movement

Movement is **responsive adventure movement**: quick reaction to input with enough acceleration, deceleration, turning, and body motion to look polished.

Principles:

- camera-relative WASD/virtual-stick movement;
- quick but not instantaneous acceleration;
- smooth deceleration without skating;
- natural facing into movement direction;
- subtle lean/pose response on strong direction changes;
- sprint that feels materially faster but controllable;
- restrained, useful jump rather than floaty platformer movement;
- no animation-driven latency that makes controls feel heavy.

Use a lightweight kinematic collision proxy/capsule/ellipsoid approach suitable for the simple authored spaces. Keep simulation/gameplay state game-local and deterministic where practical. Do not add full rigid-body physics merely to move the player through hallways.

## Third-person camera

The camera is a major quality gate and must be good before the environment is expanded.

Target behavior:

- fairly close trailing third-person framing;
- smooth yaw/pitch orbit from mouse drag or right-side touch drag;
- spring-like follow behavior without noticeable input lag;
- gentle automatic recentering only when it helps, never while the player is actively controlling the camera;
- wall/geometry occlusion handling that pushes the camera inward rather than clipping through walls;
- fast recovery to the preferred distance after obstructions clear;
- constrained pitch to avoid disorienting angles;
- modest FOV widening and/or camera pullback while sprinting to increase speed sensation;
- no forced cinematic camera cuts during ordinary stealth/chase control.

The golden slice fails its quality gate if moving around an otherwise empty test room does not already feel satisfying.

## Camouflage interaction

Camouflage is the signature mechanic and must feel like part of the game world rather than a graphics/settings panel.

### Contextual paint palette

When the player is close to a valid hideable surface, a compact contextual palette appears near the lower portion of the screen.

Five pigment controls are available:

- red;
- yellow;
- blue;
- white;
- black.

The center/current-mixture swatch changes as the player adjusts the mix. The exact interaction should support both tap/hold and pointer input without exposing numeric channel values. Provide a small reset/clean action so an overmixed color never traps the player in an unrecoverable state.

The palette should be easy to reach with the right thumb on mobile and must not cover the teacher or the key hiding surface.

### Paint model

The deterministic logic converts pigment contributions into a displayed clothing color. The implementation may use a simple bounded subtractive-inspired model or a perceptually tuned weighted model, but it must satisfy these player-facing rules:

- red + yellow moves toward orange;
- yellow + blue moves toward green;
- red + blue moves toward purple;
- white predictably lightens;
- black predictably darkens;
- repeated adjustments converge smoothly rather than jumping;
- the same mixture always produces the same color.

The implementation plan must lock the exact formula with unit tests before UI tuning. Do not expose the internal values to players.

### Match feedback

A subtle ring around the current swatch becomes cleaner/more complete as the mixture approaches the nearby surface color. Do not show RGB numbers, percentages, or `POOR/CLOSE/BLENDED` debug labels.

Use a perceptual color-distance function for deterministic scoring rather than raw per-channel distance if practical; OKLab is an appropriate lightweight option. Hideable surfaces store canonical camouflage colors so lighting changes do not make the scoring rule arbitrary.

The clothing material updates continuously so the player sees paint spread/shift across the jacket and pants while mixing.

### Camouflage effectiveness

A color match alone never makes the player invisible. Camouflage benefit depends on all of:

- proximity to an authored hideable surface;
- perceptual color-match quality;
- player movement/stillness;
- being grounded/in a valid hiding posture;
- teacher distance/viewing angle/line of sight;
- current gameplay state.

Strong matching reduces detection confidence rather than switching visibility off. Sprinting, moving through the teacher’s direct view, or standing extremely close to the teacher remains dangerous.

There is no separate hide button.

## HUD and feedback philosophy

The HUD is **minimal and world-first**.

Do not retain the prototype’s large persistent information box, numeric blend values, or explicit `PATROL / SEARCH / CHASE` state labels.

Persistent gameplay UI should be close to zero. Contextual UI may include:

- paint palette when a hideable surface is relevant;
- subtle paint-match ring;
- small danger/suspicion indicator only when the teacher notices something;
- short subtitles for critical teacher speech;
- compact jump/sprint touch controls on mobile;
- concise caught/retry or golden-slice completion presentation.

Teacher awareness should be communicated primarily through world-space animation, facing, movement, footsteps, voice, and music. A small original alert glyph may appear near/above the teacher during suspicion or full detection; do not copy another game’s exact iconography or animation.

## Environmental navigation

The full game should teach navigation through the world, not a waypoint arrow. The golden slice establishes that language with:

- EXIT signs;
- classroom numbers;
- hallway/locker color themes;
- murals/artwork;
- windows and lighting direction;
- trophy/bulletin landmarks;
- distinctive room silhouettes.

Do not add a persistent minimap or waypoint for the golden slice. If later full-school playtesting proves players become lost, evaluate a subtle accessibility/lost-player assist as a separate evidence-driven change.

## Teacher perception and state model

Keep the AI small and legible. The golden slice uses:

`patrol -> suspicious -> investigate/search -> chase -> recover`

The state model should remain deterministic and testable outside Babylon rendering.

### Patrol

The teacher follows a small authored path through the golden-slice spaces. Patrol animation and footsteps should make direction/speed readable.

### Suspicious

Weak evidence slows the teacher and turns attention toward the perceived location. The teacher may pause, look, or mutter. This state is the fairness buffer between “possibly seen” and “full chase.”

### Investigate/search

The teacher moves toward the last perceived/known location and checks a small deterministic sequence of nearby authored points. Search duration and pathing must be bounded.

### Chase

Confirmed detection triggers the line:

> Come back here!

The teacher runs toward the player/last known position and remains slightly slower than the player’s clean sprint speed. Breaking line of sight is therefore meaningful.

### Recover

After a bounded search without reacquisition, the teacher visibly de-escalates and returns to patrol.

### Perception signals

Perception should combine:

- distance;
- field of view;
- line of sight against authored collision geometry;
- player movement/sprint state;
- camouflage effectiveness;
- short suspicion accumulation/decay over time.

Exact thresholds/speeds are tuning constants, not product requirements. The implementation plan should preserve the player-facing invariant: the teacher is threatening but fair, suspicion is readable, and a strong re-hide after breaking line of sight can work.

Do not introduce a navmesh/pathfinding dependency for the golden slice unless the authored waypoint graph proves insufficient.

## First teacher encounter

The first encounter is a **scripted near-miss**, not an unavoidable chase.

Sequence:

1. The player exits the art classroom.
2. Distant footsteps/door audio establishes the teacher before visual contact.
3. The teacher crosses the far hallway on an authored patrol segment.
4. The locker bay offers an obvious but not glowing hideable surface.
5. The paint palette appears contextually.
6. A good mix + stillness lets the teacher pass.
7. A weak mix/movement causes suspicion first.
8. Clear exposure escalates to chase.

Do not interrupt this with a tutorial modal. The world, contextual palette, animation, alert feedback, and audio should teach the rule.

## Audio and music

The chosen direction is **continuous adventure soundtrack plus strong environmental audio**.

### Music

Use an original/licensed-for-commercial-use musical identity rather than browser-generated tones. The golden slice should support at least:

- exploration theme/loop;
- increased suspicion/tension layer or arrangement;
- chase-intensity arrangement.

Prefer smooth layering/crossfades over abrupt unrelated track changes so the soundtrack feels coherent.

### Environmental audio

Important cues include:

- fluorescent hum;
- player footsteps with surface variation where practical;
- teacher footsteps with directional positioning;
- lockers/doors;
- HVAC/room tone;
- distant school noises;
- paint-mixing feedback;
- jump/landing feedback.

Gameplay-critical teacher proximity cues must survive low audio-quality tiers.

### Voice

The teacher’s `Come back here!` should ultimately be an original recorded/licensed voice asset with subtitle support, not a requirement on inconsistent browser `speechSynthesis` behavior. If the recorded line is not ready in the first golden-slice implementation, use a clearly temporary local placeholder plus authoritative subtitle during development; do not ship the final game depending on speech synthesis.

## Desktop controls

- `WASD`: move.
- Mouse drag on the gameplay surface: orbit camera.
- `Shift`: sprint.
- `Space`: jump.
- Pointer interaction with the contextual paint palette when visible.

Focused interactive DOM controls retain native keyboard accessibility. Global/game keyboard handling must ignore interactive elements as established by the shared input foundation.

## Mobile controls

Mobile is first-class from the golden slice.

Use the approved minimal dual-zone layout:

- left thumb: translucent movement stick/control;
- right gameplay surface: drag to look;
- compact right-thumb sprint button;
- compact right-thumb jump button;
- contextual paint palette near the bottom when hiding is relevant.

When the paint palette is active, simplify/reposition nearby action controls as needed to prevent overlap while preserving movement.

Requirements:

- Pointer Events for shared touch/pointer behavior;
- practical 44px+ targets where applicable;
- safe-area support;
- no hover dependency;
- simultaneous movement + camera/sprint/jump must work;
- pointer cancellation/focus changes must not leave stuck input;
- landscape is the primary handheld gameplay orientation for the golden slice.

## Loading and lifecycle

Launching School Escape should show an intentional lightweight branded loading state while Babylon and the immediate golden-slice assets initialize. Never leave the player on a blank/frozen canvas.

Only assets required for the current slice should block initial play. Do not preload deferred full-game areas.

Required lifecycle behavior:

- route unmount disposes Babylon scene/engine resources owned by the game;
- visibility loss pauses nonessential simulation/render/audio work;
- return from a hidden tab clamps/reset frame timing so the player does not teleport or receive a giant simulation step;
- focus/pointer cancellation clears held input;
- resize/orientation updates canvas/camera/HUD safely;
- audio resumes only after browser/user-gesture policy permits it;
- retry reconstructs clean gameplay state without stale suspicion, velocity, camera, animation, timers, or audio layers.

If Babylon/WebGL initialization or a required asset fails, show a clear recoverable error with Retry and Return to Games rather than silently failing.

## Performance and adaptive quality

Performance is a product requirement, not a post-polish optimization pass.

### Runtime isolation

- Babylon and School Escape assets must remain lazy-loaded off unrelated routes.
- Keep per-frame simulation/render state outside React.
- Avoid unbounded per-frame allocations.
- Reuse meshes/materials/instances where it materially helps without making the asset pipeline opaque.
- Bound particles, dynamic lights, shadow casters, audio emitters, and retained effects.

### Quality tiers

Use a small automatic quality policy with at least high, medium, and low behavior. Candidate scalable knobs include:

- render resolution/device-pixel-ratio cap;
- shadow map resolution/softness and number of casters;
- secondary light detail;
- decorative props/particles;
- reflection/material detail;
- number of simultaneous ambient audio emitters.

Gameplay-critical collision, landmarks, hideable surfaces, teacher readability, UI, voice/subtitles, and detection rules must not change across quality tiers.

Start from a conservative device capability estimate and allow the runtime to step down when sustained frame timing proves the current tier unstable. Prefer one-way downgrade/hysteresis during a play session over constant quality oscillation. A later implementation may cautiously step back up only after long stable evidence.

Target stable 60 FPS on capable hardware and stable degraded play (preferably 30+ FPS) on representative lower-powered devices. Stable lower fidelity is better than unstable high fidelity.

Mobile validation must include sustained-session heat/thermal behavior, not only the first minute.

## Error handling and degradation

The golden slice should fail gracefully:

- unsupported/failed graphics initialization -> clear fallback UI, retry/return actions;
- individual optional decorative asset failure -> omit/fallback without blocking play where safe;
- required character/level asset failure -> fail the launch clearly rather than play a broken scene;
- audio autoplay restriction -> continue silently until user gesture enables audio;
- context/focus interruption -> pause/reset input rather than continue unseen;
- low sustained performance -> reduce quality before allowing severe frame collapse.

Do not add a telemetry/analytics system solely to support these behaviors.

## Testing strategy

Automated tests remain necessary but cannot approve the visual/game-feel gate.

### Unit tests

Prioritize deterministic coverage for:

- pigment mixing formula and invariants;
- perceptual color-match scoring;
- camouflage eligibility/effectiveness;
- teacher perception accumulation/decay;
- teacher state transitions;
- chase-to-search/recovery behavior;
- catch and golden-slice completion transitions;
- player-vs-teacher speed relationship;
- quality-tier policy decisions/hysteresis;
- lifecycle/input reset helpers.

### React/UI tests

Cover:

- contextual palette visibility rules;
- no numeric RGB/debug-state exposure;
- reset/clean paint action;
- mobile control availability/layout semantics;
- caught/retry/loading/error states;
- lazy/unlisted route behavior as implemented.

### Integration/build validation

Required repository gate:

```bash
npm test
npm run lint
npm run build
```

Verify the production build keeps Babylon/School Escape out of unrelated initial routes and inspect the resulting chunk/asset impact.

### Real gameplay validation

Required before the golden-slice PR is considered complete:

- desktop Chromium keyboard/mouse;
- desktop Firefox where practical;
- iPhone Safari landscape;
- Android Chrome landscape where practical;
- representative lower-powered laptop/device;
- movement responsiveness and turn feel;
- camera orbit, recentering, wall occlusion, and sprint framing;
- player/teacher animation transitions;
- first near-miss clarity without developer explanation;
- paint mixing discoverability/readability;
- multiple wall colors and match fairness;
- suspicion readability;
- chase pressure and successful line-of-sight break/re-hide;
- touch simultaneous input;
- orientation/resize;
- fullscreen/focus where applicable;
- tab hide/restore;
- pause/resume and pointer cancellation;
- retry state cleanliness;
- frame stability and sustained mobile thermal behavior;
- loading and graphics/asset failure behavior where feasible.

Record manual coverage and gaps in the PR.

## Golden-slice acceptance gate

Do not expand School Escape beyond this slice until the following are true:

- Moving the player and controlling the camera feels genuinely good even before considering the stealth mechanic.
- The classroom/hallway/locker bay reads as an authored stylized school rather than a geometry prototype.
- The player and teacher read as coherent animated characters.
- Lighting establishes the warm-classroom/cool-hallway contrast without making navigation muddy.
- The camouflage interaction is understandable without RGB values, percentages, or a tutorial panel.
- Clothing color changes look intentional and remain readable during gameplay.
- The scripted near-miss teaches the stealth rule fairly.
- Suspicion, chase, search, and recovery are understandable through world/audio feedback plus minimal contextual UI.
- The teacher is threatening but escapable; a successful break-LOS/re-hide sequence works.
- Desktop and mobile controls both feel intentional rather than one being a fallback for the other.
- The continuous adventure soundtrack and environmental audio support the tone without becoming repetitive or masking gameplay cues.
- The experience remains stable across resize, orientation, focus, visibility, retry, and route lifecycle changes.
- Adaptive quality preserves readable gameplay and acceptable frame stability on representative lower-powered hardware.
- `npm test`, `npm run lint`, and `npm run build` pass.
- Hands-on player review explicitly approves the slice as the visual/experiential bar for the rest of School Escape.

Passing automated checks without the final hands-on quality approval is not enough.

## Full-game direction after the golden slice

Only after the golden slice passes should follow-on Issues expand the game toward Issue #16’s complete arc.

Likely later slices include:

1. Expand the school into the fixed readable escape route using the proven art/camera/stealth language.
2. Add the complete outdoor cinematic sprint home, with camouflage disabled and stronger chase music/camera framing.
3. Add the stylized principal-office fail cutscene: normal-looking red-faced principal, dramatic desk/gesture/camera treatment, concise yelling beat, and quick retry.
4. Complete win/replay flow, catalog presentation, final mobile/performance tuning, and stranger-ready validation.

The outdoor finale remains a player-controlled sprint rather than a mostly scripted cutscene. The principal scene remains stylized dramatic rather than comedic or full horror.

## Disposition of Issue #16 and PR #17

After this written design receives final review approval:

- Keep Issue #16 as the parent complete-game outcome, but revise its implementation language/acceptance criteria to reflect the Babylon.js stylized-realism direction and golden-slice quality gate.
- Create one focused golden-slice Issue as the next executable contract.
- Start its implementation branch from current `main`, not from `feature/school-escape`.
- Close draft PR #17 as **superseded**, not as a failed effort. Its mechanics prototype remains useful historical evidence/reference.
- Salvage deterministic/gameplay ideas from PR #17 where they still fit, but do not transplant its renderer, cube-character/world construction, debug HUD, or custom-WebGL scene architecture.
- Do not merge PR #17 merely to preserve its work; GitHub already preserves the branch/PR history.

## Design decisions intentionally locked

The following are no longer open questions for the golden slice:

- Stylized realism rather than photorealism or cartoon/chibi art.
- Creepy and tense rather than full horror.
- Tight polished third-person adventure camera.
- Stylized adventure-hero player proportions.
- Normal-looking teacher with an unnatural red face.
- Art classroom -> hallway -> locker bay as the first environment.
- Warm sunset classroom / cooler fluorescent hallway lighting.
- Contextual five-pigment paint palette: red, yellow, blue, white, black.
- Paint changes the outfit, not the player’s skin/hair.
- Minimal world-first HUD.
- Subtle contextual teacher-alert feedback.
- Environmental navigation rather than persistent waypoints.
- Responsive adventure movement rather than heavy animation-driven control.
- Minimal dual-zone mobile controls.
- Continuous adventure soundtrack with dynamic danger intensity.
- Adaptive quality tiers.
- Babylon.js standard engine/runtime, with WebGL compatibility baseline and no WebGPU requirement.
- Small custom authored asset set instead of broad premade packs or primitive-only visible art.
- Golden-slice-first implementation instead of another full-game-first rewrite.

Any future change to one of these should be justified by real playtest/performance evidence and reflected in the design before implementation diverges.