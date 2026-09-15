# Zero-Cost Analytics and Observability Stack

Date: 2026-09-14  
Status: Proposed decision for Issue #52; **no analytics or observability SDK is authorized by this document alone**  
Owning issue: #52  
Canonical production domain: `https://coolgamesplus.com`

## Decision summary

Cool Games Plus should launch with a **$0-first measurement and observability posture** while preserving the privacy/security contract already approved in Issue #39 / PR #44.

This document **supersedes only the provider-selection/cost recommendations** in the September 14 Issue #39 analytics design and vendor appendix. The #39 data-minimization architecture remains authoritative: no analytics client/session ID, no persistent behavioral profile, no session replay, no autocapture, no arbitrary URL/referrer/error forwarding, no Party/Chat capability leakage, and no broad third-party SDK surface merely because a vendor offers it.

The current provider decisions are:

| Capability | Decision | Launch cost | Why |
| --- | --- | ---: | --- |
| Google Search Console | **ADOPT** | $0 | Search discovery/indexing/query intelligence; no client analytics SDK |
| CloudFront + CloudWatch default metrics | **ADOPT** | $0 additional metric cost | Production request/transfer/error health from the hosting layer |
| Cloudflare Web Analytics | **ADOPT WITH CONSTRAINTS, NOT YET ENABLED** | $0 | Strong privacy/cost fit, but current non-proxied controls do not prove the private `/chat#...` capability boundary without a real canary and route-loading contract |
| Sentry Developer | **ADOPT WITH CONSTRAINTS, NOT YET ENABLED** | $0 | Useful browser error/release observability if capture is explicit, aggressively sanitized, Replay is absent, and synthetic-secret canaries pass |
| PostHog | **DEFER** | $0 at current low volume | Free tier is generous, but normal JS defaults/identity/session surface conflict with #39's no-ID/no-autocapture v1 contract |
| Simple Analytics | **DEFER** | paid for intended production use | Good privacy fit from #39, but no longer preferred under the explicit $0-first constraint while transport/retention gates remain unresolved |
| Plausible / GA4 | **DEFER** | paid / $0 respectively | No material advantage over the lower-cost/minimal path that justifies their identity/governance tradeoffs |

**Launch baseline:** Search Console + CloudFront/CloudWatch. Add Cloudflare Web Analytics and Sentry only after the focused implementation canaries below prove they cannot leak private Party/Chat state. Do not add PostHog until a named product decision needs curated event analytics that the aggregate stack cannot answer.

## Locked privacy architecture from #39

Issue #52 does not reopen these decisions.

### Identity

- no analytics client ID;
- no analytics session ID;
- no cookie/localStorage/sessionStorage/IndexedDB identity for analytics;
- no cross-visit recognition;
- no user/person profiles;
- no fingerprinting;
- no precise geolocation.

### Party/Chat secret boundary

No analytics or observability provider may receive or derive:

- `location.hash` or any URL fragment;
- Party/Chat invite, rendezvous, admission, host, or member capabilities;
- party/member/peer identifiers when they are capability-adjacent or high-cardinality;
- WebRTC signaling payloads, SDP, ICE candidates, Nostr topics, or relay payloads;
- Chat messages or drafts;
- browser-local credentials, storage contents, or copied diagnostics.

### Automatic-capture boundary

Do not enable:

- session replay;
- DOM recording;
- heatmaps;
- click/keystroke/pointer autocapture;
- arbitrary page URL/query/referrer capture;
- raw request/response body capture;
- automatic error/breadcrumb/network capture that cannot be reduced to an explicit reviewed allow-list.

### Failure/performance behavior

Measurement must remain outside gameplay correctness and the rendering critical path. Blocking, offline behavior, provider outage, ad blockers, or quota exhaustion must silently reduce observability rather than change gameplay, navigation, Party, or networking behavior.

## 1. Search Console — ADOPT

Search Console remains the source for:

- Google indexing/canonical state;
- search queries;
- impressions/clicks;
- sitemap/index coverage;
- crawl/search diagnostics.

It requires no production analytics JavaScript and does not duplicate game/product event collection.

Issue #38 owns the Search Console launch/canonical-domain workflow.

## 2. CloudFront + CloudWatch — ADOPT

AWS currently documents that CloudFront automatically publishes default distribution metrics to CloudWatch at **no additional metric cost**.

Default distribution metrics include:

- `Requests`;
- bytes downloaded/uploaded;
- 4xx error rate;
- 5xx error rate;
- total error rate.

CloudFront also publishes edge-function operational metrics. Additional distribution metrics such as cache hit rate and origin latency are separately billable and should remain off until a concrete operational question requires them.

CloudWatch alarms use normal CloudWatch alarm pricing. Do not create a dashboard/alert forest merely because metrics exist. #22 should add only actionable alarms whose value justifies even small recurring cost; the $0-first posture does not require pretending that every useful alert is free.

### Raw access logs

Keep broad CloudFront standard access logging **disabled by default**.

Request-level access logs can contain viewer IP, User-Agent, URI/query/referrer and are not a privacy-free product-analytics substitute. Enable them later only for a concrete operational/security need with explicit retention and access controls.

### Decision

CloudFront/CloudWatch is the production infrastructure-observability baseline. It does not answer game-start/replay/Party product questions and should not be stretched into product analytics.

Current AWS references:

- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/monitoring-using-cloudwatch.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/viewing-cloudfront-metrics.html

## 3. Cloudflare Web Analytics — ADOPT WITH CONSTRAINTS, NOT YET ENABLED

Cloudflare Web Analytics is economically and conceptually attractive, but production enablement requires more evidence than the vendor's privacy positioning alone.

### What current documentation establishes

As of September 14, 2026, Cloudflare documents that Web Analytics:

- is free;
- works for sites that are **not** proxied/hosted by Cloudflare through a manually embedded JavaScript beacon;
- does not require moving DNS or hosting to Cloudflare;
- is limited to 10 non-proxied sites per account;
- uses no cookies or localStorage for analytics;
- does not fingerprint individuals using IP, User-Agent, or other data for analytics display;
- does not log query strings;
- does not support custom events;
- supports six months of accessible Web Analytics data;
- automatically measures SPA route changes unless the manual snippet sets `spa: false`;
- exposes dimensions including country, host, path, referrer host/path, device type, browser, and operating system;
- updated the beacon on September 2, 2026 to include OS/browser/engine versions in the beacon payload.

Relevant references:

- https://developers.cloudflare.com/web-analytics/about/
- https://developers.cloudflare.com/web-analytics/get-started/
- https://developers.cloudflare.com/web-analytics/limits/
- https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/
- https://developers.cloudflare.com/web-analytics/configuration-options/rules/
- https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/
- https://developers.cloudflare.com/web-analytics/faq/
- https://developers.cloudflare.com/web-analytics/changelog/

### Why it is not an unconditional launch approval

The Cool Games Plus threat model is unusual because private Party capabilities live in browser-visible fragments on `/chat#...`.

Cloudflare's documentation is reassuring but insufficient for our exact boundary:

1. The non-proxied/manual-snippet path has **no Web Analytics path Rules**; Cloudflare documents Rules as available only to proxied sites.
2. The beacon executes in the browser and automatic SPA measurement observes route transitions unless explicitly disabled.
3. Cloudflare documents that query strings are not logged, but the current public documentation reviewed for #52 does **not explicitly guarantee that URL fragments are never read or emitted by `beacon.min.js`**.
4. The September 2026 beacon now includes OS/browser/engine versions. Cloudflare says it does not fingerprint users, but this still broadens the payload compared with the minimum data #39 would design ourselves.
5. Cloudflare's FAQ says the non-proxied ingestion path requires a valid `Referer` or `Origin` signal. That is compatible with ordinary web use but means we should inspect the actual outbound request rather than assuming only our desired fields exist.

A fragment is not sent in normal HTTP requests/referrers, but that HTTP property is not enough: a browser JavaScript analytics beacon can read `window.location` itself. Our requirement is stronger: **prove the actual beacon never transmits the synthetic capability canary**.

### Required architecture if adopted

Do not place one global Cloudflare beacon in the generic application shell and rely on configuration.

The safe target is:

- manual snippet only;
- `spa: false`;
- include the beacon only in generated **public/indexable** static documents such as `/`, `/games`, `/party`, and published game routes;
- exclude the beacon from `/chat`, POC, diagnostic, preview, and 404 documents;
- entering a capability-bearing `/chat#...` session from a public page must use a **full-document navigation** so the public document/beacon is destroyed before the private Chat document executes;
- `/chat/index.html` contains no Cloudflare Web Analytics script;
- do not add Cloudflare solely to support analytics route rules; AWS remains production hosting/DNS.

This architecture deliberately gives up SPA route auto-tracking in exchange for a much stronger private-route boundary. The generated route-specific documents planned by #38 make this practical.

### Required canary before enablement

A focused implementation/spike must obtain a real Cloudflare Web Analytics site token and inspect network requests for synthetic values.

At minimum exercise:

- `https://coolgamesplus.com/?secret_canary=QUERY_CANARY`;
- `https://coolgamesplus.com/#FRAGMENT_CANARY` on a public route;
- navigation from `/party` to `/chat#v=2&party=CANARY&r=CANARY&a=CANARY&host=CANARY` using the proposed hard-navigation boundary;
- direct load of the no-beacon `/chat#...` document;
- public SPA/client navigation while `spa: false`;
- blocked/ad-blocked/offline behavior.

Verify no fragment/capability canary appears in:

- Cloudflare beacon request URL/body/headers under application control;
- dashboard path/referrer dimensions;
- any available raw/debug view/export under our account.

If this cannot be proven, **do not enable Cloudflare Web Analytics**. Search Console + CloudFront/CloudWatch remains an acceptable zero-cost fallback.

### Decision

**ADOPT WITH CONSTRAINTS.** Cloudflare is the preferred free aggregate web/RUM candidate, but production activation is blocked on the canary and route-loading contract above.

## 4. Sentry Developer — ADOPT WITH CONSTRAINTS, NOT YET ENABLED

Sentry is useful for a different problem than product analytics: operational detection of browser/runtime failures correlated to a controlled release.

### Current free-tier fit

Sentry's current public pricing lists the Developer plan at **$0** for one user and includes:

- Error Monitoring and Tracing;
- email alerts/notifications;
- 10 custom dashboards;
- 5,000 errors;
- 5 million spans;
- 50 Session Replays;
- 30-day lookback.

The fact that Replay is included does **not** authorize its use.

Reference:

- https://sentry.io/pricing/

### Privacy/security controls currently available

Sentry's current project/organization APIs expose:

- server-side data scrubbing;
- built-in/default sensitive-field scrubbing;
- custom sensitive fields;
- advanced Relay PII scrubbing rules;
- `scrubIPAddresses` to discard client IP addresses.

References:

- https://docs.sentry.io/api/projects/update-a-project/
- https://docs.sentry.io/api/organizations/update-an-organization/

These are useful defense in depth, not permission to send arbitrary application data first.

### Required Cool Games Plus capture model

Do **not** initialize Sentry with broad browser defaults and then hope scrubbing is sufficient.

The first implementation should be an explicit operational-error boundary:

- Session Replay integration absent/disabled;
- no automatic user identification;
- no user IDs, email, username, IP, room/member/peer IDs;
- no browser-local storage values;
- no Chat/Party messages or capabilities;
- no request/response bodies;
- no automatic network breadcrumbs;
- no arbitrary console breadcrumbs;
- no raw copied diagnostics;
- no arbitrary full URLs/query strings/fragments;
- no product analytics events in Sentry.

Prefer controlled application error categories such as:

- `route_chunk_load_failed`;
- `game_runtime_init_failed`;
- `game_rendering_unsupported`;
- `party_runtime_init_failed`;
- `party_transport_unavailable` only when the value is a reviewed coarse category, not a signaling/ICE dump.

Allowed context should be low-cardinality and explicit:

- `releaseId`;
- environment = production;
- controlled `routeId`;
- catalog `gameId` when applicable;
- coarse `clientClass` already defined by #39;
- controlled error code.

### Unexpected JavaScript errors

Raw `Error` messages, breadcrumbs, and request context are not automatically safe for an application with secret-bearing URL fragments and peer messaging.

The first implementation should therefore **not enable broad global error capture until a synthetic-secret canary proves the exact payload after client-side filtering and server-side scrubbing**.

If unexpected-error stack frames are later retained for debugging, the implementation must at minimum:

- replace exception values/messages with a controlled category;
- strip request URL/query/fragment information;
- remove user data;
- remove breadcrumbs unless individually allow-listed;
- strip source URLs to safe static path/release information where practical;
- retain only the minimum stack frame/module/line information required to locate code;
- verify source-map upload is build-time only and contains no secrets;
- enable project/org IP scrubbing.

If those controls destroy too much debugging value, defer Sentry rather than weakening the secret boundary.

### Required canary before enablement

Use synthetic markers in:

- `/chat#...` fragment;
- query string;
- thrown error message;
- breadcrumb-like navigation text;
- localStorage/sessionStorage;
- Chat message text;
- copied diagnostics.

Trigger every enabled Sentry capture path and verify no marker appears in the event payload, Sentry issue/event UI, export/API response, or source-map artifacts.

Also verify:

- Replay is absent;
- no analytics/user/session cookie or browser storage is created by our Sentry configuration;
- blocked Sentry ingestion does not alter product behavior;
- quota exhaustion fails silently from the player's perspective.

### Decision

**ADOPT WITH CONSTRAINTS.** Sentry Developer is the preferred free browser-error candidate, but it must ship through a separate, explicit sanitization/canary implementation Issue. It is not part of #52's documentation PR.

## 5. PostHog — DEFER

PostHog remains attractive economically but is still a poor v1 structural fit for #39.

### Current price

PostHog currently advertises:

- Product Analytics: **1 million events/month free**;
- then approximately `$0.00005/event` at the first paid band;
- no credit card required to start.

Reference:

- https://posthog.com/

### Current JavaScript defaults broaden the risk surface

PostHog's September 2026 JavaScript configuration documents defaults/features including:

- `autocapture: true`;
- `capture_pageview: true`;
- `capture_pageleave: true`;
- dead-click capture enabled by default;
- persistence default `localStorage+cookie`;
- cross-subdomain cookie default `true`;
- cookie expiration default 365 days;
- `person_profiles` default `identified_only`;
- session identity/bootstrap concepts;
- optional/remote-controlled exception, heatmap, performance and replay features;
- cookieless mode that still uses a privacy-preserving identity hash generated on PostHog servers.

PostHog also supports controls such as `autocapture: false`, `capture_pageview: false`, `disable_persistence: true`, `disable_session_recording: true`, `person_profiles: 'never'`, property deny-lists, and `before_send`.

Reference:

- https://posthog.com/docs/libraries/js/config

### Why defer despite the free tier

The v1 #39 contract intentionally has **no analytics client ID and no analytics session ID**. PostHog's product model remains identity/session-aware even when persistence and person profiles are constrained, and the normal SDK defaults are far broader than our approved event questions.

The engineering question is not “can we turn enough switches off?” It is “does this platform add material decision value that justifies the misconfiguration/default-drift surface?” Today, no.

Revisit PostHog only when a named business/product decision needs capabilities such as richer funnels, experiments, cohorts, or curated product events that cannot be answered by Search Console + aggregate web/RUM + operational error metrics. Any future adoption must begin from explicit allow-listed events with autocapture/replay/pageview/pageleave/persistence/person profiles disabled and must re-run the #39 privacy review if identity is proposed.

## 6. Simple Analytics / Plausible / GA4

### Simple Analytics — DEFER under $0-first constraint

Issue #39 correctly found Simple Analytics to be a strong privacy-oriented candidate. That finding remains useful historical evidence.

However:

- the intended production use is paid at the traffic levels/plans reviewed in #39;
- its direct browser explicit-event transport and desired retention were still unresolved;
- the current product owner direction is to prefer a safe $0 stack until traffic/business value justifies payment.

Therefore Simple Analytics is no longer the leading launch provider. Revisit if the free candidates fail their security gates and paid product analytics becomes important enough to justify the cost.

### Plausible — DEFER

Plausible remains privacy-oriented but introduces a daily visitor-identity calculation we do not need and costs money at the intended hosted tier. There is no current reason to prefer it over the zero-cost aggregate candidates.

### GA4 — DEFER

GA4 is free but remains structurally broader than the no-ID/no-advertising/no-autocapture posture. Zero license price does not make its normal user/session/marketing measurement model a good fit for this all-ages product.

## Cost model

### Launch target

| Component | Expected SaaS/tool cost | Notes |
| --- | ---: | --- |
| Search Console | $0 | Search intelligence |
| CloudFront Free flat-rate plan | $0 target | #22 owns eligibility/feature validation and separately billable AWS features |
| CloudFront default CloudWatch metrics | $0 additional metric cost | Requests/bytes/error rates |
| Cloudflare Web Analytics | $0 | Only after canary; otherwise omitted |
| Sentry Developer | $0 | Only after canary; 1 user / 5k errors / 30-day lookback current plan |
| PostHog | $0 while under 1M events | **Deferred**, so launch usage is zero |
| Plausible | $0 | Not used |
| Simple Analytics | $0 | Not used |

The intended launch SaaS analytics/observability cost is **$0/month**.

This does not mean the entire AWS account is mathematically guaranteed to bill $0. #22 must identify any AWS services/features outside the CloudFront flat-rate plan, and CloudWatch alarms/additional metrics have their own pricing. The correct promise is **$0-first and near-zero baseline**, not “AWS can never charge us.”

### Cost escalation gates

Pay for analytics/observability only when one of these becomes true:

1. real traffic exceeds a free limit and the data demonstrably changes product/reliability decisions;
2. a paid capability materially reduces player-facing downtime/defects;
3. a paid provider is the simplest safe way to answer a business question the free stack cannot answer;
4. external distribution/revenue makes deeper product analytics economically justified.

Do not upgrade merely for headroom.

## Recommended implementation sequence

### A. Now — no new production SDK

- keep #39 privacy architecture authoritative;
- use Search Console at canonical launch per #38;
- implement CloudFront/CloudWatch baseline with #22;
- do not add Cloudflare, Sentry, or PostHog in #52.

### B. After #38 static route documents exist — Cloudflare canary

Create one focused implementation/spike Issue that:

- creates/uses the Cloudflare Web Analytics site token;
- injects the manual `spa: false` snippet only into public/indexable static documents;
- leaves `/chat`, POC, preview, diagnostics, and 404 documents beacon-free;
- makes transition from public Party to private `/chat#...` a hard document navigation;
- executes the synthetic-secret canary;
- either enables Cloudflare or removes it entirely based on evidence.

If the canary fails, do not add another paid analytics service automatically. Keep the zero-client-analytics fallback until a real measurement gap matters.

### C. Independent Sentry implementation

Create a separate focused Issue/PR for Sentry because error monitoring has a different data contract and rollback surface from web analytics.

The implementation must:

- use Developer/free tier initially;
- omit Replay;
- enable IP/data scrubbing;
- use explicit controlled error codes/context;
- perform client-side deny-by-construction filtering plus server-side defense in depth;
- pass the synthetic-secret canary before production activation;
- remain independently removable without affecting Cloudflare/product behavior.

### D. Product events only when needed

Do not implement the full #39 typed product-event facade merely because the schema exists.

First ask whether a current decision is blocked by missing event data. If yes, evaluate the smallest safe transport/provider at that time. PostHog's free tier is one future candidate, but #39's no-ID/no-autocapture contract remains the starting point.

## Explicit things we are not doing

- moving hosting/DNS to Cloudflare;
- enabling Cloudflare proxy solely for Web Analytics Rules;
- installing Cloudflare beacon globally in `index.html`;
- enabling Cloudflare SPA tracking on secret-bearing routes;
- enabling Sentry Session Replay;
- sending raw `Error` objects/messages/breadcrumbs without a canary-approved sanitizer;
- enabling PostHog autocapture, replay, persistence, user profiles, or product analytics merely because the free tier is generous;
- enabling raw CloudFront access logs for product analytics;
- adding a first-party analytics API/database;
- adding GA4/advertising attribution;
- claiming legal compliance from vendor marketing language.

## Production readiness / legal governance

Issue #39's legal/privacy readiness gates still apply before any browser analytics or third-party error collection is enabled on the canonical site.

At minimum preserve:

- audience-treatment review appropriate to an all-ages/family site;
- vendor terms/DPA/service-provider/subprocessor review where applicable;
- privacy-policy/notice updates for actual collection;
- retention/deletion ownership;
- re-review before behavioral ads, accounts, persistent identifiers, broader SDKs, session replay, or expanded peer/social data collection.

This document is engineering/product architecture, not legal advice.

## Validation contract for follow-up implementations

Every browser provider implementation must include a real outbound-network canary. Unit tests that assert a sanitizer function is correct are necessary but not sufficient.

Synthetic markers should cover at least:

```text
URL fragment capability: FRAGMENT_CANARY
query value: QUERY_CANARY
Chat text: CHAT_CANARY
error message: ERROR_CANARY
storage value: STORAGE_CANARY
diagnostic value: DIAGNOSTIC_CANARY
```

The PR must show that none of those values reach the provider except where the implementation contract explicitly permits a controlled error **code** that is not derived from the raw canary.

Do not put a real invite/capability in committed test evidence.

## Final recommendation

For launch, optimize for **low operational burden and safe absence of data** rather than dashboard completeness.

1. **Search Console + CloudFront/CloudWatch:** ship as the baseline.
2. **Cloudflare Web Analytics:** preferred free aggregate web/RUM layer, but only after a beacon/network canary and route boundary prove private Chat fragments cannot leak.
3. **Sentry Developer:** preferred free browser-error layer, but only after an independently reviewed sanitization/canary implementation with Replay absent.
4. **PostHog:** keep deferred until a concrete product decision needs curated event analytics.
5. **Simple Analytics/Plausible/GA4:** do not add at launch.

If Cloudflare or Sentry cannot satisfy the secret/data-minimization contract, **the correct launch state is to omit them**, not to weaken #39.

That preserves the intended cost posture—approximately **$0/month analytics/observability SaaS cost**—while keeping the architecture reversible as real traffic and revenue create better evidence.
