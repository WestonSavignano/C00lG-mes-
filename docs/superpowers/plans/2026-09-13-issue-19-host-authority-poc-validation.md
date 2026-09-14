# Issue #19 host-authority POC validation

## Purpose

This is the manual evidence plan for Issue #19. The POC answers one architectural question: can a host browser behave as the canonical application server for a small C00lG@mes+ party while guests reconnect and converge without any C00lG@mes+-owned application-state backend?

The POC route is `/networking-poc/host-authority`. It is intentionally separate from production Chat. It reuses the Issue #18 Trystero/Nostr transport proof, keeps TURN disabled, stores host authority in IndexedDB, and stores guest identity/replica metadata locally in the guest browser.

## Authority contract under test

Guest traffic is a request, never canonical state:

`guest intent -> host authentication -> host validation -> host sender assignment -> host sequence assignment -> durable host commit -> canonical broadcast`

The host persists a commit before replacing its in-memory canonical state and before the POC broadcasts that canonical event. Host mutations are serialized so simultaneous guest requests cannot receive the same canonical sequence.

A reconnecting guest presents its durable application identity/credential and recovery cursor. The host either sends retained canonical deltas or a bounded snapshot. The guest overwrites/converges from host authority; it never merges stale guest state into the host.

## Diagnostics to capture

Use **Copy diagnostics** after meaningful transitions. The diagnostic JSON intentionally excludes the party capability secret, raw guest credential secret, and persisted host credential verifier.

Capture at minimum:

- host and guest durable application identities;
- transient Trystero transport IDs before and after reload;
- canonical sequence and retained-history lower bound;
- last sync mode (`delta` or `snapshot`);
- guest canonical member ID and request cursor;
- lock/removal state;
- current direct WebRTC peers and Nostr relay count;
- recovery log entries.

## Manual evidence matrix

### 1. Initial authority and canonicalization

1. Open `/networking-poc/host-authority` and create a durable test party.
2. Open the generated guest invite in a second browser/device.
3. Wait for direct WebRTC connection and guest authority acceptance.
4. Commit one host message.
5. Submit one guest message.

Expected:

- the host sequence advances monotonically;
- the guest submission is logged as an intent before it appears as canonical Chat;
- the canonical guest message uses the host-owned member ID/label, not a guest-claimed sender;
- both sides converge on the same canonical sequence and message order;
- diagnostics report `applicationStateBackend: none` and `turnConfigured: false`.

### 2. Guest reload / disposable transport

1. Capture the guest application identity, canonical member ID, transport ID, and canonical sequence.
2. Reload only the guest.
3. Capture the same fields after reconnect.

Expected:

- application identity and canonical member ID remain stable;
- the Trystero transport ID changes;
- the host rebinds the same member to the new transport rather than admitting a duplicate member;
- recovery converges by delta when retained history covers the guest cursor.

### 3. Host reload / IndexedDB restore

1. With canonical messages and at least one admitted guest, capture host sequence, incarnation, membership, and lock state.
2. Reload only the host.
3. Allow the still-running guest to reconnect.

Expected:

- the host restores the same party identity/incarnation, canonical sequence, bounded Chat history, membership, and lock state from IndexedDB before serving authority traffic;
- the guest reconnects under the same canonical member identity;
- no server-side room/history record is required.

### 4. Both reload

1. Reload both host and guest.
2. Allow discovery/reconnect to complete.

Expected:

- host authority restores from IndexedDB;
- guest credential/replica metadata restores locally;
- transient transport IDs may change;
- the guest converges to the restored host sequence without creating a new canonical member.

### 5. Duplicate/replay rejection

1. Send a guest message successfully.
2. Use **Replay last guest intent**.

Expected:

- the replay does not create another canonical message or advance canonical sequence;
- the host logs `duplicate-or-replay` rejection and keeps host state authoritative.

### 6. Stale cache and snapshot fallback

1. Use **Reset replica to seq 0 + resync**.
2. Observe whether recovery is `delta` while sequence 0 is still covered.
3. Generate enough canonical events to move sequence 0 outside the bounded retained history, then repeat.
4. Use **Force snapshot recovery** as the explicit snapshot-path probe.

Expected:

- retained history produces delta recovery;
- an out-of-window or deliberately impossible cursor produces snapshot recovery;
- stale guest state never decreases or overwrites host sequence/state.

### 7. Removal survives reconnect

1. From the host, remove an admitted guest.
2. Reload that guest and allow it to reconnect at the transport layer.

Expected:

- removal is already durable before the host closes the guest transport;
- the returning credential is denied with `member-removed`;
- the guest cannot resurrect itself from its cached replica.

### 8. Lock survives host reload

1. Lock new admission on the host.
2. Reload the host and confirm the lock remains set.
3. Reconnect an already admitted, non-removed guest.
4. Open the invite in a genuinely fresh browser profile/device with no admitted credential.

Expected:

- returning admitted members may resume;
- a new credential is denied with `party-locked`;
- reload does not clear the durable lock.

### 9. Multiple reconnecting guests

1. Admit two or more guests where practical.
2. Send intents from different guests close together.
3. Reload/reconnect them independently.

Expected:

- canonical sequence remains strictly monotonic with no collisions;
- each durable member remains bound to at most one current transient transport;
- all accepted replicas converge to the same host sequence/order.

### 10. Missing/corrupt host storage fails closed

Automated tests exercise missing, invalid, and failed durable host writes. For a browser proof of missing storage, delete the `c00lgames-poc-host-authority` IndexedDB database for the origin after capturing diagnostics, then reload the host URL.

Expected:

- the host reports that durable host state is unavailable/missing and does not silently create a new authority with the same invite;
- it does not accept guest state as replacement authority.

A malformed durable-state object is also rejected by the persisted-state validator in automated tests.

## Decision gate

Do not record the final Issue #19 decision from automated tests alone. After the browser matrix above is exercised on the relevant real devices/browsers, record exactly one result on Issue #19:

- **PROCEED**
- **PROCEED WITH CONSTRAINTS**
- **REJECT**

If the proof succeeds, production constraints should explicitly include browser-profile durability/eviction, host availability/suspension, bounded-history policy, reconnect UX, storage-version migration, and the fact that public rendezvous/STUN remain third-party infrastructure. Host election/migration, cloud persistence, production Chat migration, generic distributed-state abstractions, and game-frame persistence remain deferred.
