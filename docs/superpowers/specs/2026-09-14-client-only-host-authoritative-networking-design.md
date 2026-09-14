# Client-Only Host-Authoritative Networking Design

Date: 2026-09-14  
Status: Approved target architecture; **not yet the production implementation**  
Owning issue: #20  
Evidence gates: #18 / PR #24 and #19 / PR #35

## Decision

C00lG@mes+ will move production Chat/private-party networking to a **browser-hosted authoritative listen-server architecture with no C00lG@mes+-owned dynamic application backend**.

For the approved v1 target:

- one browser is the authoritative active host/listen server;
- guests are untrusted passive clients;
- application traffic is direct WebRTC in a host-star topology;
- public Trystero/Nostr infrastructure provides decentralized rendezvous/signaling;
- host-authoritative durable party/application state is stored locally in the host browser;
- guest credentials, cursors, host trust material, and an optional cached replica are stored locally in each guest browser;
- C00lG@mes+ owns no dynamic signaling, room-state, Chat-history, or game-state backend for this architecture;
- permanent loss of the host/browser-local authority ends the party in v1.

The feasibility decisions are explicit:

- **Issue #18: PROCEED WITH CONSTRAINTS.** Trystero/Nostr can discover an active host and passive guest and establish direct WebRTC without a C00lG@mes+-owned signaling backend. Application identity/admission can remain independent of transient Trystero peer IDs. Reload/reconnect works on tested paths, but public-rendezvous latency, browser/network coverage, and restrictive-network connectivity remain production constraints.
- **Issue #19: PROCEED WITH CONSTRAINTS.** A browser host can own canonical member identity, sequencing, validation, persistence, delta/snapshot recovery, lock/removal state, and fail-closed restoration without remote application-state infrastructure. Browser-profile storage is the durability boundary and production must add single-writer protection.

This is best understood as a conventional **listen-server/client-server game model running inside the host browser**, not symmetric peer authority. One participant is the server/authority during the session; every remote browser is a client.

## Scope of this decision

This architecture is approved for:

- production Chat;
- private invite-based parties;
- near-term small casual/cooperative multiplayer;
- small casual competitive games where trusting the player host as match authority is an acceptable product tradeoff.

It is **not** a permanent mandate that every future multiplayer game must remain browser-hosted.

A future game should reopen the dedicated-server decision if product requirements materially include any of the following:

- platform-trusted scores or outcomes that must remain trustworthy even when the host modifies its client;
- ranked/high-stakes competitive play;
- valuable persistent progression or inventory;
- public matchmaking or persistent public rooms;
- session availability that must survive permanent host departure;
- player counts or simulation cost that exceed the supported host-device envelope;
- connectivity requirements that the direct-WebRTC/TURN-free envelope cannot meet;
- mobile-host lifecycle behavior that causes unacceptable player-session loss;
- persistent cross-session/world state requiring a trusted service.

If that boundary is crossed, prefer a focused **dedicated authoritative server** architecture review rather than layering distributed host election, CRDTs, cloud replicas, or increasingly complex peer workarounds onto this design. For the current TypeScript/browser stack, **Colyseus is the first dedicated-game-server framework to evaluate** at that future evidence gate; this design does not install or depend on it now.

## Conventional baseline and deliberate deviation

The lower-risk general-purpose browser multiplayer baseline is conventionally:

```text
browser clients -> WebSocket/WebTransport-like connection -> dedicated authoritative game server
```

A framework such as Colyseus can provide server-hosted rooms, matchmaking, reconnection, state synchronization, and scaling. That architecture has stronger host-independent availability, simpler NAT traversal, and a natural trust boundary for rankings/persistent state.

C00lG@mes+ deliberately chooses a browser listen server **for now** because the current product values are different:

- small private friend/family parties;
- no accounts or public matchmaking requirement;
- casual/co-op emphasis rather than high-stakes ranked play;
- static-site deployment compatibility;
- minimal owned infrastructure and operational burden;
- minimal first-party persistent data;
- scaling session authority primarily onto the participating devices.

This is a product-specific tradeoff, not a claim that browser-hosted WebRTC is universally superior to dedicated servers.

## Current implementation versus approved target

Until #21 lands, production `/chat` still uses the existing Vercel Functions + Upstash Redis coordinator under `api/chat/`, `server/chat/`, and `src/networking/room/`. That coordinator remains current runtime code and must not be deleted or described as already retired by this design PR.

This document is the approved target architecture for #21 and applicable near-term multiplayer work. It supersedes `2026-09-08-webrtc-chat-networking-design.md` as the **future architecture decision**, while the September 8 document remains useful historical/current-implementation context until #21 replaces the coordinator.

Hosting follows the same staged distinction:

1. current production hosting remains Vercel;
2. #21 removes production Chat's dynamic C00lG@mes+ backend dependency;
3. #22 provisions/validates the planned static AWS foundation;
4. #23 cuts `coolgamesplus.com` over and retires obsolete hosting/runtime infrastructure.

## Evidence classification

### Measured repository evidence

#18 / PR #24 established on tested paths:

- active host + passive guest public-Nostr discovery;
- direct WebRTC with TURN disabled;
- one-link joining with no manual SDP exchange;
- durable application identity separate from transient Trystero identity;
- guest reload reconnect;
- host reload reconnect without a server-side room record;
- host/guest one-peer observations consistent with the intended two-party star;
- transient SDP/ICE failure followed by recovery;
- material late-join/discovery latency;
- third-party relay/STUN dependence.

#19 / PR #35 established:

- guest messages are untrusted intents, not canonical state;
- host-owned canonical sender/member identity and sequence allocation;
- duplicate/replay and request-gap rejection;
- serialized host mutations;
- host persistence before canonical broadcast;
- IndexedDB host restore;
- durable guest credential/cursor state separate from transport identity;
- delta recovery and snapshot fallback;
- stale/corrupt guest replicas cannot overwrite host authority;
- host + guest simultaneous reload recovery;
- durable lock/removal semantics;
- missing/corrupt/unavailable host storage fails closed;
- one-current-transport-per-member binding can be enforced in host memory.

These POCs prove feasibility on tested paths. They do **not** prove universal production connectivity, all-browser lifecycle behavior, 8-member resource behavior, or TURN-free success on every network.

### Current external facts checked for this design

As of 2026-09-14:

- Trystero `0.25.4` is the design-time stable baseline proven by #18/#19. It supports Nostr rendezvous, `passive` peers, application admission handshakes, trickle ICE, relay reconnection, relay diagnostics, and optional TURN configuration.
- Trystero's Nostr topic strategy uses a fast startup announcement burst followed by a materially slower steady announcement cadence. Passive late joiners can therefore wait for a later host announcement.
- passive peers listen without announcing while dormant and do not establish passive-to-passive topology through normal discovery; one active host plus passive guests therefore matches the intended star direction.
- an upstream Trystero `0.25.4` lifecycle defect has been reported where `room.leave()` may reject after the underlying data channel is already closed, including a mobile sleep/rejoin scenario; #21 must verify the selected production Trystero version/lifecycle path rather than assuming the POC teardown code is production-safe.
- Web Locks provide same-origin exclusive coordination across browser contexts and are suitable for the browser-local single-writer boundary.
- IndexedDB is asynchronous same-origin structured storage; browser storage remains a durability boundary rather than a service-level guarantee.
- browser storage may be cleared/evicted and private-browsing storage is not durable; requesting persistent storage can reduce eviction risk but cannot make browser-local state equivalent to cloud persistence.
- mobile browsers can suspend/freeze/terminate background tabs; a browser host cannot promise continuous server availability while backgrounded/asleep.
- WebRTC data channels support reliable ordered delivery as well as unordered/partially reliable modes; real-time game replication does not need to inherit Chat/control-plane semantics.

### Architectural assumptions

- v1 parties remain small: maximum 8 total members, one host + at most 7 guests;
- Chat is the first production consumer and is primarily a reliable control/data workload rather than latency-critical high-frequency simulation;
- family/casual/co-op/small-party experiences are the near-term multiplayer target;
- host availability being party availability is acceptable for v1 if the UX states it honestly;
- public relay/STUN operators provide no C00lG@mes+ service-level guarantee;
- the product accepts that the player host can modify its own client and therefore cannot be treated as an independent trusted authority for global rankings or valuable persistent outcomes.

## Architecture overview

```text
                    public Nostr relays
                  (rendezvous/signaling only)
                          /   |   \
                         /    |    \
                        /     |     \
                   Host browser (active)
                  authoritative listen server
                    /        |        \
                   /         |         \
            WebRTC           WebRTC          WebRTC
              /                |               \
       Guest A            Guest B           Guest C
       passive            passive           passive

Host IndexedDB: canonical party/application authority
Guest IndexedDB: credential + host pin + cursors + optional cache
Application Chat/game traffic: direct host <-> guest WebRTC
```

There is no guest-to-guest application topology. Guests never merge state into the host. Trystero/public rendezvous is third-party infrastructure, not application authority.

## 1. Transport and rendezvous

### Production library and strategy

Adopt Trystero with its **explicit Nostr strategy/package** rather than relying implicitly on whatever strategy a future root package selects.

The design-time baseline is `0.25.4`, because that is the release proven by #18/#19. #21 must re-check the then-current stable release before installing. A later patch/minor release may replace `0.25.4` after reviewing transport/lifecycle changes and rerunning focused tests; prefer a verified fix for known teardown/rejoin defects if one exists.

Do not load the production dependency from a CDN. #21 should pin the reviewed package in the build dependency graph and lazy-load the multiplayer path so unrelated arcade routes do not pay its startup cost.

### Production Nostr configuration

The intended configuration contract is conceptually:

```ts
{
  appId: 'coolgamesplus-party-v1',
  password: party.rendezvousCapability,
  passive: role === 'guest',
  trickleIce: true,
  relayConfig: {
    redundancy: 5,
    manualReconnection: false,
  },
  // no TURN in v1
}
```

#21 must verify exact option names/defaults against the selected Trystero release rather than copying POC/library-version internals blindly.

C00lG@mes+ does not hard-code a custom public Nostr relay list initially. Use the reviewed Trystero-maintained default pool/redundancy behavior so C00lG@mes+ does not silently become the curator/operator of a public relay fleet.

### Fallback strategy

No MQTT, Torrent, Firebase, Supabase, owned WebSocket relay, or multi-strategy fallback is configured in v1.

Fallback complexity is deferred. Create a focused rendezvous follow-up only if #21 production validation demonstrates that Nostr availability/join latency fails the player-experience gate.

### Late-join/retry UX

Passive guests may miss the active host's startup announcement burst and wait for a later steady announcement. #18 observed material discovery latency; the product must expose discovery as normal recoverable state rather than an instant guarantee.

Target UX:

- initial: `Finding host…`;
- after roughly 10 seconds: explain that discovery is still in progress and can take longer;
- after a bounded long-wait window (approximately 75 seconds in the design baseline): show `Taking longer than expected` with Retry and host-open/network guidance;
- Retry starts a fresh transport attempt while preserving durable application identity/credentials.

Do not convert slow discovery into a new member identity or new party incarnation.

### Relay outage behavior

- partial relay failure: use surviving relays/library retry behavior;
- total rendezvous unavailability: new joins/reconnects cannot discover one another; surface a degraded reconnect state without breaking the rest of the site;
- already established direct WebRTC traffic should continue while the peer path remains healthy;
- relay socket state is diagnostics/UX information only, never authentication or canonical state.

## 2. Production topology

The production topology is one authoritative active host and at most seven passive guests.

### Transport-enforced direction

- host configures as active;
- guests configure as passive;
- normal passive discovery prevents passive guest peers from forming the intended guest-to-guest topology.

### Application-enforced boundary

Transport configuration is not a security boundary. The application handshake also enforces:

- host accepts only guest application roles;
- guest accepts only a cryptographically proven host;
- guest rejects guest-shaped peers even if a modified client bypasses passive mode;
- host rejects new admissions above seven active/non-removed guests;
- every guest application message is associated with the authenticated member bound to that transport rather than a claimed sender field.

The host has one intended WebRTC peer relationship per connected guest. A guest has exactly one intended application peer: the host.

## 3. Identity model

The following identities/capabilities are deliberately distinct.

### Party ID

A cryptographically random identifier naming one party. It is not authorization.

### Party incarnation ID

A random identifier persisted in canonical host state when the party is created. Host reload retains the same incarnation. Missing/corrupt authority is never silently replaced under the same live party route.

### Durable host application identity

Each party receives a **per-party ECDSA P-256 signing key pair** generated through Web Crypto.

- private key: non-extractable `CryptoKey`, host IndexedDB only;
- public key: exportable for guest verification;
- host identity: SHA-256 fingerprint of a canonical exported public key representation.

The per-party key avoids creating an unnecessary global cross-party identifier. A browser without that key is not the host merely because it has a copied URL/rendezvous secret.

### Durable guest/member credential

A new guest creates:

- random `credentialId`;
- random 256-bit `credentialSecret`.

The host allocates canonical `memberId` and party-local label. The host stores the credential ID plus a verifier/hash, not the raw guest secret. The guest stores its raw credential locally.

### Rendezvous capability

A separate random 256-bit party secret used to enter the private Trystero rendezvous/signaling namespace. It is neither host authority nor canonical membership authorization.

### Admission capability

A separate random 256-bit bearer capability authorizing **new member creation** while admission is open. Existing members do not need it for reconnect.

### Transport attempt ID

A fresh random value per connection/reconnection attempt. It is ephemeral and helps bind one authenticated member to one current attempt. It is never durable identity.

### Trystero/WebRTC peer ID

Transient transport identity supplied by Trystero. It may change after reload/reconnect and never becomes canonical C00lG@mes+ identity.

## 4. Invite and authentication model

### Host durable URL

The durable host route contains location/party identity, not a shareable host secret:

```text
/chat#v=2&party=<partyId>&role=host
```

Host authority comes from browser-local IndexedDB, the per-party signing key, and the exclusive host-writer lock. Opening the host route in a different browser/profile without that authority record fails closed.

### Guest invite URL

The shareable guest invite is conceptually:

```text
/chat#v=2&party=<partyId>&r=<rendezvousCapability>&a=<admissionCapability>&host=<hostKeyFingerprint>
```

Capabilities live in the fragment so the normal initial static HTTP request does not send them to the hosting origin. Fragments remain bearer material that can leak through clipboard history, screenshots, browser extensions, or client-side logging. Never log them or include them in diagnostics.

### First admission handshake

The order is security-significant:

1. guest enters rendezvous using party ID + rendezvous capability;
2. guest sends a fresh nonce, protocol version, party ID, guest role, and transport-attempt context but **does not reveal admission/member secrets yet**;
3. host returns its public signing key, a fresh host nonce, and an ECDSA signature over a canonical challenge binding protocol version, party ID, both nonces, and enough current transport context to prevent replay across attempts;
4. guest fingerprints the returned key, verifies it matches the invite/local host pin, and verifies the signature;
5. only after host proof does the guest send either:
   - **resume:** credential ID + credential secret; or
   - **new admission:** admission capability + credential ID + credential secret;
6. host validates credential/admission state, lock/removal/member-limit rules, protocol bounds, and current transport attempt;
7. host returns canonical member/incarnation/sync metadata and the peer becomes an accepted application member.

This prevents another holder of a leaked rendezvous capability from impersonating the original host and harvesting member credentials.

### Returning guest

After first admission, the guest stores rendezvous capability, host pin, member credential, and cursors in IndexedDB. Scrub the sensitive invite from the address bar with `history.replaceState()` so the durable local route can be non-secret:

```text
/chat#v=2&party=<partyId>&role=guest
```

A fresh browser opening that sanitized route without local credentials cannot join; it needs a valid current invite.

### Lock/unlock

Locking admission:

- persists `locked: true` before UI/broadcast acknowledgment;
- prevents new member creation;
- allows existing non-removed members to resume;
- invalidates the current admission capability so an old copied invite cannot later create a new member.

Unlocking:

- generates/persists a new admission capability;
- produces a new share invite;
- does not rotate the rendezvous capability in v1 because existing members need it to rediscover the party.

### Removal

Removal is durable before transport closure. A removed member remains denied after reload/reconnect. Removal does not rotate rendezvous capability.

A leaked rendezvous capability may still let its holder reach the rendezvous/application-handshake boundary. It cannot prove host authority or become a member without valid authorization. If a rendezvous capability is actively abused, v1 ends/recreates the party; live rendezvous rekeying is deferred.

## 5. Host-local authority and persistence

### Durability boundary

Host IndexedDB is the only durable canonical application-state authority.

The host party record includes, at minimum:

- storage schema version;
- wire/protocol generation;
- party ID;
- incarnation ID;
- host public identity/signing-key material needed for restore;
- rendezvous capability;
- current admission verifier/state;
- lock state;
- canonical member records;
- removed-member tombstones;
- member credential verifiers;
- per-member last accepted request sequence;
- monotonically increasing canonical sequence;
- bounded canonical Chat/control history.

### Chat retention

Production Chat keeps the current product bounds unless #21 has a focused reason to change them:

- maximum Chat text: 1,000 characters;
- maximum serialized Chat message: 8 KiB pre-parse bound;
- bounded visible/recovery Chat history: 200 messages/events where applicable.

The POC's 24-event history was a test bound, not a production retention choice.

### Commit rule

For durable party/Chat/control mutations:

```text
intent -> authenticate -> validate -> canonicalize -> allocate sequence -> persist -> publish/broadcast
```

Host mutations are serialized. Persistence completes **before** the in-memory canonical authority advances and before the canonical event is broadcast.

If the durable write fails, that mutation is not canonical and must not be broadcast. If durable authority becomes unavailable/corrupt, host authority fails closed rather than continuing with an unverifiable in-memory fork.

### Storage durability

Request persistent storage where supported as a best-effort durability improvement. Do not treat that request as a guarantee.

User clearing, browser/profile loss, private browsing, storage pressure/eviction, or unrecoverable corruption can lose the party. Guests cannot restore host authority.

### Intentionally not durable

Do not persist as canonical authority:

- Trystero/WebRTC peer IDs;
- WebRTC peer/data-channel objects;
- relay sockets/presence;
- current transport bindings;
- pending/uncommitted guest intents;
- retry timers/backoff state;
- high-frequency game simulation frames.

Future games may persist deliberate checkpoints only when the game has a specific product requirement.

## 6. Guest replica model

Guest durable state lives in IndexedDB and contains at minimum:

- schema/protocol version;
- party ID/incarnation;
- rendezvous capability;
- pinned host public identity/fingerprint;
- credential ID/secret;
- canonical member ID once admitted;
- last canonical sequence received;
- next/last request sequence as required;
- optional bounded cached replica.

The guest replica is never authority.

Reconnect flow:

```text
restore local credential/pin -> rendezvous -> prove host -> authenticate member -> compare cursor -> delta or snapshot -> converge
```

A malformed, corrupt, wrong-host, wrong-incarnation, or sequence-gapped cached replica is discarded. The guest requests/replaces state from the host; it never merges its cache back into the host.

### Delta replay

If the guest's canonical cursor is within retained history, host sends ordered missing canonical events.

### Snapshot fallback

If the guest is too stale, has an impossible/gapped cursor, or cannot safely apply retained history, host sends a bounded full current snapshot. The guest replaces its cached replica from that snapshot.

## 7. Canonical party/control protocol

The shared party/control plane owns reliable authority semantics:

```text
guest request/intent
  -> authenticated current member transport
  -> version/shape/size/rate validation
  -> member request-sequence validation
  -> domain validation/canonical sender assignment
  -> host canonical sequence allocation
  -> durable commit when applicable
  -> canonical response/event broadcast
```

### Required validation

Every remote payload is untrusted. Validate before acting on it:

- serialized byte/character bound before parse;
- protocol generation/version;
- message type;
- schema/field bounds;
- authenticated member/role;
- current transport binding/attempt;
- per-member request sequence;
- domain-specific constraints;
- reasonable rate.

Unknown protocol generations/types fail closed rather than being guessed or silently downgraded.

### Duplicate/replay/gap semantics

For a per-member monotonically increasing request sequence:

- `requestSequence <= lastAccepted`: duplicate/replay; no mutation;
- `requestSequence === lastAccepted + 1`: eligible for normal validation;
- `requestSequence > lastAccepted + 1`: gap; reject/request synchronization rather than applying out of order.

The host alone allocates canonical event sequence numbers.

### One current transport per member

A successful new authenticated transport for an existing member supersedes the prior binding. Close/ignore the previous transport. The binding map is ephemeral host-memory state; durable identity remains the member credential/record.

### Chat rate boundary

#21 should use a small explicit per-member Chat submission limiter rather than allowing unbounded guest spam. A reasonable design starting point is a token bucket with capacity 5 and refill of 1 accepted submission/second; implementation may tune this during #21 validation without changing the architecture.

Do not apply a Chat rate limit to future high-frequency game input. Games own their real-time rate/tick contracts.

## 8. Party/control plane versus real-time game plane

This separation is a required architecture boundary.

### Shared party/control plane

Use reliable/ordered authority semantics for:

- host/member authentication;
- admission, lock/unlock, removal;
- party membership/control events;
- Chat;
- canonical durable events;
- match/session lifecycle commands where appropriate;
- recovery cursors, delta replay, snapshots;
- durable checkpoint metadata when a real game explicitly needs it.

The party/control plane may sequence, persist, replay, and snapshot its bounded canonical state.

### Game-owned real-time plane

Future games own their simulation/netcode. A game may use, where actually required:

- fixed simulation ticks;
- input/tick sequence numbers;
- unordered/partially reliable WebRTC data channels;
- input redundancy;
- host snapshots;
- interpolation/extrapolation;
- client-side prediction;
- host/server reconciliation;
- lag compensation appropriate to that game's mechanics.

These are **not** built by #20 or speculatively generalized in #21.

The invariants shared with Chat are only the ones that are genuinely reusable:

- party/member identity;
- authenticated host-star transport;
- guests are untrusted;
- host owns canonical simulation/outcomes within the session;
- reconnect/snapshot foundations where the game benefits from them.

Never persist every simulation frame merely because local IndexedDB exists.

## 9. Single-host-writer safety

#19 proved authority under a single-host-writer assumption. Production resolves same-origin split brain with a scoped **Web Lock**.

Before restoring/mutating host authority or joining rendezvous as the active host, acquire an exclusive lock conceptually named:

```text
coolgamesplus:party-host:<partyId>
```

### Behavior

- first host tab holds the lock for the authority runtime lifetime;
- second same-origin host tab fails non-destructively with `Party already active in another tab` and does not announce as authority/mutate IndexedDB;
- normal tab close/process termination releases the browser-managed lock;
- after crash/termination, a new tab can acquire the released lock and restore authority;
- if an old host context is suspended but still owns the lock, a second tab remains denied: prefer safety over two simultaneous authorities;
- do not use `steal` or design distributed host election;
- if Web Locks are unavailable on a supported host browser, host mode fails closed rather than falling back silently to a race-prone localStorage lease.

A homegrown time-based lease is not preferred because browser suspension makes lease freshness/failure detection ambiguous.

## 10. Failure and lifecycle semantics

### Guest reload

Restore local guest state -> passive rendezvous -> host proof -> resume credential -> delta/snapshot convergence. Transient peer/attempt IDs may change; canonical member identity does not.

### Host reload

Acquire exclusive writer lock -> open/validate/migrate IndexedDB -> restore exact durable authority -> only then announce as active host. Returning guests wait/reconnect and resynchronize.

### Both reload

Each side restores independently. The logical party recovers once public rendezvous rediscovers the host and guest and application authentication succeeds.

### Brief network interruption

Keep durable application identity. Treat failed/stale WebRTC as disposable transport. Reconnect with a fresh attempt; do not create a new member.

### Wi-Fi/cellular transition

Assume ICE/data-channel path may fail. Detect unusable transport and create a fresh attempt. Do not assume a previous peer ID/path remains valid.

### Background/foreground and device sleep

Do not assume continuous JS execution or transport liveness. On foreground/resume, validate current transport and rejoin/reconnect when stale/failed.

A host browser suspended/terminated by the platform makes the party temporarily/permanently unavailable until that host context returns/restores. This is a known listen-server tradeoff, not a bug solved by guest authority.

#21 must specifically regress the selected Trystero teardown/rejoin path around background/sleep because #18's library version has an upstream reported leave/rejoin edge case.

### Host tab/process termination

Committed IndexedDB authority survives if storage survives. Uncommitted memory does not. A later host tab reacquires the Web Lock and restores from the durable record.

### Public rendezvous outage

Existing direct connections may continue. New joins/reconnects cannot rediscover until relay access recovers. Other arcade routes remain unaffected.

### Host storage unavailable/corrupt/incompatible

Fail closed. Do not create a fresh authority under the existing party identity/invite and do not accept guest cache as recovery authority. Surface an explicit party-recovery failure/new-party path.

### Guest storage unavailable/corrupt

A corrupt cache may be discarded. If durable member credential is lost, the browser is no longer the same resumable member and requires a valid current admission invite (subject to lock/removal semantics).

### Permanent host disappearance

The v1 party ends. No host election/migration is performed.

## 11. TURN policy

**v1 ships without C00lG@mes+-owned/configured TURN.**

#18 established successful direct WebRTC with TURN disabled on tested paths. That does not prove direct ICE can succeed on every corporate, school, carrier, VPN, firewall, or symmetric-NAT combination.

The product therefore accepts a documented restrictive-network failure envelope for v1 while #21 gathers broader evidence.

Create a separate TURN decision only if production-oriented testing or real users show a material supported-network failure rate. That decision must evaluate:

- player connectivity benefit;
- relay bandwidth/cost;
- credential/service architecture;
- privacy implications;
- operational burden;
- whether TURN keeps the broader static/client-hosted strategy worthwhile.

Do not add TURN merely because it is common in general WebRTC deployments.

## 12. Privacy and public-rendezvous implications

Describe the architecture as:

> **No C00lG@mes+-owned dynamic application backend.**

Do **not** describe it as “zero infrastructure.”

Public Nostr relays and STUN are third-party infrastructure.

### Rendezvous infrastructure may observe

Depending on provider/protocol details, public rendezvous/STUN operators can observe metadata such as:

- source network/IP information available to their service;
- connection timing and traffic volume;
- relay/topic/event identifiers required by the rendezvous protocol;
- STUN/network-traversal metadata.

Trystero's party password protects signaling content according to the reviewed library behavior, but capability secrecy remains important.

### Rendezvous infrastructure must not receive application authority

C00lG@mes+ does not intentionally store on public relays:

- canonical member records;
- Chat history/payloads;
- game state/simulation;
- guest member secrets;
- host private signing keys;
- accounts/profiles.

Once connected, Chat/game application traffic travels directly over WebRTC host <-> guest connections.

### Peer privacy

Direct WebRTC necessarily exposes network-path information needed to establish peer connectivity between the host and each guest. Passive guests should not intentionally establish guest-to-guest application connections, limiting unnecessary peer exposure inside the party.

For a family-oriented site, privacy copy must be plain: joining a party uses third-party public rendezvous/network-traversal infrastructure and direct peer networking; C00lG@mes+ does not operate a persistent room/Chat backend under this target architecture.

## 13. Current coordinator responsibility disposition

Every coordinator responsibility has one target owner/disposition.

| Current responsibility | Future owner/disposition |
| --- | --- |
| Room/party ID creation | Browser host |
| Host authorization | Browser host key + guest host-proof verification |
| Invite authorization | Browser host; split rendezvous/admission capabilities |
| Canonical room record | Host IndexedDB |
| Member ID/label allocation | Browser host |
| Member credential verification | Browser host |
| Raw member credential | Guest browser only |
| Maximum 8-member enforcement | Browser host |
| Lock/unlock | Browser host + host IndexedDB |
| Removal/revocation | Browser host + durable tombstone/verifier state |
| Durable server `lastSeen`/presence | Deleted; live connection presence is ephemeral host state |
| Coordinator connection generation | Deleted as server state; ephemeral browser transport attempt/current binding replaces it |
| Server revision/CAS between writers | Deleted; Web Lock + serialized host mutations replace it |
| Offer/answer signaling | Trystero/public Nostr rendezvous |
| Signaling record TTL | Deleted; no C00lG@mes+ signaling database |
| Signaling polling | Deleted |
| Room-state polling | Deleted; direct canonical events/sync replace it |
| Remote room inactivity TTL | Deleted; browser-local parties persist until local deletion/loss/new-party lifecycle |
| Upstash/Redis state | Deleted by #21 after all production references are gone |
| `/api/chat/*` validation/auth | Browser party/control protocol validation; endpoints removed by #21 when unused |
| Canonical roster reads | Browser host, replicated/snapshotted to guests |
| Chat sender canonicalization | Browser host |
| Chat payload routing | Direct host-star WebRTC |
| Bounded Chat history | Host IndexedDB + guest replica/cache |
| Reconnect authority | Browser host + guest durable credentials/cursors |
| Public rendezvous retry | Trystero/public relay layer + product reconnect UX |
| TURN | Intentionally deferred evidence gate |
| Host migration/election | Intentionally deferred; permanent host loss ends v1 party |
| Matchmaking/accounts/cloud sync | Intentionally deferred |
| High-frequency multiplayer simulation | Future game-owned host runtime, not party/control persistence |

Nothing in `api/chat/` or `server/chat/` is removed by #20. #21 removes those current runtime paths only after equivalent required behavior exists in the browser target and production no longer references them.

## 14. Target implementation boundaries for #21

#20 defines behavior, not exact filenames, but #21 should preserve these conceptual boundaries rather than building one monolith.

### Shared networking/party layer

Owns:

- party route/invite parsing;
- durable host/guest identity and capability storage;
- host proof/application handshake;
- Trystero transport adapter/lifecycle;
- host-star member transport binding;
- single-host-writer guard;
- admission/lock/removal/member authorization;
- canonical party/control sequencing;
- generic bounded sync/delta/snapshot foundations that have real Chat use.

Does not own:

- Chat text semantics/moderation;
- game simulation;
- game-specific input/snapshot formats;
- generic matchmaking/accounts.

### Chat layer

Owns:

- Chat intent/message schemas;
- 1,000-character/8 KiB bounds;
- moderation;
- Chat-specific rate policy;
- visible/history semantics;
- mapping canonical party members to Chat sender presentation.

### Future game layer

Owns:

- simulation/tick loop;
- game-specific inputs/events;
- prediction/reconciliation/interpolation if required;
- game snapshots/checkpoints;
- bandwidth/rate/partial-reliability strategy.

## 15. #21 production evidence gate

#21 must not be considered complete from deterministic tests alone.

Automated coverage should include at minimum:

- invite parsing/capability separation;
- host-key fingerprint/signature proof;
- new admission vs member resume;
- lock/unlock capability rotation;
- removed-member denial;
- max-party enforcement;
- malformed/version/size/rate rejection;
- replay/request-gap rejection;
- canonical sender/sequence assignment;
- persistence-before-broadcast semantics;
- Web Lock single-writer behavior where testable;
- host storage missing/corrupt/failure paths;
- guest corrupt/stale replica handling;
- delta and snapshot recovery;
- one-current-transport-per-member;
- no production imports/calls to the old coordinator after migration;
- repository `npm test`, `npm run lint`, `npm run build` gate.

Real-browser/network coverage should include, where practical:

- desktop Chromium;
- iOS Safari;
- Android Chrome;
- Firefox baseline;
- same-LAN and cross-network paths;
- host + multiple guests, including supported party-size/resource observations;
- guest reload, host reload, both reload;
- offline/online interruption;
- Wi-Fi/cellular transition;
- mobile background/foreground/sleep recovery;
- Trystero leave/rejoin lifecycle regression;
- partial/total rendezvous degradation;
- restrictive-network/direct-ICE failures and recorded TURN indicators;
- join/reconnect latency sampling;
- verification that production application traffic/state does not hit C00lG@mes+ `/api/chat/*` or another dynamic backend.

A direct-connect failure on a tested network is evidence to characterize the supported envelope/consider TURN; it is not permission to silently introduce a backend inside #21.

## 16. Deferred responsibilities

Deliberately deferred until evidence/product requirements justify them:

- TURN;
- dedicated authoritative game servers/Colyseus;
- host migration/election;
- public matchmaking;
- persistent accounts/profiles;
- globally trusted rankings/progression;
- cloud party/game state;
- CRDT/general distributed-state framework;
- spectators/large-room architecture;
- multi-strategy rendezvous fallback;
- live rendezvous-capability rotation for existing parties;
- generic prediction/reconciliation/netcode framework;
- frame-by-frame game persistence.

The simplest solution capable of the current experience remains the rule. Do not add a deferred system simply because it is conventional elsewhere.

## Decision summary

The approved production direction is:

```text
static C00lG@mes+ application
        |
        +-- public Nostr/STUN rendezvous/network traversal
        |
        +-- browser-hosted authoritative listen server
                 |
                 +-- host-local IndexedDB authority
                 +-- exclusive same-origin host writer
                 +-- direct WebRTC host-star peers
                 +-- untrusted guest intents
                 +-- reliable party/control protocol
                 +-- game-owned real-time replication when needed
```

This architecture deliberately trades some availability/connectivity/fairness guarantees for extremely low owned runtime infrastructure, static-hosting compatibility, and a simple private-party product model. #21 must validate that those tradeoffs still produce a good player experience before #22/#23 hosting work relies on the architecture.

## External reference set used for the architecture audit

Current implementation decisions should be re-verified when #21 starts. Primary/current references reviewed for this design include:

- Trystero repository/docs and Nostr strategy source/release behavior: `https://github.com/dmotz/trystero`
- MDN WebRTC / RTCDataChannel / signaling guidance: `https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API`
- MDN IndexedDB / Storage API / persistent storage guidance: `https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API` and `https://developer.mozilla.org/en-US/docs/Web/API/Storage_API`
- MDN Web Locks: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API`
- MDN Web Crypto: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API`
- WebKit lifecycle/background power behavior: `https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/`
- Colyseus authoritative state/server docs as the conventional TypeScript dedicated-server comparison: `https://docs.colyseus.io/`

Repository evidence remains authoritative for what C00lG@mes+ actually measured and implemented. External references establish library/browser behavior; they do not upgrade limited POC coverage into universal production reliability.
