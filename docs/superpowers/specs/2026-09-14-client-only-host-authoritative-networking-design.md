# Client-Only Host-Authoritative Networking Design

Date: 2026-09-14  
Status: Approved target architecture; **not yet the production implementation**  
Owning issue: #20  
Evidence gates: #18 / PR #24 and #19 / PR #35

## Decision

C00lG@mes+ will move production small-party networking to a **client-only listen-server architecture**:

- one browser is the authoritative active host;
- guests are untrusted passive clients;
- application traffic is direct WebRTC in a host-star topology;
- public Trystero/Nostr infrastructure provides decentralized rendezvous;
- host-authoritative durable party state is stored locally in the host browser;
- guest credentials/cursors and an optional cached replica are stored locally in each guest browser;
- C00lG@mes+ owns no dynamic signaling, room-state, Chat-history, or game-state backend for this architecture;
- permanent loss of the host/browser-local authority ends the party in v1.

The feasibility decisions are explicit:

- **Issue #18: PROCEED WITH CONSTRAINTS.** Trystero/Nostr can discover an active host and passive guest and establish direct WebRTC without a C00lG@mes+-owned signaling backend. Application identity/admission can remain independent of transient Trystero peer IDs. Reload/reconnect works on tested paths, but public-rendezvous latency, browser/network coverage, and restrictive-network connectivity remain production constraints.
- **Issue #19: PROCEED WITH CONSTRAINTS.** A browser host can own canonical member identity, sequencing, validation, persistence, delta/snapshot recovery, lock/removal state, and fail-closed restoration without remote application-state infrastructure. Browser-profile storage is the durability boundary and production must add single-writer protection.

This is best understood as a conventional **listen server/client-server game model running inside the host browser**, not symmetric peer authority. The unusual part is where the listen server lives and how peers rendezvous; the authority model itself follows standard host-authoritative multiplayer practice.

## Current implementation versus approved target

Until #21 lands, production `/chat` still uses the existing Vercel Functions + Upstash Redis coordinator under `api/chat/`, `server/chat/`, and `src/networking/room/`. That coordinator remains current runtime code and must not be deleted or described as already retired by this design PR.

This document is the approved target architecture for #21 and future host-authoritative multiplayer work. It supersedes `2026-09-08-webrtc-chat-networking-design.md` as the **future architecture decision**, while the September 8 document remains useful historical/current-implementation context until #21 replaces the coordinator.

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

### Current external facts checked for this design

As of 2026-09-14:

- Trystero `0.25.4` is the current announced stable release. It supports Nostr rendezvous, `passive` peers, application admission handshakes, public `trickleIce`, relay reconnection, `getRelaySockets()`, and optional TURN configuration.
- Trystero's topic-strategy behavior uses a fast startup announcement burst followed by a 60-second steady announcement interval. Version `0.25.4` intentionally reduced steady signaling and improved Nostr relay backoff/recovery.
- Passive peers listen without announcing while dormant and do not connect to other passive peers. An active host plus passive guests therefore matches the intended star discovery behavior.
- Trystero issue #195 is open against `0.25.4`: `room.leave()` can reject after a data channel has already closed, leaving an in-page room instance unable to rejoin. The reported reproduction includes Android/Chrome after screen-off sleep. Production must not ship a lifecycle path that is vulnerable to this failure.
- Web Locks are broadly available in modern secure-context browsers and coordinate exclusive work across same-origin tabs/workers.
- IndexedDB is asynchronous same-origin structured storage; `CryptoKey` objects are structured-clone serializable and may be stored in IndexedDB.
- browser storage is best-effort unless persistent storage is granted; user clearing, private browsing, storage pressure, and Safari proactive eviction remain real durability limits.
- iOS/WebKit may fully suspend background tabs; background/foreground recovery must be treated as lifecycle/reconnect behavior rather than continuous-host availability.
- WebRTC data channels support reliable ordered delivery and partial-reliability/unordered profiles; real-time game replication does not need to inherit Chat/control-plane reliability semantics.

### Architectural assumptions

- v1 parties remain small: maximum 8 total members, one host + at most 7 guests.
- Chat is the first production consumer and is primarily a reliable control/data workload rather than latency-critical high-frequency simulation.
- family/casual/co-op/small-party experiences are the near-term multiplayer target; high-stakes ranked competitive play is not.
- host availability being party availability is acceptable for v1 if the UX states it honestly.
- public relay operators provide no C00lG@mes+ service-level guarantee.

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

Adopt Trystero with its **explicit Nostr package** rather than depending on the root package's default strategy:

```text
@trystero-p2p/nostr
```

The design-time baseline is exact version `0.25.4`, because that is the release proven by #18/#19 and the current stable announcement as of this decision. #21 must re-check the current stable release before installing. A later patch/minor release may replace `0.25.4` only after reviewing its release notes/diff relevant to this architecture and rerunning the focused transport/lifecycle tests. In particular, #21 should prefer a release containing a verified fix for upstream issue #195 if one exists.

Do not load the production dependency from a CDN. #21 must install/pin the reviewed package in the normal build dependency graph and retain lazy loading so unrelated arcade routes do not pay the multiplayer startup cost.

### Production Nostr configuration

The intended configuration contract is:

```ts
{
  appId: 'coolgamesplus-party-v1',
  password: party.rendezvousCapability,
  passive: role === 'guest',
  trickleIce: true,
  relayConfig: {
    redundancy: 5,
    manualReconnection: false,
    warnOnRelayFailure: false,
  },
  // turnConfig intentionally absent in v1.
  // rtcConfig intentionally absent so the reviewed Trystero STUN defaults apply.
}
```

The production implementation may use a namespaced constant with equivalent value, but there must be one stable application namespace for this protocol generation.

C00lG@mes+ does **not** hard-code a custom Nostr relay list initially. Use Trystero's reviewed default list with five-way redundancy. This keeps relay maintenance/backoff/pruning with the library rather than silently making C00lG@mes+ a public-relay operator/curator.

### Fallback strategy

No MQTT, Torrent, Supabase, Firebase, owned WebSocket relay, or multi-strategy fallback is configured in v1.

Fallback complexity is deliberately deferred. Create a focused rendezvous follow-up only if #21 production validation demonstrates that Nostr's measured availability or join latency fails the player-experience gate. The existence of an alternative strategy is not evidence to configure it.

### Late-join/retry UX

Passive guests can miss the active host's startup burst and wait for a later steady announcement. The current Trystero steady interval is 60 seconds, so a healthy late join can approach one minute plus relay/network/handshake time.

The product must expose this honestly:

- 0-10 seconds: `Finding host…`
- 10-75 seconds: `Still looking for the host… Decentralized discovery can sometimes take about a minute.`
- after 75 seconds: `Taking longer than expected` with a visible Retry action and guidance to keep the host page open / try another network if necessary.

Do not automatically convert a slow discovery into party corruption or new identity. Retry creates a fresh transport attempt while retaining durable application identity/credentials.

### Relay outage behavior

- partial relay failure: Trystero continues through surviving relays and its own reconnect/backoff behavior;
- total rendezvous unavailability: new joins and reconnects cannot discover each other; surface a degraded `Rendezvous unavailable`/`Still reconnecting` state without breaking the rest of the site;
- already established WebRTC application traffic does not require Nostr relay delivery and should continue while the direct connection remains healthy;
- relay socket state may inform diagnostics/UX, never authorization or canonical state.

## 2. Production topology

The production topology is one authoritative active host and at most seven passive guests.

### Transport-enforced

Trystero configuration enforces the intended discovery behavior:

- host: `passive: false`;
- guests: `passive: true`;
- passive guests do not connect to other passive guests through normal Trystero discovery.

### Application-enforced

Transport configuration is not a security boundary. The application handshake also enforces:

- host only accepts `guest` application roles;
- guest only accepts a cryptographically proven `host`;
- guest rejects any guest-shaped peer even if a modified client bypasses passive mode;
- host rejects new admissions above seven active/non-removed guests;
- every guest application message is associated with the authenticated member bound to that transport rather than a claimed sender field.

The host has one WebRTC peer relationship per connected guest. A guest has exactly one intended application peer: the host.

## 3. Identity model

The following identities are deliberately distinct.

### Party ID

A cryptographically random identifier naming one party. It is not an authorization secret.

### Party incarnation ID

A cryptographically random identifier persisted in canonical host state when the party is created. It distinguishes one durable authority incarnation from stale guest caches. Host reload retains the same incarnation. The system never silently creates a replacement incarnation for a missing/corrupt host record under the same live party URL.

### Durable host application identity

Each party receives a **per-party ECDSA P-256 signing key pair** generated through Web Crypto.

- private key: non-extractable `CryptoKey`, host IndexedDB only;
- public key: exportable for verification;
- host identity: SHA-256 fingerprint of the canonical exported public key.

The per-party key avoids creating a global cross-party user identifier. Host reload restores the same key. A browser without that key is not the host merely because it has a copied URL or rendezvous secret.

### Durable guest/member identity

A new guest creates:

- random `credentialId`;
- random 256-bit `credentialSecret`.

The host authenticates first admission and then allocates canonical:

- `memberId`;
- stable party-local label such as `Guest 1`.

The host stores the credential ID plus a SHA-256 verifier, not the raw guest secret. The guest stores the raw secret locally.

### Rendezvous capability

A random 256-bit party secret used as Trystero's `password`. It provides access to the private signaling namespace and encrypts signaling descriptions in the rendezvous layer. It is **not** host authority and it is **not** sufficient to become a canonical member.

### Admission capability

A separate random 256-bit capability authorizing creation of a genuinely new member while admission is open. Existing members do not need it for reconnect.

### Transport attempt ID

A fresh random ID per connection/reconnection attempt. It is ephemeral and binds one authenticated member to one current transport attempt. It is never canonical identity or durable authority.

### Trystero/WebRTC peer ID

Transient transport identity supplied by Trystero. It may change after reload/reconnect and must never become canonical C00lG@mes+ identity.

## 4. Invite and authentication model

### Host durable URL

After party creation the host URL contains identity/location information only, not host authority secret material:

```text
/chat#v=2&party=<partyId>&role=host
```

Host authority comes from the browser-local IndexedDB record, signing key, and exclusive host-writer lock. Opening the host URL on another browser without the authority record/key fails closed.

### Guest invite URL

The shareable guest invite is conceptually:

```text
/chat#v=2&party=<partyId>&r=<rendezvousCapability>&a=<admissionCapability>&host=<hostKeyFingerprint>
```

All capabilities live in the URL fragment so a normal initial static HTTP request does not send them to the hosting origin. Fragments are still bearer material: clipboard history, screenshots, browser extensions, logs created by client code, or users can leak them. Never log or include them in diagnostics.

### First admission handshake

The application handshake occurs while Trystero keeps the pending peer out of normal room/action callbacks.

The order is security-significant:

1. guest enters rendezvous using the party ID + rendezvous capability;
2. guest sends a fresh nonce, protocol version, party ID, role, and transport-attempt metadata but **does not yet reveal the admission/member secret**;
3. host returns its public signing key, a fresh host nonce, and an ECDSA signature over a canonical challenge binding at minimum protocol version, party ID, both nonces, and both current transient peer identities;
4. guest fingerprints the returned public key, verifies it equals the invite/local pinned host identity, and verifies the signature;
5. only after host verification does the guest send either:
   - **resume:** credential ID + credential secret; or
   - **new admission:** admission capability + credential ID + credential secret;
6. host validates credentials/admission state, lock/removal/member-limit rules, and current transport attempt;
7. host returns canonical member/incarnation/sync metadata and the peer becomes an accepted application member.

This prevents another holder of a leaked rendezvous capability from impersonating the original host and harvesting member credentials.

### Returning guest URL/state

After successful first admission, the guest stores the rendezvous capability, host pin, and member credential in IndexedDB and scrubs the sensitive invite from the address bar with `history.replaceState()`. The durable local route may remain:

```text
/chat#v=2&party=<partyId>&role=guest
```

A fresh browser opening that sanitized URL without local credentials cannot join; it needs a valid current invite.

### Lock/unlock

Locking admission:

- persists `locked: true` before UI/broadcast acknowledgment;
- prevents new member creation;
- allows existing non-removed members to reconnect with their credentials;
- invalidates the current admission capability so a previously copied invite cannot later create a new member.

Unlocking:

- generates and persists a **new admission capability**;
- produces a new share invite;
- does not rotate the rendezvous capability in v1 because all existing members need that capability to rediscover the party.

### Removal

Removal is durable before transport closure. A removed member credential remains denied across reload/reconnect. Removal does not automatically rotate the rendezvous capability.

A leaked invite/rendezvous capability can therefore still let its holder reach the rendezvous/application-handshake boundary and potentially establish a pending transport, even after admission is locked. It cannot prove host authority or become a canonical member without valid authorization. If the rendezvous capability is believed to be actively abused, the v1 remedy is to end the party and create a new one; live rendezvous rekeying is deliberately deferred.

## 5. Host-local authority and persistence

IndexedDB is the canonical durable application-state boundary.

### Persisted host state

Persist at minimum:

- storage schema version;
- wire protocol version;
- party ID;
- party incarnation ID;
- host signing key pair/public fingerprint;
- rendezvous capability;
- current admission-capability verifier/state;
- lock state;
- canonical sequence;
- canonical member records;
- removed-member tombstones;
- credential IDs + verifiers;
- each member's last accepted client/request sequence;
- bounded canonical authority event log;
- bounded canonical Chat history.

### Production retention

Preserve the existing Chat product limits unless a separate product decision changes them:

- max Chat text: 1,000 characters;
- max serialized individual Chat message: 8 KiB;
- visible durable Chat history: last 200 canonical Chat messages;
- retained authority delta log: last 200 canonical authority events.

If a guest cursor falls before the retained authority-event boundary, recovery uses a snapshot rather than growing the log.

### Schema migration

Host restore order is:

1. acquire the exclusive host-writer lock;
2. open IndexedDB;
3. load the party record;
4. validate record shape and supported schema/protocol versions;
5. run a known explicit transactional migration if the stored schema is an older supported version;
6. re-validate the migrated canonical record;
7. only then join public rendezvous as the active host and accept peers.

An unknown newer schema, missing record, failed migration, corrupt record, unavailable IndexedDB, or failed durable write is **fail closed**. Do not silently initialize a replacement authority under the old party route, and never accept a guest replica as replacement authority.

### Persistent-storage request

The host should request `navigator.storage.persist()` as best-effort durability enhancement. A denial is not fatal but must not be interpreted as guaranteed storage. Browser-profile/origin data loss remains an explicit v1 failure envelope.

### Persist-before-broadcast rule

Canonical mutation order is strict:

```text
intent
-> authenticate current member/transport
-> validate shape/version/size/rate/business rule
-> canonicalize sender/state
-> allocate canonical sequence
-> save durable host state
-> update in-memory authority
-> broadcast canonical result
```

A failed durable save means the mutation is not canonical and must not be broadcast as committed.

### Intentionally not durable

Do not persist:

- Trystero peer IDs;
- RTCPeerConnection/RTCDataChannel objects;
- relay socket state;
- current transient presence;
- current transport-attempt binding;
- pending/uncommitted intents;
- frame-by-frame game simulation;
- high-frequency positional/input history unless a real game later defines a checkpoint/replay product need.

## 6. Guest replica model

Guest durable state also uses IndexedDB in production rather than expanding the POC's synchronous localStorage representation.

Persist:

- schema/protocol version;
- party ID;
- last known incarnation ID;
- rendezvous capability;
- pinned host public key/fingerprint;
- credential ID + raw credential secret;
- canonical member ID after admission;
- last canonical sequence/cursor;
- next client/request sequence;
- optional bounded cached replica for fast rendering.

The cached replica is never authority.

### Reconnect/sync

```text
restore local credential/pin
-> rendezvous
-> cryptographically verify host
-> authenticate member
-> compare canonical cursor
-> delta when retained history covers cursor
   OR snapshot when it does not
-> replace/converge guest replica
```

A wrong-host pin, wrong party/incarnation, malformed cache, impossible sequence, or event gap discards the cached replica and requests a host snapshot. A guest never sends cached canonical state for the host to merge.

## 7. Canonical protocol semantics

All remote payloads are untrusted and versioned.

### Reliable party/control plane

Party admission, auth, Chat, lock/removal, member state, durable canonical events, and sync use a reliable ordered application protocol.

Every guest mutation request carries:

- protocol version;
- message type;
- transport attempt ID where applicable;
- monotonic member-local `clientSequence` for state-changing intents;
- bounded payload.

The host owns canonical sender identity and canonical sequence.

### Duplicate/replay/gap behavior

For a state-changing member request:

- `clientSequence <= lastAcceptedClientSequence`: duplicate/replay; reject/no-op;
- `clientSequence === lastAcceptedClientSequence + 1`: eligible for normal validation/commit;
- `clientSequence > lastAcceptedClientSequence + 1`: sequence gap; reject and require resynchronization before further state-changing intents.

Malformed, unknown-version, unknown-type, oversize, unauthenticated, removed-member, wrong-transport, or unauthorized messages are rejected before mutation.

### One current transport per member

The host keeps an in-memory mapping:

```text
memberId -> { trysteroPeerId, transportAttemptId }
```

When the same valid member authenticates a new transport, the new binding supersedes the old one. The old transport is closed where possible and all later messages from its stale binding are ignored.

### Initial size limits

- individual Chat wire message: existing 8 KiB bound;
- other guest-generated party/control message: 16 KiB pre-parse bound;
- application-handshake message: 16 KiB bound per handshake frame;
- host-generated sync snapshot: 2 MiB defensive maximum, with actual contents already bounded by canonical state/history limits.

No user-controlled message may allocate or parse an unbounded object graph before its serialized-size guard is checked.

### Initial Chat rate policy

Chat is protected by a simple per-member host token bucket:

- capacity: 5 accepted attempts;
- refill: 1 token/second;
- one submitted Chat intent consumes one token before expensive processing/commit;
- exhausted bucket rejects/drops the request without removing the member.

Authentication and sync are connection/recovery operations, not high-frequency actions; repeated invalid/redundant recovery requests may be rejected/coalesced. Future games define their own input-rate policy and do not inherit the Chat bucket.

## 8. Party/control plane versus real-time game networking

This separation is a production architecture rule.

### Shared reliable party/control responsibilities

The shared networking layer may own/reuse:

- party creation/identity;
- rendezvous;
- host proof;
- invite/admission/member credentials;
- authenticated member-to-transport binding;
- lock/removal;
- canonical durable party events;
- reliable ordered control messages;
- reconnect and baseline snapshot/delta foundations;
- lifecycle diagnostics.

### Game-owned real-time responsibilities

A future real-time game owns:

- simulation tick model;
- input command format/frequency;
- authoritative game simulation;
- prediction/reconciliation if needed;
- interpolation/extrapolation if needed;
- game-specific state snapshots;
- whether stale high-frequency packets should be dropped/superseded;
- any need for partially reliable/unordered RTCDataChannel delivery;
- checkpoints worth durable persistence.

WebRTC supports unordered/partially reliable channels through data-channel options such as `ordered`, `maxRetransmits`, and `maxPacketLifeTime`, but #20 does **not** prescribe or build a generic real-time replication framework. The first real multiplayer game that materially needs such a profile should define the smallest transport extension required by that game's evidence.

Do not force movement/aim/tick packets through Chat's durable request/commit path merely for abstraction reuse.

## 9. Single-host-writer safety

Use the browser's Web Locks API as the production same-origin single-writer guard.

Before loading/mutating canonical host authority or joining rendezvous as the active host, acquire an exclusive lock named conceptually:

```text
coolgamesplus:party-host:<partyId>
```

Use non-blocking/`ifAvailable` acquisition for normal UX.

### Required behavior

- first host tab acquires the lock and may restore/run authority;
- second same-origin tab for the same party cannot acquire it, remains non-authoritative, does not join as active host, and shows `This party is already active in another tab.`;
- normal host shutdown releases the lock when the lock callback/runtime ends;
- tab/process termination releases browser-owned lock state; a replacement runtime must reacquire before restore;
- if a suspended/background tab still owns the lock, a second tab remains blocked rather than creating split brain;
- on resume/restart, authority must reacquire the lock before writing or announcing as host;
- never use Web Locks `steal` behavior for normal recovery;
- do not implement distributed host election.

If the Web Locks API is unavailable in a target browser, host mode fails closed with an unsupported-host message rather than falling back to a race-prone ad hoc localStorage lease. Guest mode may still operate if the rest of the required platform is available.

## 10. Failure and lifecycle semantics

| Event | v1 behavior |
|---|---|
| Guest reload | Restore guest credential/pin/cursors, create fresh transport attempt, passive rediscovery, verify host, resume same member, delta/snapshot sync. |
| Host reload | Reacquire writer lock, restore/validate/migrate IndexedDB authority, then active rendezvous; returning guests wait/reconnect. |
| Host + guest reload | Same independent restore paths; logical party recovers once rendezvous reconnects. |
| Brief network interruption | Keep durable application identity; dispose/recreate transient transport as needed. |
| Wi-Fi/cellular transition | Treat stale/failed ICE path as disposable; create fresh transport attempt and resync. |
| Browser background/foreground | Do not assume timers, sockets, or RTC liveness while backgrounded. On foreground, validate transport/relay state and reconnect/resync if stale. |
| Device sleep | Same as background but expect process/network suspension. Recovery must tolerate dead RTC channels and relay sockets. |
| Guest tab/process termination | Host keeps canonical member record; member becomes merely disconnected until it returns or is removed. |
| Host tab/process termination | Committed IndexedDB authority survives if browser storage survives; party unavailable until that browser profile restores host authority. |
| Public rendezvous partial outage | Continue through surviving relays; established WebRTC peers remain usable when direct connections stay healthy. |
| Public rendezvous total outage | No new discovery/reconnect; established direct peers may continue; surface degraded state. |
| Guest storage missing/corrupt | The browser is a new guest and needs a valid admission invite; cached state never becomes authority. |
| Host storage missing/corrupt/unavailable | Fail closed; old party cannot be restored from guests. |
| Permanent host disappearance or host storage loss | Party ends in v1. Create a new party. |

### Trystero teardown/rejoin gate

#21 must explicitly regression-test sleep/background/failed-channel teardown and same-page rejoin. The design-time stable Trystero `0.25.4` has open upstream issue #195 where `room.leave()` can reject on an already-closed data channel and strand that room instance for the life of the page.

Production may satisfy this gate by:

1. adopting a reviewed upstream Trystero release that fixes the defect and passing our tests; or
2. implementing a small contained transport-adapter workaround with deterministic tests and real Android/Chrome lifecycle evidence.

Do not ship production Chat on a known path where one sleep/wake failure can permanently poison reconnect until a full page reload.

## 11. TURN policy

**v1 ships without TURN.**

This is an explicit product/operations tradeoff, not a claim that TURN is universally unnecessary.

- retain Trystero's reviewed default STUN behavior;
- do not configure `turnConfig` in #21;
- direct ICE failure on a restrictive network is an accepted initial failure envelope when the product clearly reports it;
- an `onJoinError` after SDP exchange/direct-connect failure is evidence for the connectivity envelope, not authority corruption.

### TURN evidence gate

Before #21 is considered production-ready, exercise representative desktop Chromium, iOS Safari, Android Chrome where practical, Firefox baseline, and distinct-network paths including Wi-Fi/cellular.

Open a dedicated TURN decision if either:

- a representative supported consumer network/device combination repeatedly cannot establish direct WebRTC despite healthy rendezvous/authentication; or
- post-launch/player-support evidence shows restrictive-network failures materially harm the intended multiplayer experience.

A managed corporate/school network blocking peer-to-peer traffic is documented as part of the no-TURN envelope unless broader player evidence justifies the operational/privacy/cost tradeoff of relaying application traffic.

## 12. Privacy and public-rendezvous implications

Describe this architecture as:

> **No C00lG@mes+-owned dynamic application backend.**

Do not call it `zero infrastructure`.

### Public rendezvous can observe

Nostr relay operators can observe at least their WebSocket client/network metadata, connection timing/traffic volume, Nostr event metadata, and encrypted signaling payloads sent through their relay. Relay operators are independent third parties with their own retention/availability practices; C00lG@mes+ must not promise that every operator discards ephemeral traffic/logs immediately.

Trystero's party password encrypts WebRTC session descriptions while they traverse the rendezvous medium, but this does not make relay participation invisible.

STUN providers participate in NAT traversal and necessarily observe network requests needed to discover reachable candidates.

Direct WebRTC peers exchange the network information necessary to establish their direct path. Application authorization must therefore complete before treating a remote transport as a party member.

### Public rendezvous does not intentionally receive

C00lG@mes+ does not intentionally place the following on Nostr relay infrastructure:

- canonical membership database;
- member credential secrets;
- Chat history;
- game simulation/state;
- display/profile/account data;
- application message payloads after the direct peer connection is established.

### Capability handling

- capabilities stay in URL fragments only for the invite handoff;
- scrub guest invite secrets from the visible URL after successful durable admission;
- never include raw rendezvous/admission/member credentials or host private keys in copied diagnostics, error telemetry, console logs, or persisted guest replicas not requiring them;
- no persistent account identifier is created by this architecture;
- host keys are per-party to avoid creating a cross-party identifier.

For a family-oriented product, prefer these anonymous party-local identities and minimal retained metadata over accounts/persistent profiles until a separate product/privacy review justifies them.

## 13. Future multiplayer-game boundary

Future games should reuse real proven infrastructure, not speculative framework layers.

Reusable networking concepts below Chat:

- party identity/incarnation;
- invite parsing/capabilities;
- active-host/passive-guest rendezvous;
- cryptographic host proof;
- durable member identity/authentication;
- host writer lock;
- lifecycle/reconnect state machine;
- authenticated current transport binding;
- canonical party/control events;
- snapshot/delta primitives where the game has a matching need.

Chat owns:

- Chat intent/canonical message types;
- moderation;
- Chat message-size/rate limits;
- Chat history presentation/retention semantics.

Each future game owns its simulation and real-time replication. Do not create a generic CRDT, matchmaking system, rollback-netcode framework, entity-replication engine, or distributed-state framework until a real game requires it.

## 14. Existing coordinator responsibility map

Every current coordinator responsibility has one target disposition.

| Existing Vercel/Redis responsibility | Target owner/disposition |
|---|---|
| Allocate room ID | Browser host |
| Host credential/owner authority | Browser host signing key + local authority |
| Reusable invite secret | Browser host, split into rendezvous + admission capabilities |
| Canonical room record | Host IndexedDB |
| Member ID/label allocation | Browser host |
| Member credential verification | Browser host |
| Raw guest credential storage | Guest IndexedDB only |
| Eight-member cap | Browser host |
| Lock/unlock state | Browser host + host IndexedDB |
| Member removal/revocation | Browser host + persisted tombstone/verifier state |
| Server-side `lastSeen`/presence | Deleted as durable responsibility; current transport presence is ephemeral host runtime state |
| Coordinator connection generation | Deleted as server state; replaced by ephemeral transport-attempt/current-binding identity |
| Redis revision/CAS across server writers | Deleted; Web Lock + serialized single-host mutations provide local single-writer safety |
| WebRTC offer/answer signaling | Trystero/public Nostr rendezvous |
| 120-second signaling records | Deleted |
| Signaling polling | Deleted |
| Room-state/membership polling | Deleted; direct authenticated canonical events/sync replace it |
| Seven-day remote room TTL | Deleted |
| Upstash/Redis room storage | Deleted after #21 |
| API request auth/shape/version checks | Browser host/guest application protocol boundaries |
| Canonical roster reads | Browser host; replicated to guests over direct WebRTC |
| Chat sender canonicalization | Browser host |
| Chat payload relay | Browser host over direct WebRTC |
| Bounded Chat history | Host IndexedDB canonical history + guest replica/cache |
| Reconnect authorization | Browser host verifies durable guest credential after host proof |
| Nostr relay connection/retry | Trystero/public rendezvous |
| STUN/ICE direct-path discovery | WebRTC/Trystero third-party infrastructure |
| Host migration/election | Intentionally deferred |
| TURN relay | Intentionally deferred behind evidence gate |
| Matchmaking/public rooms/accounts/cloud state | Intentionally deferred |
| High-frequency game simulation authority | Future game-owned host runtime, in memory |

No production coordinator responsibility should remain implicitly owned after #21.

## 15. #21 implementation contract

Issue #21 may choose concrete file/component names while respecting existing repo boundaries, but it must implement the behaviors in this design without reopening the major architecture decision.

Required outcomes include:

- production Chat uses installed/pinned Trystero Nostr transport and no C00lG@mes+ `/api/chat/*` runtime call;
- production host/guest topology is active host + passive guests + application enforcement;
- host proof uses the per-party signing identity before a guest reveals its admission/member secret;
- host and guest durable state move to asynchronous browser storage with fail-closed parsing/migration;
- one exclusive same-origin host writer is enforced before authority restore/network join;
- lock rotates admission capability; removed credentials stay removed;
- canonical Chat follows authenticate -> validate -> sequence -> persist -> broadcast;
- current Chat limits and bounded 200-message history remain unless explicitly reviewed otherwise;
- guests recover by delta or snapshot and never merge authority into host;
- stale transports and duplicate/replayed/gapped intents are rejected;
- relay/rendezvous failure degrades Chat only, not the arcade shell/games;
- Trystero lifecycle teardown/rejoin issue #195 is resolved or safely contained before merge;
- no TURN, alternate rendezvous strategy, cloud state, account system, host election, or speculative game-replication framework is added;
- after the production path is proven unused, `api/chat/`, `server/chat/`, old coordinator client code/config/runtime secrets are removed in #21 as that issue already requires.

## 16. Production validation gate for #21

Automated coverage must include at minimum:

- invite parsing/scrubbing and capability separation;
- host key creation/restore and cryptographic host-proof verification/failure;
- new admission, resume, lock rotation, remove/revocation;
- party-size limit;
- member credential verifier handling;
- malformed/version/size/rate rejection;
- duplicate/replay and request-gap rejection;
- persist-before-broadcast failure behavior;
- host IndexedDB restore/migration/corruption/unavailable handling;
- guest cache corruption/wrong-host handling;
- delta and snapshot recovery;
- current-transport replacement/stale-transport rejection;
- Web Lock first/second host behavior and lock recovery;
- Trystero teardown/rejoin regression for upstream #195 behavior;
- no production references/calls to coordinator APIs/server state after migration;
- repository `npm test`, `npm run lint`, `npm run build` gate.

Manual/browser/network coverage must include:

- host + multiple guests up to a meaningful bounded-party sample;
- desktop Chromium;
- iOS Safari including cellular cross-network path;
- Android Chrome where practical;
- Firefox baseline;
- guest reload;
- host reload;
- both reload;
- brief offline/online;
- Wi-Fi/cellular transition where practical;
- mobile background/foreground and device sleep/wake where practical;
- lock/unlock/new invite;
- removed-member reconnect denial;
- stale-cache/snapshot recovery;
- relay-degraded/unavailable behavior;
- real direct-connect/`onJoinError` evidence for the documented no-TURN envelope;
- same-page leave/rejoin after lifecycle interruption;
- network inspection confirming Chat/application state is direct WebRTC and no C00lG@mes+ dynamic application backend is contacted.

Do not claim production completion from automated tests alone.

## 17. Intentionally deferred

The approved v1 architecture explicitly defers:

- TURN;
- MQTT/Torrent/multi-strategy fallback;
- C00lG@mes+-owned signaling relay;
- host migration/election;
- cloud party/application state;
- persistent accounts/profiles/cross-device identity;
- public matchmaking/room directory;
- CRDT/general distributed-state infrastructure;
- large-room/spectator architecture;
- generalized anti-cheat beyond host authority/untrusted-client validation;
- rendezvous-secret live rotation/rekey;
- generic real-time game replication/prediction/reconciliation framework;
- frame-by-frame durable game simulation.

Each deferred capability requires evidence from a real product/player need before it expands the architecture.

## 18. External references checked 2026-09-14

Primary/current references used to validate browser/library assumptions:

- Trystero repository/API: https://github.com/dmotz/trystero
- Trystero 0.25.4 announcement: https://github.com/dmotz/trystero/discussions/194
- Trystero open lifecycle issue #195: https://github.com/dmotz/trystero/issues/195
- Web Locks API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Storage quotas/eviction/persistence: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- StorageManager `persist()`: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- Web Crypto / serializable `CryptoKey`: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- structured clone / `CryptoKey`: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
- RTC data-channel reliability options: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel
- WebKit background suspension behavior: https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/

Repository evidence remains authoritative for what C00lG@mes+ actually measured and implemented. External references establish current library/browser behavior; they do not upgrade limited POC coverage into universal production reliability.
