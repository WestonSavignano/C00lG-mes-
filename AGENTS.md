# Cool Games Plus Repository Working Agreement

This file is the operational guide for engineers and AI agents working in this repository. For product direction and stage gates, read [`ROADMAP.md`](ROADMAP.md). For current implementation state, GitHub `main`, open Issues, open/recent Pull Requests, and Actions are authoritative.

## Start with current GitHub state

Before making current-state claims or starting substantive work:

1. Read `README.md` and `ROADMAP.md`.
2. Inspect current `main`, open Issues, open/recent PRs, and relevant branch relationships.
3. Read the relevant implementation and any applicable design under `docs/superpowers/specs/`.
4. Base normal work on current `main` unless a deliberate stacked PR requires another base.

Do not rely on stale chat history when GitHub can resolve the question. Do not use Codex or a workflow that consumes Codex usage unless the user explicitly requests it.

## Repository boundaries

- `src/styles/tokens.css` — source of truth for the site reference palette, semantic site tokens, and genuinely global spacing/type/elevation/motion/shell dimensions.
- `src/shell/` — application shell and global navigation. It owns site-level chrome, route-mode presentation, and shared navigation semantics.
- `src/pages/` — route/page composition. Keep pages thin; move stable product concepts to the appropriate shell, discovery, game, or shared boundary.
- `src/games/catalog/` — authoritative game registry, discovery metadata, and lazy route registration. Do not put simulation constants or engine internals here.
- `src/games/discovery/` — Home/Games discovery UI and convenience state such as recent games. Discovery must not eagerly import game runtimes.
- `src/games/<game>/` — game-specific rendering, simulation, mechanics, assets, controls, and lifecycle adapters. Keep each game isolated.
- `src/games/shared/` — genuinely reusable game/runtime infrastructure such as viewport/fullscreen behavior and Phaser lifecycle helpers. Share stable behavior, not speculative abstractions.
- `src/networking/` — reusable party/transport/authority foundations. Until #21, `src/networking/room/` still implements the current coordinator-backed production flow; new target work follows the September 14 client-only networking spec rather than extending coordinator ownership.
- `src/chat/` — Chat-specific protocol, moderation integration, and client/controller behavior built on networking. Do not put generic party transport/authority or game simulation here.
- `api/chat/` — current Vercel Function coordinator entrypoints only. These remain live production code until #21 replaces the coordinator; do not add new target architecture here.
- `server/chat/` — current server-side coordinator authorization/storage/signaling helpers. Historical/current-runtime boundary until #21, not the approved future party authority layer.
- `src/moderation/` — client-side moderation support. Do not check moderation vocabulary or secrets into this public repository.
- `docs/superpowers/specs/` — deeper product/architecture designs for decisions that genuinely need a durable design record.
- `docs/superpowers/plans/` — implementation plans/history for larger designed changes; do not create a plan for every tiny task.

Preserve the dependency direction: application shell/discovery may describe and launch games, but should not know game internals. Game runtimes should not know how global navigation works. Networking is reusable infrastructure; Chat and future multiplayer game protocols build on it rather than duplicating transport/party behavior.

Site styling follows `brand/reference palette -> semantic site tokens -> shell/discovery/shared site UI`. Site components should consume semantic tokens from `src/styles/tokens.css`, not palette tokens or hue-named aliases. Individual game artwork and runtime palettes remain game-owned; do not recolor them to match the site shell unless the game's own design calls for it.

Important current design references:

- `docs/superpowers/specs/2026-09-14-client-only-host-authoritative-networking-design.md` — approved target networking architecture; not production until #21 lands.
- `docs/superpowers/specs/2026-09-08-webrtc-chat-networking-design.md` — explicitly superseded future design; retained as current coordinator implementation history until #21.
- `docs/superpowers/specs/2026-09-10-mobile-first-arcade-shell-design.md`
- `docs/superpowers/specs/2026-09-11-shared-semantic-input-design.md`

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

Pull requests to `main` and pushes to preferred work branches (`feature/**`, `fix/**`, `perf/**`, `docs/**`) run the same gate in GitHub Actions. This allows GitHub-only workflows to validate a branch before opening a PR.

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

Networking changes additionally require relevant real-browser/network validation; do not claim browser, NAT, reconnect, mobile-lifecycle, relay, or TURN coverage that was not actually exercised.

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

### Current versus target architecture

Until #21 lands, production Chat still uses the Vercel/Upstash coordinator implemented under `src/networking/room/`, `api/chat/`, and `server/chat/`. Do not silently remove/bypass that production path from unrelated work.

The approved target is defined by `docs/superpowers/specs/2026-09-14-client-only-host-authoritative-networking-design.md`: a **browser-hosted authoritative listen server** with one active host, passive guests, Trystero/Nostr public rendezvous, direct host-star WebRTC application traffic, host-local IndexedDB authority, and no C00lG@mes+-owned dynamic application backend.

Do not call the target “zero infrastructure.” Public Nostr relays and STUN are third-party infrastructure dependencies.

### Trust and authority rules

Treat remote clients and every network payload as untrusted.

- Validate serialized size before parse where practical, then protocol generation/version, type/shape, identity/authorization, sequence, domain constraints, and reasonable rate before acting.
- Never trust a guest to provide canonical player/member/Chat identity, score, outcome, or authoritative game state.
- Keep durable application identity separate from transient Trystero/WebRTC peer identity.
- Guests send intents/requests; the authoritative host validates/canonicalizes and assigns canonical identity/order/state.
- Durable party/Chat/control mutations must persist successfully before canonical broadcast when the target architecture requires durability.
- Guest replicas/caches converge from host authority; never merge stale guest state into the host.
- Removed members remain removed after reconnect/restore; locking blocks new admission but does not invalidate legitimate existing member credentials.
- Bind each canonical member to at most one current transport; reconnect may replace transient transport identity without changing application identity.
- Production browser-host authority must enforce one same-origin host writer per party. Follow the Web Lock/single-writer contract in the target spec; do not invent distributed host election.
- Missing/corrupt/unavailable canonical host storage fails closed. Guest state is never a replacement authority.

### Party/control versus real-time game networking

Do not turn Chat's reliable synchronization pattern into a universal game protocol.

The shared **party/control plane** may own reliable ordered membership/authentication/control, Chat, bounded canonical event sequencing, reconnect cursors, delta replay, snapshot recovery, and deliberately durable checkpoints.

Each multiplayer game owns its **real-time plane**: simulation ticks, input messages, snapshots, ordering/reliability choice, prediction, reconciliation, interpolation, lag handling, and game-specific checkpoints where actually needed. High-frequency simulation remains in memory; do not persist every frame.

Share stable party/transport/authority concepts only after real consumers need them. Do not build a speculative generic multiplayer/netcode framework.

### Product boundary

The browser listen-server model is approved for Chat/private parties and near-term small casual/co-op multiplayer. It is not a permanent mandate for future ranked/public/persistent games.

If a future game needs platform-trusted outcomes, valuable persistent progression, public matchmaking, host-independent availability, larger rooms, or connectivity/fairness beyond this model, reopen the dedicated authoritative-server decision rather than piling complexity onto peer hosting. Colyseus is the first TypeScript dedicated-game-server framework to evaluate at that future evidence gate; it is not a current dependency.

### Lifecycle and connectivity

Design for disconnects, reconnects, stale transport/state, latency, duplicate/out-of-order messages where applicable, malformed input, mobile background/sleep, and browser process termination.

Host availability is party availability in v1. Permanent host disappearance/storage loss ends the party; host migration/election is deliberately deferred.

TURN remains evidence-gated. Do not add TURN merely because general WebRTC deployments commonly use it, and do not claim direct connectivity is universal because the POCs succeeded on tested paths.

### Secrets and privacy

Never commit credentials, tokens, private keys, private moderation terms, `.env` contents, or other secrets. Avoid logging URL fragments, rendezvous/admission capabilities, member secrets, host private key material, or credential verifiers.

Current server secrets remain server-only until their production dependency is removed; do not expose them through `VITE_*` variables. Target browser credentials/capabilities are intentionally browser-local/bearer material and must follow the target spec's separation/handling rules.

Before adding accounts, persistent identifiers, behavioral analytics/ads, broad third-party SDKs, or expanded peer communication/moderation surfaces, explicitly reassess privacy/COPPA/California requirements appropriate to the site's family audience.

## Labels and milestones

Keep metadata small. Reuse existing equivalent labels rather than creating synonyms. The intended small vocabulary is `feature`, `bug`, `performance`, `game`, `platform`, `networking`, `needs-playtest`, and `blocked`; do not add per-game labels, story points, elaborate priorities, or release taxonomies without evidence they are needed.

Use one active milestone for the current roadmap stage. Do not pre-create future roadmap stages as milestones.

## Documentation discipline

`ROADMAP.md` contains durable direction, stage gates, evidence, and intentional deferrals. Issues contain executable work. PRs contain implementation and validation history.

Create deeper specs or architectural decision records only when a decision is expensive to reverse or too nuanced to live safely in an Issue/PR. Keep repository documentation current when the implementation meaningfully changes its source of truth.
