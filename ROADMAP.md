# Cool Games Plus Roadmap

This roadmap defines durable product/business direction and evidence gates. It is deliberately not a backlog and not a calendar commitment.

Executable work belongs in GitHub Issues. The current execution horizon belongs in one active GitHub Milestone. Pull Requests implement and validate Issues.

## North Star

Build Cool Games Plus into a premium boutique browser arcade and browser-game studio: a small portfolio of genuinely fun, polished, mobile-first games that run well on lower-end hardware, earn sustainable recurring revenue, and strengthen the Cool Games Plus brand.

Optimize in this order:

1. player enjoyment and retention;
2. sustainable revenue;
3. game quality and differentiation;
4. low operational burden;
5. scalability across multiple games;
6. control of the Cool Games Plus brand;
7. performance on lower-end hardware;
8. simple, durable architecture and process.

Visual polish and performance are both product requirements.

## Business and product thesis

Build excellent independently monetizable browser games, maintain Cool Games Plus as the canonical premium arcade, and distribute selected games through external platforms such as CrazyGames to acquire audience and revenue.

Use external distribution to learn whether strangers choose and keep playing the games before investing heavily in owned-site acquisition or monetization infrastructure.

Do not build speculative platform systems ahead of evidence.

## Current stage

**Stage 0 — Studio Foundation** remains the current formal roadmap stage until an explicit stage-transition decision is made. Its major shared application foundations are now substantially landed.

As of **September 14, 2026**:

- the mobile-first discovery shell and typed/lazy game catalog are on `main` via PR #8;
- the immersive shared game-page shell is on `main` via PR #9;
- the shared semantic input/touch foundation is on `main` via PR #15 and is already consumed by multiple games;
- the lightweight GitHub Issue/branch/PR operating model is on `main` via PR #12;
- GitHub Pages deployment has been removed via PR #25; Vercel remains the current live host until the AWS cutover and is intended to remain afterward as staging rather than canonical production;
- Monster Color Rush is on `main` via PR #30, while older/open game branches such as Bodi Island/Fart Attack still require normal current-main reconciliation before any future merge;
- the durable site palette/token boundary is on `main` via PR #36;
- networking feasibility Issue #18 / PR #24 concluded **PROCEED WITH CONSTRAINTS** for active-host/passive-guest Trystero/Nostr rendezvous and direct WebRTC without an owned signaling backend on tested paths;
- host-authority Issue #19 / PR #35 concluded **PROCEED WITH CONSTRAINTS** for host-local IndexedDB authority, deterministic replay/snapshot recovery, durable lock/removal state, and fail-closed storage;
- production `/chat` still uses the existing Vercel Functions + Upstash Redis coordinator until #21 replaces it;
- the current networking/hosting execution chain is **#20 architecture -> #21 production client-only Chat migration -> #22 static AWS foundation -> #23 `coolgamesplus.com` cutover/Vercel staging transition**;
- no Stage 1 distribution-ready game has been formally selected yet.

Stage 0 should not be described using stale open-PR assumptions from September 11. Remaining foundation work should be judged from current `main`, current Issues/PRs, real product validation, and the explicit platform sequence below.

## Current networking and hosting sequence

This sequence is evidence-backed planned work, not speculative infrastructure and not current production state.

### #20 — Client-only networking architecture

Turn the #18/#19 evidence into one durable target architecture and remove contradictory future documentation.

Approved direction:

- browser-hosted authoritative listen server;
- one active host plus passive guests in a bounded host-star party;
- guests are untrusted and send intents/requests rather than canonical state;
- direct WebRTC application traffic;
- public Trystero/Nostr rendezvous;
- host-local IndexedDB canonical authority and browser-local guest credentials/cursors;
- no C00lG@mes+-owned dynamic application backend for the approved target;
- no TURN until evidence says the supported connectivity envelope requires it;
- host availability/storage is party availability in v1; no host migration/election.

This model is approved for Chat/private parties and near-term small casual/co-op multiplayer. It is not a permanent mandate for future ranked/public/persistent games. If future requirements demand platform-trusted outcomes, valuable persistent progression, public matchmaking, host-independent availability, materially larger rooms, or stronger connectivity/fairness guarantees, reopen the dedicated authoritative-server decision rather than accumulating peer-hosting complexity.

### #21 — Production Chat migration

Replace the current Vercel/Upstash coordinator with the approved #20 browser-hosted architecture. #21 is the production proof that the site can operate Chat/private parties without `/api/chat/*`, Redis, or another C00lG@mes+ dynamic application backend.

This requires deterministic tests plus real-browser/network/lifecycle validation. Do not infer universal WebRTC reliability from the POCs.

### #22 — Static AWS production foundation

Only after #21 removes the production dynamic-backend dependency, provision and validate the static AWS target:

- Route 53;
- CloudFront;
- private S3 origin;
- GitHub Actions deployment through AWS OIDC;
- no application Lambda/API/database merely to reproduce the removed coordinator.

`coolgamesplus.com` is the planned canonical domain, but #22 does not cut production DNS over.

### #23 — Canonical-domain cutover

After #22 is fully validated, cut `coolgamesplus.com` over to the static AWS distribution, validate the complete player experience, prove rollback/redeploy behavior, and transition the existing Vercel project from the current live host to staging while retiring obsolete Vercel Functions/Upstash/backend and production-ownership assumptions.

AWS/static hosting is therefore the **planned production target**. Vercel remains the **current live host** until #23; after cutover, AWS/`coolgamesplus.com` is canonical production and the existing Vercel project remains staging, with automatic Git deploys restricted to `main` by #45.

## Stage 0 — Studio Foundation

### Goal

Finish the mobile-first arcade foundation and establish the lightweight repository operating model so future game work does not repeatedly re-solve shell, input, workflow, networking, or deployment fundamentals.

### Evidence required to exit

- Mobile-first discovery and immersive game-shell architecture are merged and appropriately validated on representative phone/desktop browsers.
- Shared semantic input/touch infrastructure exists at the right reusable boundary so games do not need to reinvent common mobile control primitives.
- `ROADMAP.md`, `AGENTS.md`, one default Issue Form, and one concise PR template are in use.
- One current milestone groups the small number of Issues needed to finish the current foundation horizon.
- New work normally starts from an Issue and current `main`; stacked PRs are deliberate, documented, retargeted after their base lands, and re-audited before merge.
- `npm test`, `npm run lint`, and `npm run build` remain green for merge candidates.
- Player-facing changes include real gameplay/manual validation, including mobile/touch and lower-powered-device performance where relevant.
- Networking/Chat changes include real browser/network/lifecycle validation and honest documentation of the supported direct-connect envelope.
- No known platform/process blocker forces individual game teams to duplicate navigation, viewport, input, workflow, party identity, or other genuinely shared foundations.

### Current risks

- The approved client-only networking architecture is not production until #21 lands; current Chat still depends on Vercel/Upstash.
- Public Nostr/STUN are third-party infrastructure with no C00lG@mes+ SLA, and passive rendezvous can introduce noticeable join/reconnect latency.
- TURN is intentionally absent; restrictive networks may fail direct WebRTC until evidence justifies a relay decision.
- Browser-host availability, background suspension, device sleep, and browser-local storage are explicit party-availability constraints.
- Older/open branches can drift from current `main`; reconcile their effective diffs before considering merge.
- Game input/quality remains uneven across the catalog even though the shared semantic-input foundation is now available.
- Visual ambition can outpace lower-end performance unless every game treats frame stability as a release constraint.
- The repository is public, so roadmap/design documentation should remain useful without exposing secrets or unnecessarily sensitive commercial detail.

## Stage 1 — Distribution-Ready Game

### Goal

Choose one existing game and bring it to a genuine stranger-ready release bar.

Do not select a winner only because it is newest or easiest to modify. Evaluate actual current gameplay, technical fit, mobile readiness, differentiation, and polish potential.

Evaluate the actual current catalog/main state when selecting the Stage 1 game; do not preserve a stale hard-coded candidate list as games land or are superseded.

### Evidence required to exit

The selected game demonstrates, through real-device/browser playtesting:

- immediate first-session clarity without developer explanation;
- responsive touch/mobile controls and strong desktop controls;
- clear feedback, game feel, failure/restart flow, and replay motivation;
- stable behavior across orientation, focus/fullscreen, resize, pause/resume/interruption, and storage/loading failures that apply to the game;
- acceptable frame stability on representative lower-powered hardware;
- bounded render/update cost during longer sessions;
- portal-ready title, artwork, instructions, metadata, and presentation;
- resilient loading and local persistence where used;
- no known high-severity gameplay or usability blocker.

Stage 1 exits with one game that we would be comfortable putting in front of strangers without standing beside them.

## Stage 2 — External Validation

### Goal

Run one low-risk distribution experiment, initially favoring a platform such as CrazyGames Basic Launch.

Primary question:

> Will strangers choose the game and continue playing it?

### Evidence required to exit

Before launch, define the specific metrics available from the chosen distributor and the minimum observation window/sample needed to make a decision.

Exit when the experiment has enough external-player evidence to make one of three explicit decisions:

- **advance** — engagement/replay evidence justifies monetization work;
- **iterate** — the game shows promise but specific experience problems need another test;
- **stop/pivot** — evidence does not justify more investment in this game.

Do not build a large monetization or analytics platform merely to run this experiment.

## Stage 3 — First Revenue

### Goal

For a game that earned external validation, add the minimum monetization integration needed to generate real revenue without damaging the play experience.

### Evidence required to exit

- real post-fee revenue is recorded;
- monetization does not introduce a material gameplay, loading, frame-rate, or retention regression;
- operational work remains small enough to sustain;
- the game still meets its stranger-ready quality bar after monetization.

## Stage 4 — Repeatable Portfolio

### Goal

Prove that the workflow is repeatable across multiple games rather than a one-game success.

### Evidence required to exit

- multiple games have independently completed the distribution-ready and external-validation path;
- at least two games produce recurring revenue across multiple measurement periods;
- shared studio infrastructure reduces repeated work without forcing materially different games into inappropriate abstractions;
- adding/polishing another game is primarily game work, not platform reconstruction.

## Stage 5 — Owned Arcade Growth

### Goal

Invest more heavily in Cool Games Plus direct acquisition, retention, SEO, sharing, and owned audience only after the external-game thesis has evidence.

### Evidence required to exit

- external distribution has proven that at least part of the portfolio can attract and retain strangers;
- owned-site acquisition experiments show measurable growth in qualified play sessions;
- return/replay behavior on the owned arcade is strong enough to justify continued acquisition investment;
- SEO/content/sharing work is tied to observed player demand rather than generic traffic volume.

## Stage 6 — Owned Monetization / Studio Scale

### Goal

Scale the studio and consider direct-site monetization only when traffic and player behavior justify the operational and UX cost.

Potential options include direct-site ads, sponsorships, licensing, premium/ad-free offerings, and other partnerships. Each should be tested as a bounded business experiment rather than added as permanent platform complexity by default.

### Evidence of success

- owned and/or distributed games generate durable recurring revenue;
- monetization quality is measured alongside retention and player experience;
- the portfolio can grow without disproportionate operational load;
- platform investments are driven by repeated needs observed across successful games.

## Intentionally deferred

Until evidence changes the priority, defer:

- GitHub Projects, epics, story points, sprint rituals, and elaborate priority taxonomies;
- accounts, achievements, stores, virtual currency, feeds, or other generic gaming-platform systems;
- large first-party monetization infrastructure before a game earns external validation;
- direct-site advertising before owned traffic justifies it;
- portal SDK integrations before a selected distribution experiment needs them;
- TURN until supported-network evidence shows the player value justifies relay cost/privacy/operations;
- host migration/election, CRDT/general distributed-state infrastructure, large-room/spectator architecture, or public matchmaking before real product evidence requires them;
- dedicated authoritative game servers while the approved browser-host model remains sufficient for current private casual/co-op requirements; reopen rather than force the model when explicit reversal triggers appear;
- broad shared abstractions created only in anticipation of future games.

The static AWS sequence in #22/#23 is **not** a speculative deferral; it is approved planned work behind successful production networking migration in #21.

When evidence changes, update this roadmap first, then create the small set of Issues needed for the current stage.
