# Analytics Vendor Evaluation Appendix

Date: 2026-09-14  
Companion to: [`2026-09-14-privacy-minimized-analytics-design.md`](./2026-09-14-privacy-minimized-analytics-design.md)  
Owning issue: #39

This appendix records the September 2026 vendor/architecture comparison behind the Issue #39 recommendation. Vendor facts, pricing, defaults, terms, and product features can change; re-check them immediately before implementation.

Vendor compliance statements below are **vendor claims**, not C00lG@mes+ legal conclusions. No reviewed vendor should be described as making C00lG@mes+ “COPPA compliant” or “CCPA compliant.” Product applicability, contract classification, and audience treatment remain counsel questions.

## Decision

| Option | Decision | Primary reason |
| --- | --- | --- |
| Simple Analytics | **ADOPT WITH CONSTRAINTS** | Best current fit for no-client-ID aggregate measurement, provided explicit browser event transport, retention, terms, and child/privacy review pass |
| Plausible | **DEFER** | Privacy-oriented, but intentionally generates a day-scoped visitor identifier from IP + User-Agent when measuring uniques; we do not currently need that |
| PostHog | **DEFER** | Powerful but identity/autocapture/replay/error/warehouse surface is materially broader than the approved v1 questions |
| Google Analytics 4 | **DEFER** | Normal web model is user/session-oriented and `_ga`-identified with broader Google measurement/Ads integration surface than needed |
| Small first-party collector | **DEFER** | Maximum control but adds an owned Internet-facing data service, logging, abuse, security, retention, and operational burden |
| Search Console + CloudFront/CloudWatch only | **ACCEPT AS TEMPORARY FALLBACK** | Safest while product-analytics gates are unresolved, but cannot answer game-start/replay/runtime-quality questions |

## Comparison matrix

| Dimension | Simple Analytics | Plausible | PostHog | Google Analytics 4 |
| --- | --- | --- | --- | --- |
| Browser cookies/storage for visitor analytics | Vendor says none | Vendor says none | Normal JS product supports persistent anonymous/distinct identity and configurable persistence | Normal web implementation uses first-party `_ga` client identifier |
| Visitor identifier | Vendor says no visitor/device identifier; its unique-visit method can use referrer context rather than a browser ID | Generates a daily identifier from `daily_salt + domain + IP + User-Agent`; salt deleted every 24h | Anonymous/distinct ID is central to product analytics; identity behavior is configurable but richer than needed | Client ID/user/session measurement is central to normal GA4 web reporting |
| IP handling | Vendor says IP is immediately dropped/not stored/hashed; infrastructure still necessarily receives the network request | IP is used transiently with UA to derive daily identifier; raw IP/UA not stored | IP capture/use is configurable; requires explicit hardening/review | Google says GA IP is not logged/stored, but current Google measurement/Ads controls still process request IP in documented ways |
| Cross-site tracking/profile orientation | Vendor says no cross-site tracking/profile building | Vendor says no cross-site tracking and data isolated to a day/site/device | Designed for product/user analytics, cohorts, CDP/warehouse and cross-event identity | Designed for user/session/customer-journey measurement and integrates deeply with Google advertising products |
| Automatic page/referrer/campaign collection | Standard script can collect URL/referrer/UTM/device/browser metrics; options exist to reduce this | Standard model collects pathname, referrer, campaign parameters, browser/OS/device/location aggregates | Autocapture/pageview/pageleave and rich SDK context are available/default-sensitive | Automatically collected events/enhanced measurement and page/location/referrer dimensions are core product features |
| Session replay / DOM / heatmaps | Not a core feature of the reviewed web analytics product | Not a core feature of the reviewed web analytics product | First-class product capabilities; must be disabled/kept absent | Not GA4's primary feature, but broader Google tag/measurement surface remains |
| Explicit custom events | Yes | Yes | Yes | Yes |
| Property allow-list safety | Good if C00lG@mes+ bypasses automatic browser capture and sends only explicit typed payloads | Custom properties supported, but standard visitor/day calculation remains | Possible, but SDK surface can still collect broader context unless carefully constrained | Possible, but normal measurement model remains broader |
| Retention relevant to our target | Public materials say data is retained while account is active according to plan; free hobby tier shows one month history. Desired <=90-day event-level retention is **not established** for the intended paid use | Current self-serve plans advertise 3 years (Starter/Growth) or 5 years (Business) of data retention; much longer than our initial target | Product/plan/configuration-dependent; must be reviewed if ever reconsidered | Standard GA4 supports 2 or 14 months for user/event-level retention; 360 offers longer options |
| Data residency | Vendor says analytics data processed/hosted in EU/Netherlands with European providers | Visitor/site data processed and stored in EU on European infrastructure | Cloud offers US/EU regions; exact project choice and subprocessors require review | Global Google infrastructure/contractual model |
| DPA / processor materials | Vendor says DPA generally unnecessary because it asserts no personal-data processing, but will review/sign customer DPAs that fit its architecture | DPA applies to customers; public compliance/security/subprocessor materials | Public Trust Center includes DPA, subprocessors, SOC 2, GDPR, CCPA | Google provides Data Processing Terms and US state privacy/service-provider addenda subject to configuration/terms |
| Sale/share/advertising use | Vendor says it does not sell/share/repurpose analytics data | Vendor says no sale and no advertising/profiling use | Customer controls configuration; broad product includes destinations/CDP/other integrations, so governance matters | Customer can configure data sharing/Ads links/personalization; Google provides controls, but Ads integration is a first-class adjacent capability |
| CCPA/GPC posture in public materials | Vendor claims CCPA compliance based on its assertion it collects no CCPA personal information; no C00lG-specific conclusion | Vendor claims CCPA compliance/no personal-data tracking; no C00lG-specific conclusion | Trust materials list CCPA; final service-provider/processor/configuration status must be reviewed | Google documents US state privacy terms/service-provider modes and consent/privacy controls; customer remains responsible for configuration/compliance |
| COPPA/children-specific public fit | No COPPA-specific contractual safe harbor found in the public materials reviewed; counsel/vendor confirmation required | No COPPA-specific contractual safe harbor found in the public materials reviewed; counsel/vendor confirmation required | No COPPA-specific authorization suitable for this project was established from public materials reviewed; counsel/vendor confirmation required | Google publishes child-directed/COPPA controls for some Google services and places responsibility on developers/publishers; do not assume normal GA4 is automatically appropriate for a child-directed site |
| Current browser/runtime overhead | Official Simple Analytics docs list roughly 1.9 kB gzip for light script and roughly 3.7 kB gzip for fuller script; preferred design uses **0 vendor JS** if explicit event API works | Current public materials describe approximately 2.5 kB script | Richer SDK/product surface; exact configured bundle must be measured if reconsidered | Broader tag/runtime than privacy-light candidates; exact production tag cost must be measured rather than relying on competitor comparisons |
| Low-volume public pricing reviewed | Free hobby tier: 1 user, 5 sites, 1 month history, badge required; paid self-serve page displayed about **£20/month at 100k monthly pageviews** when reviewed | At 10k monthly pageviews: **Starter $9/mo, Growth $14/mo, Business $19/mo**; 30-day trial | Product Analytics: **1 million events/month free**, then public example **$0.00005/event** with decreasing volume pricing | Standard GA4 is offered without charge; 360 is enterprise/contract pricing rather than a simple public self-serve price |
| Growth pricing/shape | Pageview-based paid tiers scale with traffic; exact estimator should be re-run at expected launch volume | Pageview/custom-event tiers scale upward; enterprise offers custom limits | Usage-based per event, with generous free tier and lower unit pricing at volume | Standard free subject to product limits; 360 has base + event-volume contractual pricing |
| Export/portability | Raw export plus Stats/API capabilities; customer owns analytics data per vendor materials | CSV/Stats API; Enterprise scheduled raw event export; open-source Community Edition exists | Strong APIs/warehouse/export ecosystem | Reporting APIs and BigQuery export; standard vs 360 limits differ |
| Operational burden | Low if hosted and explicit-event transport works | Low hosted; self-hosting available but unnecessary for v1 | Low infrastructure burden but higher governance/configuration burden | Low infrastructure burden but higher privacy/marketing-governance surface |
| Overall current fit | **Best candidate** | **Good privacy product, but unnecessary day-level identity** | **Overpowered for current questions** | **Structurally broader than current need** |

## Candidate notes

### Simple Analytics

Current public documentation is unusually aligned with the desired outcome: no cookies/local storage/fingerprinting, no persistent visitor identifier, immediate IP discard, EU hosting, explicit events, and strong export ownership.

However, its **standard browser script still collects more dimensions than this design permits by default**, including page/referrer/campaign/device/browser data. Vendor-side stripping of query/fragment information is helpful defense in depth, but C00lG@mes+ must prevent sensitive URL/referrer material from being sent in the first place.

Therefore the recommendation is not “paste the Simple Analytics script into `index.html`.” It is:

1. prove that the documented explicit event-ingestion endpoint is safely callable from the static browser application;
2. send only our closed event JSON;
3. use `referrerPolicy: 'no-referrer'`;
4. send no cookies/client ID/UA/referrer/full URL from application code;
5. verify actual raw export/network traffic with synthetic secret canaries;
6. resolve the current retention mismatch before production;
7. complete vendor/contract/counsel review for the site's audience treatment.

If any of those fail, **do not downgrade the privacy boundary just to keep the vendor**.

### Plausible

Plausible is a strong privacy-oriented alternative and its public documentation is transparent about the tradeoff it makes to estimate daily unique visitors: each request's IP and User-Agent are transient inputs to a daily salted hash. Raw IP/UA are not stored and the salt is rotated/deleted every 24 hours.

That may be entirely reasonable for many sites, but it answers a question C00lG@mes+ does not currently need. Under Issue #39's “least persistent model that answers the approved questions” test, the day-scoped visitor identifier is unnecessary.

Its default retention is also materially longer than our proposed <=90-day event-level target: current plans advertise 3 years at Starter/Growth and 5 years at Business.

### PostHog

PostHog is not rejected as a product. It is deferred because its strengths are exactly the capabilities C00lG@mes+ is intentionally not buying yet: long-lived product identity, funnels/cohorts, session replay, error context, experiments, feature flags, CDP/warehouse integrations, and a broad capture surface.

The public Trust Center materially improves enterprise/vendor review, and its current product-analytics pricing is attractive. But a powerful platform with many individually configurable capture features creates a larger regression/misconfiguration surface than a minimal event counter for a family-oriented arcade with secret-bearing URL fragments.

If future product decisions genuinely require cohorts, experiments, or richer user-level analytics, re-evaluate PostHog through a new privacy architecture Issue rather than silently enabling those features under the v1 contract.

### Google Analytics 4

GA4 remains highly capable and inexpensive at the standard tier. The reason to defer is architectural fit, not price.

Google's own current materials describe Analytics as visitor/app behavior measurement, normal cookie/app-instance identifiers, privacy/consent controls, Ads linking, data-sharing settings, and user-level/event-level retention. Current Google documentation also continues to evolve Ads/Consent Mode/IP controls; for example, Google documented 2026 transitions around Google Signals, Ads consent settings, and encrypted IP flow to linked Ads accounts.

That is substantially more governance surface than necessary for the initial C00lG@mes+ questions. The all-ages product should not adopt the broader Google measurement/advertising ecosystem simply because standard GA4 has no license fee.

## First-party collector comparison

A first-party API is not automatically the “privacy” winner.

With an owned collector, C00lG@mes+ would become directly responsible for receiving Internet source IPs, validating/limiting hostile traffic, managing logs, maintaining retention/deletion, operating storage, securing credentials/admin access, and handling availability/incidents. Those are real privacy/security obligations even with a tiny schema.

That burden may eventually be worthwhile if:

- no hosted provider can meet the explicit data contract;
- event volume/pricing makes ownership materially better;
- first-party data becomes a strategic asset with repeated consumers;
- a production backend is already justified for independent product reasons.

None of those conditions is established today.

## GPC/CCPA/vendor interpretation

GPC is legally relevant to covered sale/sharing opt-outs; it is not a generic “disable every form of analytics” protocol.

C00lG@mes+' intended architecture contains no sale or cross-context behavioral advertising. Before enablement, counsel still needs to confirm whether the final vendor relationship/process qualifies as a service-provider/contractor/internal-operations arrangement under applicable California law and what, if anything, GPC must do to this minimal analytics stream.

The implementation should centralize privacy-signal policy so a future advertising/identity feature cannot bypass it. If the company voluntarily chooses to disable even minimal product analytics for GPC/DNT signals, that should be a deliberate product policy in the first-party facade rather than an accidental vendor-specific behavior.

## Children/COPPA/vendor interpretation

None of the vendor marketing claims in this appendix substitutes for the FTC analysis.

COPPA's persistent-identifier rules are about the operator's/service provider's real collection/use, not the label “privacy friendly.” The no-client-ID architecture reduces risk because C00lG@mes+ does not intentionally create an analytics identifier, but counsel should still review:

- site audience treatment;
- transient/provider IP handling;
- any provider-generated page/load IDs or unique-visit logic;
- whether the vendor acts solely on behalf of C00lG@mes+ for permitted internal operations;
- the required online privacy notice;
- retention/deletion and third-party disclosure terms.

This is why Simple Analytics remains **ADOPT WITH CONSTRAINTS**, not an unconditional legal approval.

## Primary vendor sources reviewed

### Simple Analytics

- [Pricing](https://www.simpleanalytics.com/pricing)
- [Data collection](https://www.simpleanalytics.com/data-collection)
- [Privacy](https://docs.simpleanalytics.com/privacy)
- [Compliance](https://docs.simpleanalytics.com/compliance)
- [Compliance FAQ](https://docs.simpleanalytics.com/compliance-faq)
- [Data Processing Agreement](https://www.simpleanalytics.com/data-processing-agreement)
- [Security](https://www.simpleanalytics.com/security)
- [Export](https://docs.simpleanalytics.com/export-data)

### Plausible

- [Data policy](https://plausible.io/data-policy)
- [Security/compliance overview](https://plausible.io/docs/compliance)
- [Security](https://plausible.io/security)
- [Privacy policy](https://plausible.io/privacy)
- [Subscription plans](https://plausible.io/docs/subscription-plans)
- [Public pricing](https://plausible.io/)
- [Custom-property PII rules](https://plausible.io/docs/custom-props/introduction)

### PostHog

- [Product and public pricing](https://posthog.com/)
- [JavaScript configuration](https://posthog.com/docs/libraries/js/config)
- [Trust Center](https://trust.posthog.com/)

### Google Analytics

- [Google Analytics product](https://marketingplatform.google.com/about/analytics/)
- [Google Analytics Terms](https://marketingplatform.google.com/about/analytics/terms/us/)
- [Safeguarding your data / US state privacy service-provider terms](https://support.google.com/analytics/answer/6004245)
- [Privacy controls](https://support.google.com/analytics/answer/9019185)
- [GA4 standard versus 360 limits/retention](https://support.google.com/analytics/answer/11202874)
- [2026 Analytics data-control updates](https://support.google.com/analytics/answer/17016975)
- [Privacy disclosures policy](https://support.google.com/analytics/answer/7318509)
- [Child-directed Google-service guidance](https://support.google.com/policies/answer/9664901)
