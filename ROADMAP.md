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

**Stage 0 — Studio Foundation**

As of September 11, 2026:

- the mobile-first discovery shell and typed game catalog are on `main` via PR #8;
- PR #9 contains the next immersive game-shell slice and remains open;
- the shared semantic input/touch foundation is still a deliberate follow-up rather than merged infrastructure;
- PR #10 adds Fart Attack but remains open;
- PR #6 adds the Bodi Island vertical slice and currently needs branch/diff reconciliation before it is merge-ready;
- the repository already has a test/lint/build Actions gate, but the durable Issue/roadmap/PR operating model is only now being formalized;
- current open stacked branches need cleanup discipline because PRs #9 and #10 still target the already-landed discovery branch rather than `main`.

Stage 0 is not complete until the shell, shared gameplay foundations, GitHub workflow, and branch state are stable enough that future work can focus on individual game quality rather than repeatedly re-solving platform/process fundamentals.

## Stage 0 — Studio Foundation

### Goal

Finish the mobile-first arcade foundation and establish the lightweight repository operating model.

### Evidence required to exit

- Mobile-first discovery and immersive game-shell architecture are merged and manually validated on representative phone and desktop browsers.
- Shared semantic input/touch infrastructure exists at the right reusable boundary so games do not need to reinvent common mobile control primitives.
- `ROADMAP.md`, `AGENTS.md`, one default Issue Form, and one concise PR template are in use.
- One current milestone groups the small number of Issues needed to finish Stage 0.
- New work normally starts from an Issue and current `main`; stacked PRs are deliberate, documented, retargeted after their base lands, and re-audited before merge.
- `npm test`, `npm run lint`, and `npm run build` remain green for merge candidates.
- Player-facing changes include real gameplay/manual validation, including mobile/touch and lower-powered-device performance where relevant.
- No known shell/process blocker forces individual game teams to duplicate navigation, viewport, input, or workflow fundamentals.

### Current risks

- The immersive shell and semantic input foundation are not yet fully landed.
- Current open PRs show branch-base drift that can make stacked diffs misleading.
- Game input quality is uneven: the catalog on `main` still describes the existing games as keyboard-driven.
- Visual ambition can outpace lower-end performance unless every game treats frame stability as a release constraint.
- The repository is public, so roadmap and design documentation should remain useful without exposing secrets or unnecessarily sensitive commercial detail.
- GitHub Pages deployment remains configured even though `README.md` identifies Vercel as the deployment target; its ongoing purpose should be confirmed before changing or removing it.

## Stage 1 — Distribution-Ready Game

### Goal

Choose one existing game and bring it to a genuine stranger-ready release bar.

Do not select a winner only because it is newest or easiest to modify. Evaluate actual current gameplay, technical fit, mobile readiness, differentiation, and polish potential.

The current candidate set to evaluate includes Donut Run, Worm Battles, and Neon Drift from `main`, plus Fart Attack if/when its PR lands and passes real playtesting. No Stage 1 game is selected yet.

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
- speculative hosting migration;
- portal SDK integrations before a selected distribution experiment needs them;
- large multiplayer/matchmaking systems, TURN, anti-cheat, spectators, or persistent accounts before real network/gameplay evidence requires them;
- broad shared abstractions created only in anticipation of future games.

When evidence changes, update this roadmap first, then create the small set of Issues needed for the current stage.
