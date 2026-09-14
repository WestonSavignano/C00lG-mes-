# Privacy-Minimized Analytics and Product Measurement Design

Date: 2026-09-14  
Status: Proposed architecture for Issue #39; **no analytics implementation is authorized by this document alone**  
Owning issue: #39  
Canonical production domain: `https://coolgamesplus.com`

## Decision summary

C00lG@mes+ should adopt a **measurement-first, no-client-identifier product analytics architecture** for the canonical production site.

The first production implementation should collect only a deliberately small set of typed product events with low-cardinality, allow-listed properties. It should not create a persistent visitor profile, should not recognize a browser across visits, and should not execute an analytics vendor's broad automatic-capture surface merely because one is available.

The architecture decision is:

- **ADOPT** a small first-party TypeScript analytics boundary with a closed event schema and fail-safe no-op behavior;
- **ADOPT WITH CONSTRAINTS** Simple Analytics as the leading hosted ingestion/analysis candidate, subject to the transport, retention, contractual, and legal-readiness gates in this document;
- **DEFER** Plausible, PostHog, and GA4 for the first implementation because their current identity/default-data models or product surface are broader than the approved measurement questions require;
- **DEFER** a C00lG@mes+-owned analytics API/database because it adds security, abuse, retention, privacy, and operational obligations to a product deliberately moving toward static production hosting;
- **USE TEMPORARILY** Search Console plus CloudFront/CloudWatch aggregate observability if the hosted-product-analytics gates are not satisfied. Do not weaken the privacy contract simply to obtain a dashboard sooner.

The selected identifier model is **no analytics client ID and no analytics session ID** for v1.

That choice deliberately gives up exact cross-session user retention, unique-user counts, person-level funnels, and per-browser lifetime value. Those are not currently necessary to answer the product decisions that matter most: which discovery surfaces produce game starts, whether games become playable successfully, whether players restart/complete them, whether releases improve those aggregate rates, and whether controlled error/performance signals show quality regressions.

The implementation may keep a **small non-identifying acquisition/activation context in memory for the current page load**. This is not a session ID: it generates and emits no identifier, is never persisted, and exists only to remember the coarse approved acquisition category/campaign plus whether the first route entry and first game start have already occurred. Those safe dimensions/booleans may then be copied onto individual events so aggregate acquisition-to-first-start conversion is measurable without correlating records through an identifier.

## Why this is the right boundary for C00lG@mes+

C00lG@mes+ is an all-ages boutique arcade and game studio that may attract children and families. It also has peer-to-peer Chat/party functionality whose invite and authority capabilities live in browser-local state and URL fragments.

Current repository evidence makes automatic analytics capture unusually risky:

- `src/pages/ChatPage.tsx` currently parses room, host, and invite capabilities from `location.hash` and constructs shareable fragment URLs;
- the approved client-only networking architecture keeps future party rendezvous/admission capability material in URL fragments as well;
- current guest member credentials are stored in local storage, and the target networking design introduces additional browser-local credential/authority material;
- discovery currently stores only a small recent-game convenience list in local storage;
- the application already has strong route/catalog boundaries that let us describe product behavior without forwarding arbitrary URLs;
- game runtimes and shared input/lifecycle infrastructure are performance-sensitive and must remain independent of analytics availability.

Therefore the analytics boundary must be **deny-by-construction**. Configuration such as “please do not capture sensitive fields” is insufficient if a vendor library still has access to `window.location`, DOM text, errors, request bodies, or automatic interaction capture.

## Scope and relationship to other repository work

This design is documentation only. It does not install an SDK, add a tracking script, create an analytics account, add a backend, or enable production collection.

It complements, but does not replace:

- Issue #38 for crawlability/SEO and Search Console;
- Issues #20/#21 for networking/Chat capability boundaries;
- Issues #22/#23 for static AWS production hosting and canonical-domain cutover;
- CloudFront/CloudWatch infrastructure observability;
- future legal/privacy review before advertising, accounts, persistent identifiers, or materially broader third-party SDKs.

The three measurement systems stay separate:

| System | Primary question | Examples | Not its job |
| --- | --- | --- | --- |
| Search Console | How is the site discovered in Google Search? | indexing, queries, impressions, clicks, canonical selection | player behavior, game runtime telemetry |
| CloudFront / CloudWatch | Is production delivery healthy? | request volume, cache behavior, HTTP errors, latency/availability metrics | product funnels, replay behavior |
| Product analytics | What curated product interactions are happening? | game starts/readiness/restarts, selected errors, bounded performance samples | search-query intelligence, raw infrastructure logs |

Do not copy all raw data into all three systems. In particular, CloudFront standard access logs contain request-level data such as viewer IP, User-Agent, URI query, and referrer and are **not** a privacy-free substitute for aggregate CloudWatch metrics or curated product events.

## Product questions first

Every event and property must exist because it supports a named decision. If a field does not change a product, quality, release, or acquisition decision, it does not belong in the schema.

### Q1 — Acquisition quality

**Decision:** Which coarse acquisition channels produce meaningful game starts rather than empty visits?

**Minimum measurement:** classify the initial page load locally as `direct`, `search`, `social`, `distribution_platform`, `campaign`, `referral`, or `other`, plus an optional pre-approved campaign code. Keep only that coarse classification in memory for the page load. Mark the first recognized `page_view` with `visitEntry: true`, copy the approved acquisition fields onto `game_start`, and mark only the first game launch in that page load with `firstStartInVisit: true`. Aggregate `firstStartInVisit` counts divided by `visitEntry` counts by acquisition category/campaign provide a page-load activation rate without any emitted visit/session identifier.

**Less identifying alternative:** Search Console remains the source for Google query/click details. Product analytics receives only the coarse category; it never receives the raw referrer URL or arbitrary UTM/query parameters. A reload is a new page-load visit for this aggregate metric; the system does not attempt to recognize that it may be the same browser/person.

**Cross-visit recognition required:** no.

### Q2 — Discovery effectiveness

**Decision:** Which intentional product surfaces cause players to launch games?

**Minimum measurement:** `game_start` with a controlled `surfaceId`, such as Home featured game, Home catalog, Games catalog, recent games, or direct navigation.

**Less identifying alternative:** Do not initially record every tile impression. With a small catalog, start counts by known surface answer the first placement questions without emitting scroll/visibility telemetry.

**Cross-visit recognition required:** no.

### Q3 — Activation and startup quality

**Decision:** Are players reaching a playable game successfully, and did a release improve startup reliability?

**Minimum measurement:** `game_start`, then `game_ready` with a coarse startup-time bucket.

**Less identifying alternative:** use buckets rather than exact millisecond values; no device model, raw User-Agent, screen dimensions, or hardware fingerprint.

**Cross-visit recognition required:** no.

### Q4 — Engagement and replay

**Decision:** Which games create enough immediate replay/completion behavior to justify additional investment?

**Minimum measurement:** `game_restart` and, only where the game has a meaningful completion concept, `game_complete`.

**Less identifying alternative:** compare aggregate restart/completion counts to starts. Do not create a persistent browser ID merely to compute person-level D1/D7 retention.

**Cross-visit recognition required:** no for the current product decision.

### Q5 — Product quality

**Decision:** Are controlled runtime/load failures or coarse performance problems preventing play on important browser/device classes?

**Minimum measurement:** a small `game_error` enum and one bounded `performance_sample` per game run at most, with low-cardinality client/runtime classes.

**Less identifying alternative:** locally classify the environment into a few operationally useful buckets rather than sending full User-Agent, OS version, device model, screen size, memory, CPU count, WebGL renderer, or feature fingerprint.

**Cross-visit recognition required:** no.

### Q6 — Release impact

**Decision:** Did a particular production release materially change starts, readiness, replay, completion, errors, or performance?

**Minimum measurement:** a controlled build/release identifier present on approved events.

**Less identifying alternative:** aggregate by release and date; do not link the same browser before and after a release.

**Cross-visit recognition required:** no.

### Q7 — Party entry quality

**Decision:** Can people successfully enter the Party/Chat flow, and are create/join/resume failures increasing?

**Minimum measurement:** an aggregate `party_entry` event containing only controlled action/role/result/failure-code fields.

**Less identifying alternative:** no room ID, member ID, peer ID, invite capability, host identity, rendezvous topic, signaling detail, Chat content, or copied diagnostic data.

**Cross-visit recognition required:** no.

## Intentional measurement blind spots

The first implementation intentionally does **not** answer:

- exact unique users, DAU, WAU, or MAU;
- “the same browser returned seven days later” retention;
- cross-session or cross-device funnels;
- individual player journeys;
- player lifetime value;
- precise session duration;
- heatmaps, pointer paths, or interaction recordings;
- per-frame game telemetry;
- raw referrer/search-query attribution;
- Chat-message behavior or content;
- person-level experiment assignment.

The v1 acquisition metric is deliberately a **page-load activation rate**, not a unique-user or persistent-session conversion rate. A reload starts a new in-memory context and no analytics record contains an identifier that links the two page loads.

These are not bugs in the architecture. They are the privacy cost avoided by declining to create a browser identity before the business case exists.

If a future decision genuinely requires persistent identity, create a separate reviewed Issue that proves why aggregate/sessionless measurement is insufficient and re-runs the privacy/COPPA/California/vendor analysis before implementation.

## Typed event contract

The implementation should expose a closed discriminated union or equivalently narrow typed functions. It must **not** expose a generic public API such as `track(name: string, properties: Record<string, unknown>)` to arbitrary application code.

The following is an implementation contract, not code added by this PR:

```ts
type AnalyticsSchemaVersion = 1

type RouteId = 'home' | 'games' | 'game' | 'chat' | 'not_found'

type AcquisitionSource =
  | 'direct'
  | 'search'
  | 'social'
  | 'distribution_platform'
  | 'campaign'
  | 'referral'
  | 'other'

type DiscoverySurface =
  | 'home_featured'
  | 'home_catalog'
  | 'games_catalog'
  | 'recent_games'
  | 'direct'
  | 'other'

type ClientClass =
  | 'ios_webkit'
  | 'android_chromium'
  | 'desktop_chromium'
  | 'desktop_webkit'
  | 'desktop_gecko'
  | 'other'

type StartupBucket =
  | 'lt_250ms'
  | '250_499ms'
  | '500_999ms'
  | '1000_1999ms'
  | '2000ms_plus'

type FrameRateBucket =
  | 'lt_24'
  | '24_29'
  | '30_44'
  | '45_54'
  | '55_plus'

type AnalyticsEvent =
  | {
      name: 'page_view'
      routeId: RouteId
      gameId?: string
      acquisitionSource: AcquisitionSource
      campaignId?: string
      visitEntry: boolean
    }
  | {
      name: 'game_start'
      gameId: string
      surfaceId: DiscoverySurface
      acquisitionSource: AcquisitionSource
      campaignId?: string
      firstStartInVisit: boolean
    }
  | {
      name: 'game_ready'
      gameId: string
      clientClass: ClientClass
      startupBucket: StartupBucket
    }
  | {
      name: 'game_restart'
      gameId: string
    }
  | {
      name: 'game_complete'
      gameId: string
      completionKind: string
    }
  | {
      name: 'game_error'
      gameId: string
      clientClass: ClientClass
      errorCode: string
    }
  | {
      name: 'party_entry'
      partyKind: 'chat' | 'game'
      action: 'create' | 'join' | 'resume'
      role: 'host' | 'guest'
      result: 'success' | 'failure'
      failureCode?: string
    }
  | {
      name: 'performance_sample'
      gameId: string
      clientClass: ClientClass
      sampleWindow: 'first_30s'
      frameRateBucket: FrameRateBucket
    }
```

Every emitted event also receives, inside the analytics boundary rather than from call sites:

- `schemaVersion: 1`;
- a controlled production `releaseId`/release tag;
- the provider's ingestion time rather than an arbitrary client-supplied timestamp when possible.

### Property contracts

The example `string` properties above are not permission for free-form values:

- `gameId` must resolve from the typed game catalog;
- `campaignId`, if enabled, must come from a checked-in or build-time allow-list and unknown values collapse to `other`/absent;
- `visitEntry` and `firstStartInVisit` are derived by the analytics facade from memory-only page-load state; callers do not invent or persist a visit/session identifier to produce them;
- `completionKind` is an enum owned by the individual game and must never contain score, player-entered text, or arbitrary state;
- `errorCode` and `failureCode` are closed enums, not exception messages;
- `releaseId` is a controlled build value, not a deployment URL;
- `ClientClass` is computed locally and is deliberately coarse. Raw UA, OS version, device model, screen dimensions, CPU/memory, graphics renderer, and feature fingerprints are never sent.

### Events deliberately deferred

#### `game_impression`

Defer initially. The catalog is small, and `game_start.surfaceId` is enough for the first discovery-placement decisions. Add impressions only when a concrete question requires a denominator such as tile-start conversion, with one in-memory deduplicated impression per eligible surface/visit rather than continuous visibility telemetry.

#### Fine-grained gameplay events

Do not add frame-by-frame state, every input, every death, every score increment, coordinates, movement paths, or continuous timers. A game-specific event needs a separate product decision and review if restart/completion are insufficient.

## Event semantics and collection points

### `page_view`

Emit once when the application enters a recognized public product route on the canonical production host.

The analytics layer receives `routeId` from application routing, never `location.href` or a generic URL. For a game route, it may receive the catalog `gameId`. Diagnostic/POC routes should produce no product analytics.

Acquisition classification happens **once per page load** and is retained only in the analytics facade's memory. If `document.referrer` is consulted, inspect only enough to classify the origin/hostname into a small enum and immediately discard the raw string. Never send the raw referrer. If a query parameter is used for a known campaign, read only the exact approved parameter, validate against the known allow-list, map unknown values to `other`, and never forward `location.search`.

The first recognized route event after initialization has `visitEntry: true`; subsequent SPA route transitions in the same page load have `visitEntry: false`. All may reuse the same coarse in-memory acquisition classification, but no visit/session identifier is created, stored, or transmitted.

### `game_start`

Emit once when a catalog game route is intentionally launched/mounted for a play attempt. `surfaceId` comes from the application action that launched it; direct/deep-link routes use `direct`.

The analytics facade copies the current page-load's coarse `acquisitionSource` and optional allow-listed `campaignId` onto the event. The first game launch in the current page load has `firstStartInVisit: true`; any later game launch before a full reload has `false`. This lets reporting compare first-game-start counts with entry-page-view counts by acquisition source without a session/client ID. Reloading creates a fresh in-memory context.

### `game_ready`

Emit once after the runtime is sufficiently initialized for player interaction. The individual game/lifecycle adapter should define this explicit moment; do not infer it from arbitrary DOM/load events.

### `game_restart`

Emit for an actual player restart/replay action, once per restart. This is the primary early replay signal.

### `game_complete`

Emit only for games with a real completion/win concept. Endless/survival games should not invent a fake completion event to satisfy a dashboard.

### `game_error`

Emit only controlled categories such as runtime chunk load failure, shared error-boundary failure, unsupported rendering capability, or deliberately classified game initialization failure. Never pass an `Error` object, exception message, stack trace, source file, arbitrary request/response body, or copied diagnostic payload into analytics.

### `party_entry`

The Chat/party implementation calls this event after it already knows the safe semantic result. The analytics module must not inspect or parse the URL fragment itself.

No analytics event is emitted for messages, membership lists, room identity, peer connection details, signaling payloads, ICE candidates, host/member credentials, or rendezvous capabilities.

### `performance_sample`

At most one sample per game run, after a stable bounded window such as the first 30 seconds of active play. Compute performance locally, reduce it to a broad bucket, emit, and discard the raw sample series.

At low traffic it is reasonable to collect one such sample per eligible game run. If volume grows, use a non-sticky random sample (for example 10%) rather than assigning a persistent sampling cohort identifier.

## Explicit forbidden-data contract

The following data must never be passed to the analytics boundary, included in event metadata, or exposed to a vendor's automatic capture system.

### URL and capability material

- `location.href`;
- `location.hash` or any fragment;
- `location.search` or arbitrary query strings;
- arbitrary full path/URL values when a controlled route ID exists;
- Chat/party room IDs if they are high-cardinality or capability-adjacent;
- invite/admission/rendezvous/host/member secrets;
- host private/public key material or fingerprints used for party trust;
- member/credential IDs or verifiers;
- Trystero/WebRTC peer IDs;
- Nostr topics/relay payloads;
- SDP, ICE candidates, WebRTC signaling messages, or network protocol payloads.

### Human content and interaction capture

- Chat messages or drafts;
- names, email addresses, phone numbers, account/profile identifiers;
- free-form player text;
- clipboard contents;
- raw keyboard input/keystrokes;
- pointer/touch paths or click coordinates;
- DOM text, HTML, form contents, or session replay;
- heatmaps or automatically captured element metadata.

### Diagnostics and errors

- `Error` objects;
- exception messages or stack traces;
- arbitrary console output;
- copied diagnostics;
- request/response bodies;
- local-storage/session-storage keys or values;
- IndexedDB contents.

### Device and location data

- precise geolocation;
- IP address supplied explicitly by application code;
- raw User-Agent;
- advertising/device identifiers;
- fingerprints or stable entropy combinations;
- exact screen/viewport dimensions;
- device model;
- OS/browser version;
- CPU count, memory size, graphics renderer, battery state, fonts, canvas fingerprint, or similar fingerprinting inputs.

Ordinary Internet transport necessarily exposes a source network address to the receiving infrastructure. The selected provider must not store or use that address as an analytics visitor identifier/profile, and the application must not add it to the event payload.

## Threat model: accidental analytics leakage

### 1. Automatic pageview capture

Many analytics SDKs read the current URL automatically. On `/chat`, that can place capability-bearing fragments at risk even though fragments are not sent in the normal initial HTTP request.

**Control:** no vendor automatic pageviews. Route events are created from explicit application route IDs.

### 2. Automatic referrer/UTM/query capture

A vendor may collect referrer URLs and marketing parameters by default.

**Control:** classify locally into a small enum; do not send the original value. Query strings are deny-by-default with exact-key/value allow-listing only.

### 3. Error/exception capture

Automatic error tools commonly transmit stack traces, source URLs, messages, breadcrumbs, DOM context, and network context.

**Control:** analytics receives only closed error codes. Broad error monitoring is a separate future architecture/privacy decision.

### 4. Autocapture/replay/heatmaps

Rich product platforms can observe clicks, forms, DOM text, mouse movement, and session state.

**Control:** do not enable these capabilities. Prefer a provider/transport where they are structurally absent rather than merely hidden behind configuration.

### 5. Remote configuration/default drift

A vendor library update or remotely controlled feature can change what is captured.

**Control:** the preferred implementation sends explicit JSON through a first-party typed emitter rather than allowing a general third-party SDK to inspect application state. Pin/lock any dependency if a library is eventually necessary, and test actual network payloads.

### 6. Free-form metadata growth

A harmless-looking generic metadata field becomes a path for URLs, errors, or player text.

**Control:** no `Record<string, unknown>` event properties. Closed enums and catalog/build values only.

### 7. Preview/staging contamination

Vercel preview URLs can create duplicate product data, accidental secret-bearing test traffic, and unstable hostnames.

**Control:** analytics is enabled only when the exact approved production environment/host is active. Preview, local development, test, and diagnostic surfaces use a no-op or local-development sink.

## Identifier/session decision

### Option A — No client ID

**Decision: ADOPT.**

- Browser storage: none for analytics.
- Lifetime: none.
- Vendor exposure: no application-level visitor/session identifier.
- Answers: aggregate traffic, starts, page-load acquisition activation, readiness, restart/completion ratios, controlled errors/performance, release comparisons.
- Does not answer: unique people, cross-session retention, user-level funnels.
- Reset/deletion behavior: no analytics identifier to reset/delete from the browser.
- COPPA/California impact: avoids intentionally creating a persistent analytics identifier; this does **not** by itself resolve all legal questions concerning network addresses, child-directed treatment, vendors, or notice.

The memory-only acquisition/activation context described above is compatible with this option because it contains no random/stable identifier and no value that is emitted for later record linkage. It is discarded on reload/tab close and only supplies approved low-cardinality dimensions/booleans to the individual events themselves.

### Option B — Ephemeral in-memory/session ID

**Decision: DEFER.**

This could correlate page/game events within one open tab/session but still adds an identifier to vendor records. It is unnecessary for the approved first decisions because aggregate event ratios and the non-identifying page-load acquisition context are sufficient.

If later adopted, it should exist only in memory, never local/session storage, and die on reload/tab close. Counsel should still review how an analytics provider combines it with network/device data.

### Option C — Short-lived first-party ID

**Decision: DEFER.**

A 7–30 day cookie/local-storage identifier would support return/replay cohorts but deliberately creates browser recognition across visits. That increases disclosure, deletion/reset, vendor-contract, COPPA persistent-identifier/internal-operations, and California/privacy-law analysis for a metric we do not yet need.

### Option D — Longer-lived persistent first-party ID

**Decision: REJECT for the current architecture.**

A months/years identifier primarily exists for persistent profiles, retention cohorts, lifetime value, and person-level funnels. Those benefits do not currently justify the privacy/compliance/operational cost.

Any future proposal for Options B–D must document necessity, lifetime, storage mechanism, vendor exposure, IP/UA combination behavior, reset/deletion semantics, disclosure/consent requirements, and child/privacy-law treatment before implementation.

## Retention contract

Data minimization includes time as well as fields.

### Browser

- analytics queue is memory-only;
- hard cap: 20 pending events;
- maximum queued age: approximately 30 seconds;
- no localStorage, sessionStorage, IndexedDB, service-worker, or persistent offline analytics queue;
- at most one bounded retry for transient delivery failure;
- on unload/offline/blocking failure, losing analytics is acceptable.

### Hosted event-level data

Initial target: **90 days maximum** for event-level product data.

Ninety days is sufficient for initial release/experiment comparison while keeping raw event history bounded. If the selected vendor cannot enforce a rolling retention window at or below that target, production enablement requires an explicit owner decision and privacy/counsel review rather than silently accepting indefinite/account-lifetime retention.

### Long-term aggregates

If longer trend history becomes useful, retain only low-dimensional daily/weekly aggregate counts for up to approximately 13 months, sufficient for seasonality/year-over-year direction. Do not retain a raw per-event corpus merely because storage is cheap.

The initial implementation does not require a first-party data warehouse. If aggregate export is later used, it must contain only approved event names/dimensions and counts.

## Regulatory and privacy analysis

This section separates established regulatory facts from product-policy choices and questions that require legal counsel. It is architecture guidance, not legal advice.

### Established/current regulatory facts

#### FTC COPPA

As of September 14, 2026, the FTC's 2025 amendments to the Children's Online Privacy Protection Rule are effective and the April 22, 2026 compliance date has passed.

Relevant facts from the current rule/guidance include:

- COPPA applies to child-directed online services under 13 and to general-audience services with actual knowledge that they are collecting personal information from a child under 13.
- COPPA's definition of personal information includes persistent identifiers that can be used to recognize a user over time and across websites or online services.
- The rule/guidance contains a limited exception for persistent identifiers used solely to support internal operations.
- That internal-operations exception does not permit behavioral advertising, contacting a specific individual, or amassing a profile for other purposes.
- The amended rule added an online-notice requirement when an operator relies on the persistent-identifier/support-for-internal-operations exception; the notice must describe categorically how the identifier is used and the operator's policies/practices around that use.
- The 2025 amendments further restrict targeted advertising/third-party disclosure and data retention/minimization practices.

This design avoids intentionally creating an analytics visitor identifier, which materially reduces the need to rely on the persistent-identifier exception for a client ID. It does not establish that every vendor/network operation is outside COPPA.

#### California CCPA/CPRA

If C00lG@mes+ is a covered California “business,” current CCPA/CPRA requirements include privacy notices and consumer rights concerning collection/use, deletion/correction, sale/sharing opt-out, and other covered processing.

Relevant current facts include:

- statutory coverage is threshold- and relationship-dependent; not every website/company is automatically a CCPA business;
- California treats “sharing” for cross-context behavioral advertising separately from ordinary first-party operational processing;
- covered businesses that sell/share personal information must honor valid opt-out preference signals such as Global Privacy Control;
- sale/sharing involving consumers under 16 has affirmative opt-in requirements, with parental authorization for children under 13 and the minor's authorization for ages 13–15;
- California enforcement has specifically addressed gaming/mobile-app SDK configurations, sale/sharing, minors, and privacy-choice handling.

C00lG@mes+' voluntary no-sale/no-cross-context-sharing/no-behavioral-ads posture is deliberately stricter than building an ad-tech flow and then depending on opt-out UI.

#### California child/teen developments

California's child/teen online-design landscape is active and partially unsettled:

- litigation over the California Age-Appropriate Design Code has produced injunction/appellate/remand decisions rather than a simple “fully effective” or “fully invalid” status; exact enforceable scope and application to this product require current counsel review;
- the Protecting Our Kids from Social Media Addiction Act (SB 976) and 2026 proposed implementing regulations focus on minors and features such as addictive feeds/notifications/age assurance. The current C00lG@mes+ product does not contain a social-media addictive feed, but future feed/social mechanics would require a fresh applicability review.

The practical engineering lesson is durable regardless of the litigation outcome: applying a high-privacy default to all players is safer and simpler than trying to infer age merely to decide who receives privacy protection.

### Questions requiring counsel before production analytics enablement

A qualified privacy lawyer should confirm at least:

1. whether the intended/current C00lG@mes+ audience treatment makes the site child-directed, mixed-audience, or general-audience for COPPA purposes;
2. whether the selected provider's ordinary network/IP handling and no-client-ID event processing fit the intended COPPA treatment and contractual/service-provider model;
3. the precise notice obligations for the selected event set/vendor under that audience treatment;
4. whether Aviara/C00lG@mes+ is presently a CCPA-covered business or part of a controlled entity structure that changes applicability;
5. whether the provider contract/DPA meets any service-provider/contractor requirements needed to avoid sale/sharing treatment;
6. the exact GPC/opt-out implementation required under the final vendor/data flow;
7. the then-current enforceable scope of the California Age-Appropriate Design Code and whether any provisions apply to this product;
8. whether SB 976 or its final regulations apply to any current/future party/social/notification feature;
9. whether additional jurisdictions materially relevant to the production audience require additional consent/notice controls. This Issue is not a comprehensive global privacy-law review.

Do not describe the implementation as “COPPA compliant” or “CCPA compliant” merely because it follows this design.

### Voluntary C00lG@mes+ product/privacy choices

Unless a later reviewed decision changes them:

- no sale of personal information;
- no sharing for cross-context behavioral advertising;
- no behavioral/interest-based advertising;
- no cross-site tracking/profile building;
- no fingerprinting;
- no precise geolocation;
- no session replay/heatmaps/DOM recording;
- no raw key/pointer capture;
- no Chat-content analytics;
- no invite/credential/signaling analytics;
- no long-lived analytics identifier;
- no arbitrary full-URL/query/referrer/error capture;
- no analytics data collection on preview/staging/POC environments;
- prefer data minimization over a consent banner used to justify broader collection.

## Vendor/architecture evaluation

Vendor behavior and terms can change. The following reflects public documentation reviewed on September 14, 2026 and must be re-checked immediately before implementation.

### Simple Analytics — **ADOPT WITH CONSTRAINTS**

Why it fits best:

- public product/docs state no cookies, advertising identifiers, cross-site tracking, or visitor profiling;
- public docs state IP addresses are not stored as analytics data/visitor identifiers, while normal infrastructure may necessarily see/use network addresses for security/abuse protection;
- custom events and metadata can be explicit;
- automatic metrics/pageviews can be disabled in supported integrations;
- official current script is small (the documented light script is roughly 1.9 kB gzip; the fuller current script roughly 3.7 kB gzip), although this design prefers **zero third-party analytics JavaScript** if direct event transport can be proven;
- EU-hosted infrastructure/subprocessors are publicly documented;
- export/API capabilities provide portability;
- the public pricing model is understandable at low traffic, including a limited hobby tier and paid usage-based tiers.

Important constraints/blockers:

1. **Do not install the normal automatic browser script by default.** Its default data model can include URL/referrer/UTM and other metrics we do not want to expose automatically.
2. Prefer a tiny C00lG@mes+-owned browser emitter that posts only the typed allow-listed event payload to the provider's event-ingestion endpoint.
3. The provider's documented event-ingestion path is presented as a server-side API. Before adoption, prove in a focused spike that direct browser `fetch` from the static app is supported, has acceptable CORS behavior, and can be sent with `referrerPolicy: 'no-referrer'` without adding unsafe data. Do not assume this from documentation.
4. If safe direct browser transport is not supported, **do not fall back to executing a broad automatic script on secret-bearing `/chat`/party surfaces** merely to keep Simple Analytics. Defer those events or client analytics entirely while reassessing transport/provider options.
5. Public documentation reviewed here does not establish the desired rolling 90-day event-level retention on paid plans. Confirm a configuration/contractual deletion mechanism acceptable to C00lG@mes+ before production, or explicitly review/approve a different retention period.
6. No COPPA-specific contractual safe harbor was found in the public materials reviewed for this Issue. Legal/procurement review must confirm suitability for the intended family/child-audience treatment.
7. Confirm the production terms/DPA/subprocessor list immediately before enablement.

**Recommendation:** leading hosted candidate, but production enablement remains blocked until the transport, retention, contract, and counsel gates pass.

### Plausible — **DEFER**

Strengths:

- no cookies/localStorage visitor identifier;
- privacy-oriented hosted/self-hosted model;
- no raw IP/User-Agent retained in the analytics record according to current public documentation;
- EU hosting, DPA/security documentation, exports/API;
- small browser script and transparent low-volume pricing.

Reason to defer:

Plausible's current public data policy describes a daily rotating visitor identifier derived from a daily salt plus website domain, IP address, and User-Agent. The raw IP/UA are not stored and the salt rotates, but the daily identifier is still deliberately designed to distinguish visitors for that day.

C00lG@mes+ does not currently need even day-level unique-visitor recognition to answer the approved questions. Choosing it would therefore add persistent-identifier/child-privacy analysis for a capability with no demonstrated product value.

Revisit Plausible if a concrete future decision requires daily-unique measurement and counsel concludes that the short-lived identifier model is appropriate.

### PostHog — **DEFER**

Strengths:

- very capable funnels, cohorts, experiments, product analytics, export, and deployment/residency options;
- extensive privacy controls exist, including options around persistence/IP and capture behavior;
- competitive free/low-volume product-analytics pricing.

Reason to defer:

The browser product is intentionally much richer than C00lG@mes+ currently needs. Current JavaScript configuration/documentation exposes automatic capture, persistent anonymous identity, pageview/pageleave data, session replay, error capture, heatmaps and other features that can be controlled but create a larger misconfiguration/default-drift surface.

It is possible to harden PostHog, but “possible to disable” is weaker than “structurally absent” for an all-ages site with capability-bearing URLs and no need for person-level cohorts.

Revisit PostHog only if we later have a concrete requirement for experiments/cohorts/feature analytics that justifies identity and a separate privacy architecture review.

### Google Analytics 4 — **DEFER**

Strengths:

- mature ecosystem and broad reporting/integration capability;
- controls exist for advertising personalization, consent, retention, and some collection behavior.

Reason to defer:

Current GA4 browser documentation describes a first-party `_ga` client identifier used to distinguish users/sessions in normal implementations, plus automatic page/URL/device/browser/approximate-location collection surfaces. Event-level retention for standard GA4 properties is substantially longer than the initial C00lG@mes+ target when configured to the normal available options.

Those capabilities solve broader marketing/user analytics problems than the approved measurement questions. The Google advertising/product ecosystem also increases the governance burden for an all-ages product even when ad personalization features are disabled.

Do not add GA4 merely because it is common or free.

### Small first-party collector — **DEFER**

A custom endpoint/database can provide maximal schema/retention control but is not automatically safer.

It would create new obligations for:

- Internet-facing abuse/rate limiting;
- request IP/log handling;
- authentication/validation;
- data retention/deletion;
- database/security operations;
- availability/cost monitoring;
- privacy/security incident response.

That conflicts with the current static AWS direction unless evidence shows the hosted privacy-oriented provider cannot meet the contract. Do not add Lambda/API Gateway/DynamoDB/another backend solely to avoid a small hosted analytics service.

### Search Console + CloudFront/CloudWatch only — **DEFER AS THE SOLE LONG-TERM STRATEGY; ACCEPT AS FALLBACK**

This is the safest temporary state and remains acceptable while vendor/legal gates are unresolved. It answers search discovery and delivery-health questions without a client analytics implementation.

It cannot answer game starts, readiness, restarts/completions, curated runtime errors, or game-specific performance. Therefore it is not the preferred permanent product-measurement strategy if the narrow hosted event architecture passes its gates.

## Hosted-provider comparison

| Dimension | Simple Analytics | Plausible | PostHog | GA4 |
| --- | --- | --- | --- | --- |
| First-party persistent analytics ID in recommended/default web model | No visitor ID per current docs | Daily rotating visitor ID derived from domain + IP + UA + salt | Anonymous/distinct identity and persistence available/default in normal JS setup | `_ga` client ID in normal implementation |
| Raw IP stored as analytics record | Vendor says no | Vendor says no; transient input to daily hash | Configurable/data-control dependent | Google says IP not logged/stored in GA, but request reaches Google infrastructure |
| Profile/cohort orientation | Low | Low/moderate aggregate | High-capability product analytics | User/session analytics |
| Session replay/autocapture | Not core product behavior | Not core product behavior | Available; must be explicitly constrained | Automatic/enhanced measurement features available |
| Safe explicit event allow-list possible | Yes | Yes | Yes, but broader SDK surface remains | Yes, but broader measurement/identity surface remains |
| Public retention fit for desired <=90-day event target | Must be confirmed | Standard plans document much longer retention | Configurable product/plan-dependent; requires review | Standard event-level options commonly 2/14 months |
| Data residency reviewed | EU-oriented/current subprocessor list | EU hosting | US/EU options | Global Google infrastructure/terms |
| Portability/export | API/export | API/export | Strong export ecosystem | Export/integrations available |
| Browser overhead | Very small official scripts; selected architecture aims for 0 vendor JS | Small script | Larger/richer SDK surface | Broader tag/runtime surface |
| Operational burden | Low | Low | Low/moderate governance | Low technical, higher governance |
| Children/family fit for current minimal questions | Best candidate, still needs counsel/contract review | Privacy-oriented but daily ID is unnecessary | Technically configurable but overpowered | Structurally mismatched to minimal/no-ID goal |
| Recommendation | **ADOPT WITH CONSTRAINTS** | **DEFER** | **DEFER** | **DEFER** |

## Preferred implementation architecture

If the Simple Analytics gates pass, the target data path is:

```text
React shell / catalog / game lifecycle / Chat semantics
                |
                | typed semantic calls only
                v
     C00lG@mes+ analytics facade
       - compile-time event union
       - runtime allow-list validation
       - production-host gate
       - local acquisition mapping
       - memory-only acquisition/activation context (no identifier)
       - secret/URL/error deny rules
       - bounded memory queue
                |
                | explicit JSON only
                | no referrer / no cookies / no client ID
                v
      hosted event-ingestion endpoint
                |
                v
       aggregate product reporting
```

The analytics facade must not accept `Location`, `URL`, `Error`, DOM elements, `Request`/`Response`, arbitrary metadata maps, or arbitrary free-form strings from callers.

### Third-party JavaScript rule

Preferred v1: **zero third-party analytics JavaScript in the application runtime**.

If direct hosted-event ingestion cannot be made to work safely from a static browser app, the next decision is not automatically “install the vendor script.” Reassess the provider/transport or defer product analytics, especially on `/chat`/party surfaces.

### Content Security Policy

When #22/#23 production headers are implemented, the analytics implementation should keep `connect-src` limited to the exact approved ingestion endpoint(s). A no-vendor-script architecture avoids adding a vendor analytics origin to `script-src`.

CSP is defense in depth, not the primary data contract.

## Performance contract

Analytics is never part of gameplay correctness or the rendering critical path.

### Initialization

- initialize asynchronously after the application is interactive/idle enough that analytics cannot delay Home/Games/game startup;
- do not await analytics from navigation, game initialization, input, restart, completion, Chat, or networking flows;
- disabled/blocked/offline analytics is normal and silent from the player's perspective.

### Queue/retry bounds

- memory-only queue;
- maximum 20 queued events;
- maximum queued age approximately 30 seconds;
- when full, drop old/low-value analytics rather than block gameplay;
- at most one bounded retry;
- no retry storm, service worker, IndexedDB queue, or background sync requirement.

### Frequency

- no per-frame emissions;
- no raw frame samples sent;
- one aggregate performance event maximum per game run;
- one route page view per recognized route transition;
- semantic game/party events only when the product action occurs.

### Payload and bundle budgets for the implementation PR

- preferred third-party analytics JavaScript: **0 bytes**;
- first-party analytics adapter target: **<2 kB gzip** incremental production JavaScript, measured rather than assumed;
- each event payload target: **<1 kB** JSON;
- no new dependency unless the implementation Issue proves a dependency materially safer/smaller than native `fetch` plus the typed boundary;
- analytics network activity must remain outside high-frequency game loops.

Simple Analytics' current official script sizes are small enough that performance alone would not reject it, but the zero-third-party-script preference is driven primarily by the capability/automatic-capture threat model rather than byte count.

## Blocked/ad-blocked/offline behavior

Analytics loss must not affect product behavior.

If a browser, privacy tool, DNS filter, network, or user preference blocks analytics:

- the event is dropped after bounded retry;
- no error UI is shown to the player;
- no game/Chat/navigation behavior changes;
- dashboards are interpreted as **observed eligible traffic**, not an authoritative count of every player.

CloudFront aggregate request volume can be compared at a coarse trend level to understand analytics coverage, but datasets must not be joined into person-level records.

## GPC and privacy-preference handling

Under the intended no-sale/no-cross-context-sharing architecture, product analytics is not supposed to be an opt-out behavioral advertising flow. Nevertheless, the implementation should centralize privacy-signal handling so future features cannot bypass it.

Before production enablement, counsel should confirm the selected vendor contract/data use and whether CCPA/GPC requires product analytics itself to be disabled for a valid signal under the final facts.

Regardless of that conclusion:

- GPC must always disable any future processing that constitutes sale/sharing/cross-context behavioral advertising;
- adding ads, broader third-party SDKs, persistent profiling, or other processing cannot reuse the current “minimal internal analytics” determination without re-review;
- if we voluntarily choose to suppress even minimal analytics for GPC/DNT users, do it centrally in the facade rather than vendor-by-vendor.

## Production readiness gates

Do not enable product analytics on `coolgamesplus.com` until every applicable gate below is complete.

### Legal/privacy

- audience treatment (child-directed/mixed/general) reviewed by counsel;
- current CCPA business applicability reviewed;
- vendor data flow/contract assessed for COPPA/California treatment;
- privacy policy updated with product analytics purpose, provider, categories, retention, and choices;
- notice at collection added where legally required and written in an all-ages understandable form;
- if any persistent-identifier/internal-operations exception is ultimately relied on, include the required categorical persistent-identifier/internal-operations notice;
- GPC/opt-out behavior documented for the final data flow;
- no sale/share/cross-context advertising language matches actual contracts/configuration, not merely product intent.

### Vendor governance

- current vendor terms/privacy/security docs reviewed;
- DPA/service-provider/contractor terms reviewed where applicable;
- current subprocessor list recorded;
- EU/other data-residency decision recorded;
- retention/deletion behavior verified against the <=90-day event-level target;
- account/admin access uses least privilege/MFA where available;
- export/deletion procedure documented;
- owner assigned to re-review material vendor term/subprocessor changes.

### Technical/privacy validation

Use synthetic canaries and inspect actual outbound requests, not only code/configuration.

At minimum validate production-like routes containing:

- a synthetic `/chat#room=CANARY&host=CANARY&invite=CANARY` fragment;
- an arbitrary `?secret_canary=...` query;
- synthetic Chat message text;
- a synthetic thrown `Error` with a unique message/stack marker;
- local-storage values containing a canary;
- copied diagnostic text containing a canary.

Verify that no canary appears in:

- analytics network requests;
- provider raw-event/export data;
- dashboard dimensions/properties;
- application/vendor logs under our control.

Also verify:

- preview/staging/dev hosts emit no production analytics;
- POC/diagnostic routes emit no product analytics;
- blocked endpoint/offline behavior does not affect gameplay;
- queue/retry bounds hold;
- no cookies/local/session/IndexedDB analytics identity is created;
- bundle/runtime/network budgets are measured on representative desktop/mobile hardware.

## Governance after launch

### Event registry

The typed event union is the data inventory. Adding a new event/property is a privacy/product architecture change, not an ad-hoc dashboard request.

Every addition must answer:

1. what decision does it support?
2. can the question be answered with a less identifying/less frequent field?
3. what is the minimum retention?
4. does it require browser recognition across visits?
5. what happens when it is blocked?

### Release review triggers

Re-open privacy architecture before adding any of the following:

- behavioral/contextual advertising SDKs where data leaves our control beyond the current contract;
- sale/sharing/cross-context behavioral advertising;
- accounts, profiles, email/phone collection, or login identity;
- a persistent analytics/client/device identifier;
- A/B experiment identity/cohorts;
- session replay, heatmaps, DOM/interaction capture;
- broad crash/error SDKs with stack/breadcrumb/network capture;
- precise location;
- fingerprinting/device entropy;
- expanded Chat/social/feed/moderation/reporting data collection;
- data warehouse/customer-data-platform integration;
- materially new jurisdictions/audience treatment.

## Implementation prerequisites and proposed follow-up Issues

Do not combine unresolved vendor/legal readiness with broad production instrumentation in one opaque implementation PR.

### Follow-up A — Validate hosted analytics transport and contract

**Proposed title:** `Validate privacy-minimized hosted analytics transport and vendor contract`

Outcome:

- confirm Simple Analytics' then-current browser-safe explicit event-ingestion/CORS behavior without vendor automatic scripts;
- prove `referrerPolicy: 'no-referrer'` and exact payload behavior in a focused browser spike;
- verify no cookies/identifier/URL/referrer/UA are added by the chosen path beyond unavoidable transport-layer network metadata;
- confirm <=90-day raw/event retention or explicitly resolve the mismatch;
- record current DPA/terms/subprocessors/residency/export/deletion behavior;
- complete counsel/audience/applicability review;
- decide **GO / GO WITH CONSTRAINTS / NO-GO**.

No broad event instrumentation should land if this gate is NO-GO.

### Follow-up B — Implement the typed analytics facade and v1 event contract

**Proposed title:** `Implement privacy-minimized product analytics event contract`

Blocked on Follow-up A GO decision.

Outcome:

- add the closed TypeScript event contract/facade;
- enable only on canonical production host;
- implement local acquisition mapping without raw URLs/referrers/query capture;
- retain only coarse acquisition/first-entry/first-start state in memory for the current page load; generate or emit no visit/session identifier;
- propagate approved acquisition fields onto `game_start` and validate page-load activation reporting;
- instrument approved page/game/party semantics;
- implement bounded performance samples;
- add canary/privacy tests and blocked/offline tests;
- measure bundle/network/runtime overhead;
- verify actual provider export contains only the allow-list;
- publish the required privacy/notice/retention/vendor documentation before enabling production collection.

No persistent client ID, session ID, session replay, autocapture, or ad-tech SDK is part of this Issue.

### Follow-up C — Review first measurement window

**Proposed title:** `Review initial product analytics measurement window`

After sufficient real traffic (for example a defined 30-day window), review whether the approved events actually changed product decisions.

Remove low-value events before adding more. Only raise the identifier/retention question if a specific business decision remains impossible with aggregate data.

## Final recommendation

### Product architecture — **ADOPT**

Adopt a no-client-ID/no-session-ID, explicitly typed, allow-listed product analytics boundary. A small non-identifying memory-only page-load context may carry coarse acquisition and first-entry/first-start state so acquisition activation can be measured without record-linking identity. This is enough for the next product decisions and materially reduces privacy, security, child-audience, and vendor-default risk.

### Hosted provider — **ADOPT WITH CONSTRAINTS: Simple Analytics**

It is the best current hosted fit among the reviewed candidates because its public model is closest to event counting without visitor profiles. However, **do not enable it yet**. Safe direct browser event transport, retention, contract/subprocessors, and counsel/audience treatment are blocking prerequisites.

If those constraints cannot be met, the correct fallback is **DEFER client product analytics and operate temporarily with Search Console + CloudFront/CloudWatch aggregate observability**, not to weaken the data contract.

### Persistent identity — **DEFER/REJECT for v1**

There is no demonstrated product decision that justifies recognizing a browser across visits or emitting a session identifier. Revisit only through a separate Issue with explicit necessity and legal/privacy review.

### First-party analytics backend — **DEFER**

Do not add application compute/database infrastructure solely for analytics while the studio is intentionally simplifying toward static AWS delivery.

## Sources reviewed

Primary/regulatory and vendor sources reviewed on 2026-09-14. Vendor behavior/pricing/terms must be re-checked at implementation time.

### FTC / COPPA

- FTC — [16 CFR Part 312: COPPA Final Rule Amendments](https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments)
- Federal Register / GovInfo — [Children's Online Privacy Protection Rule, final rule (2025)](https://www.govinfo.gov/content/pkg/FR-2025-04-22/pdf/2025-05904.pdf)
- FTC — [Complying with COPPA: Frequently Asked Questions](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- FTC — [FTC Finalizes Changes to Children's Privacy Rule](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data)

### California

- California Attorney General — [California Consumer Privacy Act (CCPA)](https://oag.ca.gov/privacy/ccpa)
- California Attorney General — [Global Privacy Control](https://oag.ca.gov/privacy/ccpa/gpc)
- California Privacy Protection Agency — [Frequently Asked Questions](https://cppa.ca.gov/faq/)
- California Privacy Protection Agency — [CCPA threshold adjustments](https://cppa.ca.gov/regulations/cpi_adjustment.html)
- California Attorney General — [Jam City gaming CCPA settlement (2025)](https://oag.ca.gov/news/press-releases/attorney-general-bonta-secures-14-million-settlement-mobile-app-gaming-company)
- California Attorney General — [Tilting Point children's privacy settlement (2024)](https://oag.ca.gov/news/press-releases/attorney-general-bonta-la-city-attorney-feldstein-soto-announce-500000)
- Ninth Circuit — [NetChoice v. Bonta, No. 25-2366 opinion (2026)](https://cdn.ca9.uscourts.gov/datastore/opinions/2026/03/12/25-2366.pdf)
- California Attorney General — [SB 976 / Protecting Our Kids from Social Media Addiction Act](https://oag.ca.gov/sb976)

### AWS observability

- AWS — [CloudFront reports and monitoring](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/reports-and-monitoring.html)
- AWS — [CloudFront standard log field reference](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logs-reference.html)

### Simple Analytics

- [Data collection](https://docs.simpleanalytics.com/data-collection)
- [React integration/options](https://docs.simpleanalytics.com/install-simple-analytics-with-react)
- [Events](https://docs.simpleanalytics.com/events)
- [Server-side events API](https://docs.simpleanalytics.com/events/server-side)
- [Metadata](https://docs.simpleanalytics.com/metadata)
- [Light script](https://docs.simpleanalytics.com/light)
- [Data security and ownership](https://docs.simpleanalytics.com/data-security-and-ownership)
- [Subprocessors](https://www.simpleanalytics.com/subprocessors)
- [Data Processing Agreement](https://www.simpleanalytics.com/data-processing-agreement)
- [Pricing](https://www.simpleanalytics.com/pricing)
- [API/export](https://docs.simpleanalytics.com/api)

### Plausible

- [Data policy](https://plausible.io/data-policy)
- [Data Processing Agreement](https://plausible.io/dpa)
- [Security](https://plausible.io/security)
- [Subscription plans](https://plausible.io/docs/subscription-plans)
- [Data/API access](https://plausible.io/docs/data-access)

### PostHog

- [JavaScript configuration](https://posthog.com/docs/libraries/js/config)
- [Privacy documentation](https://posthog.com/docs/privacy)
- [Product/pricing](https://posthog.com/)
- [Trust center](https://trust.posthog.com/)

### Google Analytics

- Google Analytics Help — [Analytics cookies / identifiers](https://support.google.com/analytics/answer/11593727)
- Google Analytics Help — [Data retention](https://support.google.com/analytics/answer/7667196)
- Google Analytics Help — [IP / data collection controls](https://support.google.com/analytics/answer/12017362)
- Google — [How Google uses information from sites or apps that use our services](https://policies.google.com/technologies/partner-sites)

## Repository references

- [Issue #39](https://github.com/WestonSavignano/C00lG-mes-/issues/39)
- [Issue #38](https://github.com/WestonSavignano/C00lG-mes-/issues/38)
- [Issue #20](https://github.com/WestonSavignano/C00lG-mes-/issues/20)
- [Issue #21](https://github.com/WestonSavignano/C00lG-mes-/issues/21)
- [Issue #22](https://github.com/WestonSavignano/C00lG-mes-/issues/22)
- [Issue #23](https://github.com/WestonSavignano/C00lG-mes-/issues/23)
- [Client-only host-authoritative networking design](./2026-09-14-client-only-host-authoritative-networking-design.md)
- [`AGENTS.md`](../../../AGENTS.md)
- [`ROADMAP.md`](../../../ROADMAP.md)
- [`README.md`](../../../README.md)
