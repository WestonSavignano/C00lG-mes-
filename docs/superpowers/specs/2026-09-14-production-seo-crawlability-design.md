# Cool Games Plus Production SEO and Crawlability Design

Date: 2026-09-14  
Status: Proposed for Issue #38 review  
Issue: #38 — Define production SEO and crawlability architecture for coolgamesplus.com

## Decision summary

Cool Games Plus should remain a static Vite/React application. Production SEO does **not** require SSR, Next.js, a CMS, an application server, or eager game rendering.

The production architecture is:

1. `https://coolgamesplus.com` is the sole canonical/indexable host.
2. The product has two primary public feature surfaces: **Games** and **Party**. Home remains the discovery/entry surface for both.
3. Vite still builds the client application and lazy game chunks.
4. The production build emits one route-specific HTML document for every known page route that must resolve directly, with route-correct metadata in the original HTML.
5. `/`, `/games`, `/party`, and published `gameCatalog` routes are indexable.
6. `/party` is the public, indexable explanation/entry surface for Cool Games Plus private group chat/party capability.
7. `/chat` remains the private room/session route and is `noindex`; private invite/capability fragments never become public page identity.
8. Networking POCs, diagnostics, and preview routes are functional but `noindex` and absent from the sitemap.
9. Deprecated Soundboard routes permanently redirect to `/party`; Soundboard is not a current product surface.
10. Unknown routes and missing assets return real 4xx responses; there is no production catch-all that turns every miss into HTTP 200 `index.html`.
11. React continues to render the application client-side. Selective/full content prerendering is deferred until crawler or performance evidence justifies its additional lifecycle/hydration complexity.
12. SEO generation reads only route metadata and the typed game catalog. It must never call `GameDefinition.loadPage`, import `gameRoutes.tsx`, or inspect browser/private room state.
13. #22 owns the CloudFront/S3 implementation of the request/status contract defined here. #23 owns canonical DNS cutover, `www` redirection, and retirement of legacy hosting.

This is deliberately a **static multi-document entry architecture around one client application**, not a server-rendered application.

## Current repository evidence

As of current `main` (`e39aff9401b181944ed22c294a82c487705ee31c` when this design was reconciled):

- `index.html` is one shared document with one plain `Cool Games Plus` title, production favicon/touch-icon declarations from #37, and no route-specific description, canonical, robots, or Open Graph metadata.
- `vercel.json` sends every non-file request to `/index.html`.
- `src/App.tsx` registers Home, Games, Chat, two networking POCs, published game routes, two legacy Soundboard redirects, and a client-rendered not-found page.
- `src/shell/navigation.ts` already presents the current social destination to players as **Party**, while routing that item to `/chat`.
- Soundboard is deprecated; it is no longer a product feature and survives only as legacy redirect compatibility.
- `src/games/catalog/gameCatalog.ts` already owns published game route, title, short description, category, artwork metadata, and lazy page loader.
- `src/games/catalog/gameRoutes.tsx` preserves lazy runtime loading with `React.lazy`.
- Home and Games render normal React Router links to catalog games, so the rendered application exposes crawlable `<a href>` navigation.
- the current NotFound component renders useful player-facing not-found content but, under the current blanket SPA fallback, an unknown direct request can still arrive as HTTP 200.
- current Chat capability/invite state lives in URL fragments such as `#room=...&invite=...`.
- the approved #20 target also deliberately keeps rendezvous/admission capabilities in URL fragments; for example, the target guest invite is conceptually `/chat#v=2&party=...&r=...&a=...&host=...`.
- #20 / PR #41 has landed and makes the browser-hosted client-only networking target authoritative for #21.
- #37 / PR #43 has landed and makes the naming convention and production brand assets authoritative: visual `C00lG@mes+`, plain/search `Cool Games Plus`, technical slug `coolgamesplus`, canonical domain identity `coolgamesplus.com`.
- #37's production assets are intentionally header/favicon/touch-icon derivatives; it does **not** establish Open Graph/share artwork.
- open PR #33 adds `/game-preview/school-escape`, confirming that unlisted preview routes are a real route class the production policy must handle.

Nothing in current repository evidence materially conflicts with Issue #38. The route split introduced by this design clarifies a product distinction the current navigation already implies: **Party is the public feature; Chat URLs are the private session mechanism**.

No changes to `README.md`, `AGENTS.md`, or `ROADMAP.md` are required by this design PR. Those files correctly describe current Vercel production, the approved naming convention, and the #21 -> #22 -> #23 migration sequence. This document describes the target SEO contract that later implementation work will realize.

## Product and naming contract

Use the merged #37 convention:

- visual/marketing brand: `C00lG@mes+`;
- plain/accessibility/search name: `Cool Games Plus`;
- technical slug: `coolgamesplus`;
- canonical origin: `https://coolgamesplus.com`.

Search-facing titles, descriptions, `og:site_name`, structured data, Search Console configuration, and other machine-readable naming use **Cool Games Plus**. Visible brand UI may continue to use `C00lG@mes+` where #37 specifies it.

### Public product hierarchy

The public product hierarchy is deliberately small:

- **Games** — the arcade/catalog and published game pages;
- **Party** — private small-group chat/party functionality and the future social/multiplayer entry surface.

Home may describe and link both product pillars, but Games and Party should each have their own durable canonical landing URL.

This matters for SEO and product clarity. A crawler or first-time visitor should be able to understand that Cool Games Plus is not only a browser-game catalog; it also provides a privacy-minimized browser-hosted party/group-chat capability.

### Canonical origin ownership

The canonical origin is a constant product identity. Metadata generation must never derive a canonical host from `window.location`, `VERCEL_URL`, a CloudFront distribution hostname, request headers, or another deployment-specific origin.

## Goals

- Give every production route an unambiguous crawler identity before JavaScript runs.
- Keep the application fully static and compatible with private S3 behind CloudFront.
- Preserve lazy game-runtime loading and current game isolation.
- Make Home, Games, Party, and published games easy to discover through normal links plus a deterministic sitemap.
- Give Party enough durable public content for crawlers and prospective players to understand the capability and why it is different.
- Keep actual room/invite URLs and capability-bearing state out of search and generated metadata.
- Prevent preview and diagnostic routes from becoming search landing pages.
- Eliminate blanket-success soft-404 behavior.
- Keep canonical, metadata, sitemap, redirects, and route publication policy small enough to understand without an SEO framework.
- Make later Search Console validation diagnostic rather than architectural discovery.

## Non-goals

- Runtime SSR or edge rendering.
- Next.js or another framework migration.
- A CMS or content-marketing platform.
- Full static React prerendering/hydration in this slice.
- Keyword stuffing or SEO-only duplicate game copy.
- Game-runtime execution during the build-time SEO pass.
- Indexing individual parties, rooms, invites, member state, or Chat history.
- Analytics, ads, accounts, personalization, or search advertising.
- AWS implementation owned by #22.
- DNS cutover owned by #23.
- Designing Open Graph artwork not established by #37.

## Rendering strategy decision

| Option | Crawler quality | Implementation complexity | Player/runtime performance | Maintainability | #22 static-host fit | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1. One-document SPA fallback | Adequate only after capable JS rendering; weak initial metadata; soft-404 risk | Lowest | Neutral | Simple until route/status correctness matters | Poor | Reject for production |
| 2. Build-time route-specific HTML metadata shells; React remains client-rendered | Strong route identity/head metadata; Google can render body JS; social/simple metadata consumers work | Low-moderate | Neutral; no extra runtime tier | Strong | Excellent | **Adopt** |
| 3. Selective/full static prerender of meaningful body content | Strongest no-JS body visibility | Moderate-high because of hydration/browser-state/lazy-runtime boundaries | Potentially better first paint if done correctly | More moving parts and drift risk | Compatible but more complex | Defer pending evidence |

### Option 1 — one-document SPA fallback

Current behavior is the cheapest implementation but the weakest production contract.

Advantages:

- minimal build complexity;
- no change to React rendering.

Costs:

- every direct route initially has the same document metadata;
- route identity depends on JavaScript execution;
- simple/social crawlers do not receive reliable route-specific metadata in the initial document;
- a blanket `/index.html` fallback makes unknown page URLs look successful and creates soft-404 risk;
- missing assets can be swallowed by an over-broad fallback;
- it conflicts with #22's stated requirement to distinguish application routes from real misses.

**Decision: reject for canonical production.**

### Option 2 — build-time route-specific HTML documents, React remains client-rendered

The build produces a document for each known page route. Each document has the correct title, description, canonical/indexing policy, and minimum social metadata in the original HTML, while all documents boot the same hashed client application.

Advantages:

- strong route identity without waiting for rendering;
- works for Google, simple metadata consumers, and social unfurlers;
- maps naturally to static S3 objects and CloudFront rewrites;
- no runtime server or rendering tier;
- no hydration contract to maintain;
- does not require importing game runtimes;
- small, deterministic build-time surface.

Costs:

- page body content still relies on the existing client render;
- build tooling must generate multiple documents and keep route policy tested.

Google currently renders JavaScript, and its guidance explicitly permits JavaScript-powered sites while still recommending clear titles, canonical URLs, crawlable links, and meaningful HTTP status codes. Route-specific original HTML removes the high-value metadata ambiguity without introducing a second UI-rendering architecture.

**Decision: adopt.**

### Option 3 — selective/full static prerender of Home, Games, Party, and game-page content

This can expose meaningful body content before JavaScript and may improve first-paint/crawler behavior.

Advantages:

- strongest no-JavaScript content visibility;
- potential initial-render performance benefits when the prerender exactly matches the hydrated application.

Costs in the current application:

- requires a real prerender/hydration contract or duplicate fallback markup;
- Home contains browser-local recent-game state;
- game routes intentionally contain lazy runtime boundaries that must not execute during static generation;
- Party/Chat behavior depends on browser/runtime state;
- full game runtime content is canvas/interactive content and gains little from server/static rendering;
- divergent static/client markup would create maintenance and accessibility risk;
- the current evidence does not show a Google rendering/indexing failure that justifies the complexity.

**Decision: defer.** The selected route-document generator should be structured so a future public route may add safe static body rendering, but no prerender framework belongs in the first production SEO implementation.

### Why Option 2 is the right current boundary

It solves the architectural risks that exist today—generic metadata, duplicate-host ambiguity, sitemap absence, and soft-404 semantics—without changing the application's rendering model. It also gives Party a first-class public crawler identity while keeping actual room state on a separate noindex route.

Search Console can then tell us whether selective prerendering would solve a real problem rather than an imagined one.

## Production route publication and indexing policy

### Indexable

The following return HTTP 200 and are indexable on the canonical host:

| Route class | Target route | Policy |
| --- | --- | --- |
| Home | `/` | `index,follow`; canonical required; sitemap |
| Games catalog | `/games` | `index,follow`; canonical required; sitemap |
| Party landing | `/party` | `index,follow`; canonical required; sitemap |
| Published games | every `gameCatalog[*].route` | `index,follow`; canonical required; sitemap |

At the current catalog state, the canonical URLs are:

- `https://coolgamesplus.com/`
- `https://coolgamesplus.com/games`
- `https://coolgamesplus.com/party`
- `https://coolgamesplus.com/games/plane-blaster`
- `https://coolgamesplus.com/games/donut-run`
- `https://coolgamesplus.com/games/neon-drift`
- `https://coolgamesplus.com/games/monster-color-rush`
- `https://coolgamesplus.com/games/worm-battles`
- `https://coolgamesplus.com/games/warrior`
- `https://coolgamesplus.com/games/warrior2`

Future published catalog games become indexable automatically when they enter `gameCatalog`; there is no second SEO-only game registry.

### `/party` — public, indexable product surface

`/party` is the canonical public page for the Party feature.

It should be useful even when the visitor has no room invite. The page should explain, in concise player-facing language:

- what Party is: private small-group chat/group-chat and the social entry point for Cool Games Plus;
- that rooms are invite-based rather than public feeds;
- that chat messages travel directly between participating browsers over WebRTC;
- that the browser host is the room authority under the approved #20/#21 target;
- that no account is required for the current product model;
- the supported small-party scope rather than implying unlimited public chat;
- the privacy model at a high level without exposing implementation secrets;
- a clear action to start a Party and, where appropriate, guidance for joining from an invite.

This is product content, not SEO filler. It should make sense to a player who reaches it from navigation, search, a shared link, or Home.

#### Truthful architecture copy

Search copy must describe **deployed behavior**, not planned architecture.

Until #21 has actually replaced the coordinator, public copy must not claim that Cool Games Plus has no application backend. It may truthfully explain current direct WebRTC message delivery and private invite behavior.

After #21 lands, Party copy may explicitly highlight the distinctive browser-hosted architecture, for example:

- the host's browser acts as the authoritative Party server;
- Cool Games Plus does not require its own dynamic application server to own room authority or relay Chat messages;
- application traffic is direct host-star WebRTC;
- public Nostr/STUN infrastructure is still external infrastructure, so do **not** market the design as literally “zero infrastructure.”

This distinction prevents metadata from becoming stale or misleading during the #21 -> #22 -> #23 migration.

### `/chat` — private session surface, not a search landing page

`/chat` remains **HTTP 200 + `noindex` + excluded from the sitemap**.

Its responsibility is room/session execution and durable invite deep links, including capability-bearing URL fragments. It is not the public explanation of the feature.

This separation is deliberate because the current and approved-target invite models put private state in fragments on the same HTTP path. Trying to make `/chat` simultaneously public/indexable while asking crawlers to ignore only some fragment variants would create an unnecessary privacy/indexing ambiguity.

The design therefore does **not** depend on search engines treating fragments a particular way:

- `/party` is public/indexable;
- `/chat` is private/session-oriented and noindex regardless of fragment state;
- no room/session fragment is a canonical page identity.

Once `/party` exists, a fragmentless user navigation to `/chat` may client-navigate to `/party` or show a minimal session-entry handoff. Capability-bearing `/chat#...` links continue to boot the room flow. Because fragments are not available to CloudFront/S3 request routing, that distinction belongs in client route behavior, not the edge.

### Functional but not indexable

These routes may return HTTP 200 because they are real product/diagnostic surfaces, but their initial HTML contains `meta name="robots" content="noindex"` and they never enter the sitemap:

- `/chat` and all room/invite fragment variants;
- `/networking-poc/trystero`;
- `/networking-poc/host-authority`;
- temporary diagnostic routes;
- unlisted `/game-preview/*` routes if they are intentionally deployed to production;
- future private/capability-based room execution routes.

### Redirect-only

Soundboard is deprecated and should not survive as a search identity.

Legacy routes:

- `/soundboard` -> `/party`;
- `/soundboard/sound` -> `/party`.

Production returns **308 Permanent Redirect** for these routes. They do not receive independent HTML documents, canonical tags, or sitemap entries. The current client `<Navigate>` compatibility behavior may remain until the implementation route cleanup, but it is not the production HTTP authority.

If `/chat` later receives a legacy alias of its own, that alias should consolidate to the appropriate current public or private route based on product semantics; do not preserve obsolete names merely for crawler volume.

### Unknown page routes

A route for which no static document exists returns **404** with a small `noindex` not-found document. Unknown routes never receive the Home document or another HTTP-200 SPA shell.

### Missing static assets

A missing asset such as `/assets/not-real.js`, a missing image, or another object path returns **404** (or the origin's equivalent client error normalized to viewer-facing 404 where #22 requires it). It never returns an HTML application document with HTTP 200.

## URL shape and canonicalization

The canonical URL policy is intentionally boring:

- HTTPS only;
- apex host only: `coolgamesplus.com`;
- root uses `/`;
- all non-root public page URLs omit a trailing slash;
- route segments remain lowercase URL-safe slugs;
- published page route segments must not use file-like `.` suffixes because the static edge contract distinguishes page-like extensionless paths from static object paths;
- canonical URLs do not include fragments;
- canonical URLs do not include incidental query parameters;
- sitemap URLs exactly match canonical URLs.

After #23, permanent redirects consolidate:

- HTTP -> HTTPS;
- `www.coolgamesplus.com/*` -> `https://coolgamesplus.com/*`;
- `/index.html` -> `/`;
- `/<route>/index.html` -> `/<route>` where applicable;
- trailing-slash variants such as `/games/` -> `/games`;
- deprecated `/soundboard*` routes -> `/party`.

The request path/query may still reach React where the product needs it, but canonical ownership is path-policy driven, never copied from the incoming browser URL.

Google treats redirects, sitemap inclusion, and `rel="canonical"` as canonicalization signals. We should make those signals agree rather than depending on one hint.

## Metadata ownership

Introduce one small side-effect-free SEO policy boundary during implementation. Exact filenames may vary, but the responsibilities should look like:

```text
src/seo/
  siteMetadata.ts       // site identity + canonical-origin constant
  routeMetadata.ts      // non-game route policy + adapters
  routeMetadata.test.ts
```

Build tooling consumes those pure values plus `gameCatalog`. React route composition stays in `App.tsx`; this Issue does not justify a generic router framework/refactor.

The non-game SEO table is deliberately small. `gameCatalog` remains the only per-game registry. Tests should protect the handful of App/SEO route relationships rather than creating a second generic routing abstraction merely to eliminate a few explicit path strings.

### Required document metadata

Every generated HTML document has an explicit policy for:

- `<title>`;
- `<meta name="description">` where useful;
- `<meta name="robots">`;
- `<link rel="canonical">` for indexable routes;
- `og:title`;
- `og:description`;
- `og:url` for indexable routes;
- `og:site_name="Cool Games Plus"`;
- `og:type="website"` unless a later supported consumer justifies something more specific.

Do not derive metadata from `document.location`, `window.location`, route fragments, or runtime room state.

Recommended title pattern:

- Home: `Cool Games Plus | Browser Games & Private Parties`
- Games: `Games | Cool Games Plus`
- Party: `Party | Cool Games Plus`
- game: `${game.title} | Cool Games Plus`
- Chat session/POC/preview: clear route-specific human title plus `noindex`.

Recommended Party description direction after #21 is production:

> Start a private browser-hosted group chat with friends on Cool Games Plus. Party uses direct WebRTC connections and a player host instead of a Cool Games Plus application server for room authority.

The exact final copy should be reviewed with the shipped #21 behavior. Before #21 lands, use wording that accurately reflects the coordinator-backed implementation instead of publishing the target architecture as current fact.

Home metadata should likewise represent both primary product pillars rather than describing the site only as a game catalog.

Descriptions should remain concise human-readable product copy. For published game pages, `game.shortDescription` is the default description source.

### Social images

Merged #37 provides a semantically named header mark, favicon, and Apple touch icon, but intentionally does not create Open Graph/social-share artwork. The SEO architecture therefore defines an **optional** social-image slot but does not repurpose those small UI assets as share cards.

Until approved share artwork exists:

- emit the other Open Graph fields;
- omit `og:image` rather than pointing at an unsuitable asset.

When a global, Party-specific, or game-specific share image exists, add it through this metadata boundary without changing canonical/indexing policy.

## Typed game catalog contract

`GameDefinition` does **not** need new SEO-only fields for v1.

Existing fields already provide the required production game metadata:

- `route` -> canonical pathname and sitemap URL;
- `title` -> document/Open Graph title;
- `shortDescription` -> meta/Open Graph description;
- `category` -> available descriptive context;
- `artwork` -> discovery identity, but not automatically a social-share image;
- `loadPage` -> runtime loader, which SEO generation must never invoke.

Do not add `seoTitle`, `seoDescription`, or `seoKeywords` merely to duplicate current values. If a future game has a demonstrated need for search copy that should intentionally differ from discovery copy, add one narrow optional override then, with the catalog remaining authoritative.

The build-time SEO generator may import `gameCatalog` and read serializable fields. It must not:

- call `loadPage`;
- import `gameRoutes.tsx`;
- render a game page component;
- import a game runtime directly or indirectly.

Tests should make this boundary explicit so SEO work cannot silently destroy lazy loading later.

## Party content ownership

Party is not game-catalog metadata, so its public content belongs to a small route/page boundary rather than `GameDefinition`.

The durable source-of-truth split should be:

- route metadata policy owns Party title/description/canonical/robots/Open Graph fields;
- the `/party` React page owns visible player-facing explanation and actions;
- `/chat` owns session execution only;
- #20/#21 networking docs own protocol/transport implementation truth.

Do not duplicate detailed networking constants, limits, or protocol copy inside an SEO-only registry. Public Party copy should consume stable product concepts and remain intentionally less detailed than the networking design.

## Build output contract

The implementation should extend the current Vite build with a deterministic post-bundle/static-document generation step. The exact mechanism may be a small tested Vite plugin or an equally small build script; do not add a rendering framework solely for this.

Conceptual output:

```text
dist/
  index.html
  404.html
  games/
    index.html
    plane-blaster/index.html
    donut-run/index.html
    neon-drift/index.html
    monster-color-rush/index.html
    worm-battles/index.html
    warrior/index.html
    warrior2/index.html
  party/
    index.html
  chat/
    index.html
  networking-poc/
    trystero/index.html
    host-authority/index.html
  game-preview/.../index.html       # only for intentionally shipped preview routes
  robots.txt
  sitemap.xml
  assets/...
```

Each route document references the same Vite-generated hashed client entry/assets. The page-specific difference is static document metadata, not a separate JavaScript application bundle.

Do not generate documents for redirect-only or unknown routes.

`404.html` is `noindex` and contains only generic not-found content; it must not echo an untrusted requested URL into markup.

## Sitemap contract

Generate `/sitemap.xml` deterministically from the **indexable allowlist**, not from every React route and not by crawling `dist`.

It includes only:

- `/`;
- `/games`;
- `/party`;
- current published `gameCatalog` routes.

It excludes:

- `/chat`;
- URL-fragment invite variants;
- POC/diagnostic routes;
- `/game-preview/*`;
- deprecated Soundboard/redirect-only routes;
- Vercel/CloudFront hostnames;
- unknown or private URLs.

Use fully qualified `https://coolgamesplus.com/...` URLs.

Do not emit `changefreq` or `priority`. Do not misuse `GameDefinition.addedAt` as `<lastmod>`; it records catalog introduction, not necessarily the last meaningful page modification. Add `<lastmod>` only when the build has a trustworthy source for actual content modification.

## `robots.txt` contract

Canonical production:

```text
User-agent: *
Allow: /
Sitemap: https://coolgamesplus.com/sitemap.xml
```

Do **not** list Chat, POC, preview, or private URLs in `robots.txt` merely to keep them out of search. Google must be able to crawl a functional noindex page to observe its `noindex` directive, and Google explicitly does not support `noindex` in `robots.txt`.

Privacy/security is never provided by `robots.txt`. Truly private content requires capability/access control; our invite secrets already live outside the public crawlable page identity.

## Vercel preview/staging policy

Vercel is noncanonical staging/preview, never a second SEO surface after #23.

Vercel currently documents that normal Preview deployments receive `X-Robots-Tag: noindex` automatically, but it also documents an important exception: a custom domain attached to a non-production branch does **not** receive that automatic header.

Therefore the production implementation must make repository policy fail closed rather than relying on Vercel defaults:

- configure every Vercel deployment to return `X-Robots-Tag: noindex` for page/HTML responses once Vercel becomes staging/preview;
- preserve route HTML canonical URLs as `https://coolgamesplus.com/...`, never a `vercel.app` or branch hostname;
- do not advertise the production sitemap from Vercel staging;
- remove the blanket successful `/index.html` fallback once generated route documents can serve preview deep links;
- keep explicit legacy redirects and clean trailing-slash behavior aligned with production where practical so previews catch routing regressions;
- deployment protection may be used independently, but is not a substitute for the indexing contract.

The current Vercel host remains production until the #21 -> #22 -> #23 sequence completes. The above “Vercel is staging/preview” policy becomes effective as part of that migration; do not accidentally noindex the current canonical production surface before the new canonical AWS surface is ready.

When #23 retires Vercel configuration, this staging policy can be removed with the legacy deployment surface.

## CloudFront/S3 request contract for #22

#38 owns **what production routing must mean**. #22 owns the infrastructure code that implements it.

The intended viewer-request behavior is:

1. Apply explicit permanent redirect rules before static rewrites.
2. Normalize canonical clean URL forms (including direct `index.html` and non-root trailing-slash variants) with 308 where appropriate.
3. Rewrite `/` internally to `/index.html`.
4. Rewrite page-like extensionless paths to their static `.../index.html` object.
5. Leave file/asset requests as file/asset requests.
6. If the rewritten page object does not exist, preserve a viewer-facing 404 rather than falling back to `/index.html`.
7. If an asset does not exist, preserve a viewer-facing 404 rather than serving an HTML success document.
8. Preserve query strings through routing/redirects where appropriate, but do not copy them into canonical metadata.

A generic extensionless-page rewrite is preferable to embedding the full game catalog into CloudFront configuration: adding a generated `games/<slug>/index.html` or `party/index.html` object naturally makes that clean route resolvable, while an unknown extensionless path rewrites to a missing object and therefore remains a 404.

Because the origin is private S3, #22 must account for S3's missing-object semantics. AWS documents that a principal with `s3:GetObject` but without `s3:ListBucket` can receive 403 rather than 404 for a nonexistent key. #22 may solve that with appropriately scoped permission or edge/error normalization, but the public semantic invariant is the same: an ordinary missing public page/asset is a 404, and **must never be changed to 200**.

A static `404.html` may be used as the error body while retaining the 404 viewer status.

### Noncanonical CloudFront hostname

Before DNS cutover, the CloudFront validation hostname must be `noindex` so it cannot become a duplicate search surface. After #23 cutover, requests to noncanonical production hostnames should either remain `noindex` or permanently redirect to `https://coolgamesplus.com` when doing so no longer interferes with pre-cutover validation.

## Search Console launch contract

Search Console is an owner/verification tool, not a runtime dependency.

At canonical production cutover:

1. Add a **Domain property** for `coolgamesplus.com` (not `www.coolgamesplus.com` and not a protocol-prefixed URL).
2. Verify ownership using the Google-provided DNS TXT record in Route 53. Keep the verification record unless there is a deliberate reason to remove it.
3. Confirm `https://coolgamesplus.com/robots.txt` and `/sitemap.xml` are publicly fetchable from the canonical host.
4. Submit `https://coolgamesplus.com/sitemap.xml` in the Sitemaps report.
5. Use URL Inspection on at least `/`, `/games`, `/party`, and one representative published game.
6. Confirm live rendered content, user-declared canonical, and Google's selected canonical converge on the apex URL.
7. Inspect `/party` to confirm the public Party explanation and links are rendered and indexable.
8. Inspect `/chat` once to confirm Google observes `noindex` and does not treat the session route as a public landing page.
9. Monitor Page Indexing for soft 404s, unexpected duplicates/canonicals, or accidental noindex.
10. Monitor Crawl Stats/robots availability and the Search Performance report after launch.
11. Revisit selective prerendering only if inspection/rendering evidence shows meaningful content discovery problems that route-specific HTML metadata did not solve.

## Structured data decision

### Adopt: `WebSite` site-name structured data on `/`

Google explicitly says `WebSite` structured data on the home page is the most important way to indicate the preferred site name.

The Home document should emit one JSON-LD `WebSite` node conceptually equivalent to:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://coolgamesplus.com/",
  "name": "Cool Games Plus",
  "alternateName": "C00lG@mes+"
}
```

This directly supports the plain/search name versus visual-brand convention established by #37 and has a concrete current Google consumer.

### Defer: Party-specific application schema

Do not add generic `SoftwareApplication`, `WebApplication`, or other schema to `/party` merely because the feature is technically an application.

The current design has no clear supported rich-result benefit that justifies additional schema ownership. The visible Party content, normal metadata, crawlable links, and site-wide `WebSite` identity are sufficient for v1.

### Defer: game `SoftwareApplication` / `VideoGame`

Google currently supports `SoftwareApplication` rich results and `GameApplication`, but its supported schema requires an `offers.price`, and Google explicitly says `VideoGame` alone does not receive the software-app rich result. Our in-browser game pages do not currently have an application-store/offer model that benefits enough from this markup to justify manufacturing one for schema eligibility.

Do not add it in v1.

### Defer other schema until there is a real consumer

Do not add `Organization`, breadcrumb, review/rating, or other schema simply because Schema.org defines it. Add structured data only when:

- the visible product content genuinely supports it;
- Google or another important consumer currently uses it;
- required fields can be supplied truthfully without SEO-only invention.

## Chat/invite security and privacy invariants

This design must not weaken either the current or approved target private URL-fragment/capability boundary.

### Static generation inputs

The SEO/static generator consumes only repository-controlled data:

- fixed site metadata;
- fixed non-game route policy, including public `/party` metadata;
- public serializable `gameCatalog` fields.

It never consumes:

- `window.location`;
- browser history;
- `location.hash`;
- local/session storage;
- IndexedDB;
- room/member state;
- analytics/referrer logs;
- invite links copied by a user;
- host/invite/rendezvous/admission/member credentials.

### Public Party identity versus private Chat capability state

The public feature identity is:

```text
https://coolgamesplus.com/party
```

Current and target invite examples include:

```text
/chat#room=<roomId>&invite=<inviteSecret>
/chat#v=2&party=<partyId>&r=<rendezvousCapability>&a=<admissionCapability>&host=<hostKeyFingerprint>
```

The `/chat` path and its fragment are session machinery, not the canonical public Party identity.

Fragments and capability state must never be copied into:

- `<title>`;
- canonical URLs;
- descriptions;
- Open Graph fields;
- JSON-LD;
- sitemaps;
- generated route manifests;
- build logs.

Do not hash, redact, or transform a secret for SEO output; **do not ingest it at all**.

If a user pastes an invite into a service that fetches link metadata, the static `/chat` document remains generic and `noindex`; there is no dynamic unfurl logic based on the fragment. The public shareable product page is `/party`.

### Logging

Build/static-generation diagnostics may log known route paths such as `/party` or `/games/neon-drift`. They must not log arbitrary input URLs or browser-derived state. #22/CDN access-log privacy is a separate infrastructure decision, but no SEO feature should create a new secret-bearing log path.

## Representative production traces

### `/`

1. Request `https://coolgamesplus.com/`.
2. CloudFront resolves `/index.html` internally.
3. Viewer receives 200.
4. Original HTML contains Home title/description/canonical/Open Graph and `WebSite` JSON-LD.
5. Home metadata represents both Games and Party rather than only the arcade catalog.
6. Robots policy is indexable.
7. URL is in sitemap.
8. React boots normally; no game runtime is imported solely for SEO.

### `/games`

1. Clean URL internally resolves to `/games/index.html`.
2. Viewer receives 200.
3. Original HTML contains Games-specific metadata and canonical `https://coolgamesplus.com/games`.
4. URL is in sitemap.
5. React renders the catalog; its normal `<a href>` game links remain crawler-discoverable after rendering.

### `/party`

1. Clean URL internally resolves to `/party/index.html`.
2. Viewer receives 200.
3. Original HTML contains Party-specific title, description, canonical `https://coolgamesplus.com/party`, Open Graph fields, and `index,follow`.
4. URL is in sitemap.
5. React renders durable public explanation of private Party/group-chat behavior and a clear Start Party action.
6. No room ID, invite, member, host credential, or capability state is needed to render the public page.
7. Public copy describes the actually deployed networking architecture; it does not advertise #21 target behavior before #21 lands.

### `/games/neon-drift`

1. Clean URL internally resolves to `/games/neon-drift/index.html`.
2. Viewer receives 200 with `Neon Drift | Cool Games Plus`, description from `gameCatalog`, and the clean canonical URL.
3. URL is in sitemap.
4. SEO generation has read catalog metadata but has not invoked `loadPage`.
5. Only when React matches the game route does `React.lazy(game.loadPage)` load the runtime chunk.

### `/chat`

1. Clean URL internally resolves to `/chat/index.html`.
2. Viewer receives 200 because the room/session route must support direct invite deep links.
3. Original HTML contains `noindex` and generic session metadata.
4. There is no sitemap entry and no indexable canonical contract.
5. A fragmentless client visit may hand off to `/party`; capability-bearing fragments remain on `/chat` and boot the room/session flow.
6. React may parse current or target private fragment state after boot, but that state never feeds document/static metadata.

### `/chat#...private-capability...`

1. The HTTP request still resolves only `/chat/index.html`; CloudFront/S3 never sees the fragment.
2. Viewer receives the same generic `noindex` Chat session document.
3. Client code parses the fragment only after boot.
4. The fragment is never added to metadata, sitemap output, build logs, or public Party content.
5. The individual party is not a search document.

### `/networking-poc/trystero`

1. Clean URL resolves to its generated noindex document.
2. Viewer receives 200, `noindex`, no sitemap entry.
3. POC module remains lazy and loads only after React matches the route.

### `/soundboard`

1. Viewer-request routing matches the explicit deprecated-feature redirect.
2. Viewer receives 308 with `Location: /party` (or canonical absolute equivalent).
3. No independent Soundboard page document or sitemap URL exists.
4. Search identity consolidates on the current public Party feature.

### `/definitely-not-a-route`

1. Page-like request internally maps to `/definitely-not-a-route/index.html`.
2. Object does not exist.
3. Viewer receives 404, optionally with static `404.html` body.
4. No Home/SPA document is returned with 200, so there is no soft-404 design.

### `/assets/definitely-not-real.js`

1. Asset path is not rewritten to a page document.
2. Object does not exist.
3. Viewer receives 404.
4. Browser/crawler never receives `index.html` as a successful JavaScript asset response.

## Validation contract for implementation

Automated checks should cover at least:

- `/`, `/games`, `/party`, and every published `gameCatalog` route produce one indexable document and sitemap URL;
- `/party` has deterministic public title/description/canonical/robots/Open Graph metadata;
- no generator path calls `loadPage`;
- Home/Games/Party/game titles, descriptions, canonical URLs, and robots directives are deterministic;
- `/chat`, POCs, diagnostics, and preview routes are `noindex` and excluded from sitemap;
- no `/chat` fragment/capability value can enter metadata or generated output;
- deprecated `/soundboard` routes are redirect-only and excluded from static page/sitemap generation;
- `/soundboard` and `/soundboard/sound` consolidate to `/party`;
- generated canonical/Open Graph/sitemap values cannot contain fragments, capability parameter values, or noncanonical hostnames;
- sitemap contains only absolute `https://coolgamesplus.com` canonical URLs;
- production robots points only to the canonical sitemap;
- post-cutover Vercel responses are explicitly `noindex` even without Vercel's automatic Preview header;
- unknown page and asset requests remain 4xx in the #22 routing tests;
- trailing-slash/direct-index aliases permanently redirect to their clean URL where implemented;
- the normal repository gate remains green: `npm test`, `npm run lint`, `npm run build`.

Manual/pre-cutover validation should inspect raw response HTML/headers with JavaScript disabled as well as the rendered app:

- `/`;
- `/games`;
- `/party`;
- one published game;
- `/chat`;
- one capability-bearing `/chat#...` flow without exposing the fragment in recorded evidence;
- one POC;
- one deprecated Soundboard redirect;
- one unknown route;
- one missing asset;
- a Vercel preview URL;
- the CloudFront pre-cutover hostname.

## Implementation boundaries and sequencing

### Follow-up SEO implementation

After this design is approved, create **one focused implementation Issue/PR** for the application/build-side SEO work:

- side-effect-free route metadata policy;
- indexable `/party` landing route and concise durable Party explanation;
- update primary Party navigation to target `/party` instead of the private `/chat` session route;
- preserve `/chat` for private room/invite execution and mark it `noindex`;
- define fragmentless `/chat` handoff behavior to `/party` without interfering with capability-bearing invite fragments;
- change deprecated Soundboard redirects to `/party`;
- route-specific HTML generation;
- sitemap/robots generation;
- `WebSite` structured data;
- post-cutover Vercel `noindex` and non-blanket preview routing;
- build/tests proving game-runtime laziness and secret exclusion.

This remains one coherent product/SEO outcome: establish the public Games/Party information architecture and generate correct static crawler documents around it. It should not be split merely by file type.

### Issue #21 — production client-only Chat migration

#21 owns the networking/runtime migration. It may continue to use `/chat#...` as the private session/invite route.

#21 must preserve the SEO/privacy invariants in this document:

- room capability fragments never become metadata/sitemap/logging input;
- `/chat` remains safe as a generic noindex static document;
- networking implementation truth remains separate from public SEO copy.

The `/party` public landing route does **not** require #21 to absorb unrelated SEO/page-composition work. If the SEO implementation lands before #21, public Party copy must describe current behavior accurately and can be updated when #21 becomes production.

### Issue #22 — AWS production foundation

#22 consumes this contract and implements:

- CloudFront clean-URL/internal-document rewrites;
- explicit edge redirects, including deprecated Soundboard -> `/party`;
- missing-object 4xx behavior;
- pre-cutover CloudFront noindex/noncanonical handling;
- cache policy and deployment mechanics.

Do not duplicate metadata/sitemap generation in CDK/CloudFront.

### Issue #23 — canonical cutover

#23 owns:

- apex Route 53 cutover;
- HTTP/`www` -> HTTPS apex redirects;
- post-cutover treatment of the default CloudFront hostname;
- transition of Vercel from current production to noncanonical preview/staging and retirement of obsolete legacy hosting/runtime resources;
- Search Console DNS verification and launch checklist execution.

### Issue #37 — merged brand foundation

#37 / PR #43 is complete. It establishes the authoritative naming convention plus canonical/source and production web brand assets.

The SEO implementation should consume that merged naming convention directly. It should **not** repurpose the small header/favicon/touch assets as Open Graph share art, and no additional #37 work is required for this design.

## Evidence gates for revisiting the decision

Reconsider selective/static content prerendering only if one or more of these occur after production launch:

- Search Console URL Inspection shows important rendered content or crawlable links missing/unreliably rendered;
- meaningful non-Google acquisition depends on crawlers that do not execute the current client app and metadata-only shells prove insufficient;
- Core Web Vitals/first-content evidence shows static discovery/Party content would materially improve player experience;
- a future content surface introduces enough public text/data that client-only rendering becomes a measurable discovery constraint.

Do **not** migrate to SSR merely because the catalog grows or Party gains more features.

## Current external guidance used

Google Search Central:

- [Understand JavaScript SEO Basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Fix Search-related JavaScript problems](https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript)
- [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization)
- [Block Search indexing with `noindex`](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Robots.txt introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- [Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
- [Site names in Google Search](https://developers.google.com/search/docs/appearance/site-names)
- [Software app structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)

Google Search Console Help:

- [Add a website property](https://support.google.com/webmasters/answer/34592?hl=en)
- [Verify site ownership](https://support.google.com/webmasters/answer/9008080?hl=en)
- [Sitemaps report](https://support.google.com/webmasters/answer/7451001?hl=en)
- [URL Inspection tool](https://support.google.com/webmasters/answer/9012289?hl=en)

Vercel:

- [Are Vercel Preview Deployments indexed by search engines?](https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines)
- [Avoid duplicate-content SEO with `vercel.app` URLs and custom domains](https://vercel.com/kb/guide/avoiding-duplicate-content-with-vercel-app-urls)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Static configuration with `vercel.json`](https://vercel.com/docs/project-configuration/vercel-json)

AWS documentation relevant to #22's status-code implementation:

- [Amazon S3 `GetObject`](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html)
- [CloudFront custom error responses](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GeneratingCustomErrorResponses.html)

These references were checked on 2026-09-14. Current vendor documentation wins if behavior changes before implementation.