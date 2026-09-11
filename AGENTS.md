# C00lG@mes+ Repository Working Agreement

This file is the operational guide for engineers and AI agents working in this repository. For product direction and stage gates, read [`ROADMAP.md`](ROADMAP.md). For current implementation state, GitHub `main`, open Issues, open/recent Pull Requests, and Actions are authoritative.

## Start with current GitHub state

Before making current-state claims or starting substantive work:

1. Read `README.md` and `ROADMAP.md`.
2. Inspect current `main`, open Issues, open/recent PRs, and relevant branch relationships.
3. Read the relevant implementation and any applicable design under `docs/superpowers/specs/`.
4. Base normal work on current `main` unless a deliberate stacked PR requires another base.

Do not rely on stale chat history when GitHub can resolve the question. Do not use Codex or a workflow that consumes Codex usage unless the user explicitly requests it.

## Repository boundaries

- `src/shell/` — application shell and global navigation. It owns site-level chrome, route-mode presentation, and shared navigation semantics.
- `src/pages/` — route/page composition. Keep pages thin; move stable product concepts to the appropriate shell, discovery, game, or shared boundary.
- `src/games/catalog/` — authoritative game registry, discovery metadata, and lazy route registration. Do not put simulation constants or engine internals here.
- `src/games/discovery/` — Home/Games discovery UI and convenience state such as recent games. Discovery must not eagerly import game runtimes.
- `src/games/<game>/` — game-specific rendering, simulation, mechanics, assets, controls, and lifecycle adapters. Keep each game isolated.
- `src/games/shared/` — genuinely reusable game/runtime infrastructure such as viewport/fullscreen behavior and Phaser lifecycle helpers. Share stable behavior, not speculative abstractions.
- `src/networking/` — reusable room and WebRTC transport foundations.
- `src/chat/` — Chat protocol and client/controller behavior built on the networking layer.
- `api/chat/` — Vercel Function entrypoints only.
- `server/chat/` — shared server-side room coordination, authorization, storage, and signaling helpers. Keep reusable server logic out of Vercel entrypoint files.
- `src/moderation/` — client-side moderation support. Do not check moderation vocabulary or secrets into this public repository.
- `docs/superpowers/specs/` — deeper product/architecture designs for decisions that genuinely need a durable design record.
- `docs/superpowers/plans/` — implementation plans/history for larger designed changes; do not create a plan for every tiny task.

Preserve the dependency direction: application shell/discovery may describe and launch games, but should not know game internals. Game runtimes should not know how global navigation works. Networking is reusable infrastructure; Chat and future multiplayer game protocols build on it rather than duplicating transport/room behavior.

Important current design references:

- `docs/superpowers/specs/2026-09-10-mobile-first-arcade-shell-design.md`
- `docs/superpowers/specs/2026-09-08-webrtc-chat-networking-design.md`

## Normal work boundary

Use this lightweight path:

`ROADMAP.md stage -> GitHub Issue -> focused branch -> Pull Request -> automated validation -> real product/gameplay validation -> merge`

One Issue should describe one coherent outcome that can normally be reviewed in one focused PR. Split work when it contains independent outcomes or unrelated systems.

### Branches

Start normal work from the current `main`.

Preferred names:

- `feature/<short-name>`
- `fix/<short-name>`
- `perf/<short-name>`
- `docs/<short-name>`

Stacked PRs are allowed only when deliberate. A stacked PR must identify its base/dependency in the PR body. After the base lands, retarget the child to `main` and re-audit the complete diff before merge.

Do not fold unrelated cleanup into a feature PR.

### Pull Requests

PRs should normally include `Closes #N` for their owning Issue and use `.github/pull_request_template.md`.

Prefer focused PRs that can be understood, validated, played/reviewed, and reverted independently. Squash merge is the normal preference for a focused PR unless preserving commit structure has a specific value.

Do not merge unless explicitly authorized.

## Validation

The repository validation gate is:

```bash
npm test
npm run lint
npm run build
```

Pull requests to `main` run the same gate in GitHub Actions.

Add or update tests when behavior changes. Favor deterministic tests for game logic, protocol validation, catalog/routing behavior, storage failure behavior, and shared infrastructure. Automated checks are necessary but not sufficient for gameplay, visuals, input, networking, or performance changes.

For player-facing work, manually validate the relevant scenarios in a real browser and, when practical, on real mobile hardware. Cover applicable cases such as:

- touch and mobile layout;
- keyboard/mouse controls;
- portrait/landscape and rotation;
- fullscreen and focus;
- pause/resume, tab hiding, and interruption recovery;
- resize and safe areas;
- accessibility and reduced motion where practical;
- game feel, feedback, replay/restart flow, and clarity;
- frame stability on lower-powered hardware.

Record the manual coverage and any gaps in the PR.

## Mobile and performance requirements

Mobile is a primary gameplay target, not a compatibility afterthought. Use Pointer Events for shared pointer/touch behavior, keep primary targets at least 44px where practical, preserve safe areas, and do not depend on hover.

Performance is a release requirement. Prefer techniques that scale down gracefully:

- lazy-load game runtimes and heavy assets;
- keep frame-by-frame simulation out of React state;
- cap/adapt device pixel ratio where the extra render cost is not justified;
- bound particles, entities, retained effects, and allocations in long sessions;
- pause nonessential work when hidden;
- respect `prefers-reduced-motion`;
- prefer stable 30+ FPS degradation over unstable attempts at 60 FPS, while targeting stable 60 FPS on capable hardware.

Any visually expensive effect should justify its player value and have a reasonable lower-end behavior.

## Networking and security

Treat remote clients and every network payload as untrusted.

- Validate message shape, version/type, identity/authorization, and reasonable size/rate before acting on it.
- Do not trust a remote sender to provide canonical player/chat identity or authoritative game state.
- Preserve the existing durable-room/disposable-connection/reconnect-generation model unless current evidence supports changing it.
- Design for disconnects, reconnects, stale signaling/state, latency, duplicate/out-of-order messages where applicable, and malformed input.
- Future multiplayer should retain host-authoritative state initially unless a reviewed design changes that direction.
- Keep Chat message traffic WebRTC-only under the current architecture; the coordinator is for membership/control and short-lived signaling.

Never commit credentials, tokens, private moderation terms, `.env` contents, or other secrets. Server secrets must remain server-only; do not expose them through `VITE_*` variables. Avoid logging or persisting room/member/invite credentials. Follow the current credential-handling design in `README.md` and the networking spec.

## Labels and milestones

Keep metadata small. Reuse existing equivalent labels rather than creating synonyms. The intended small vocabulary is `feature`, `bug`, `performance`, `game`, `platform`, `networking`, `needs-playtest`, and `blocked`; do not add per-game labels, story points, elaborate priorities, or release taxonomies without evidence they are needed.

Use one active milestone for the current roadmap stage. Do not pre-create future roadmap stages as milestones.

## Documentation discipline

`ROADMAP.md` contains durable direction, stage gates, evidence, and intentional deferrals. Issues contain executable work. PRs contain implementation and validation history.

Create deeper specs or architectural decision records only when a decision is expensive to reverse or too nuanced to live safely in an Issue/PR. Keep repository documentation current when the implementation meaningfully changes its source of truth.
