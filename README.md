# Cool Games Plus

Browser games and experiments built with React, TypeScript, Vite, and Phaser.

## Development

```bash
npm ci
npm run dev
```

Validation:

```bash
npm test
npm run lint
npm run build
```

Pull requests run the same test, lint, and build checks through GitHub Actions.

## Production Chat networking

`/chat` uses the browser-hosted architecture approved in Issue #20 and implemented by Issue #21. Production Chat no longer requires a C00lG@mes+-owned signaling/coordinator API, Redis, database, Vercel Function, Lambda, or other dynamic application backend.

The canonical design is:

`docs/superpowers/specs/2026-09-14-client-only-host-authoritative-networking-design.md`

The prior coordinator design remains only as historical implementation context at:

`docs/superpowers/specs/2026-09-08-webrtc-chat-networking-design.md`

### Runtime shape

A Chat party is a small browser-hosted listen server:

- one active authoritative host browser;
- up to seven passive, untrusted guests;
- explicit `@trystero-p2p/nostr` rendezvous through public Nostr relays;
- direct host-star WebRTC application traffic;
- host-local IndexedDB as canonical durable party/Chat authority;
- guest-local IndexedDB for member credentials, host pin, cursors, and a rebuildable cache;
- Web Locks for one same-origin host writer per party;
- bounded delta replay with snapshot fallback;
- no TURN in v1.

Public Nostr relays and STUN are third-party infrastructure. This is **not** a “zero infrastructure” architecture, and direct WebRTC is not guaranteed on every restrictive network.

Host availability is party availability in v1. Permanent host disappearance or loss of the host browser’s canonical IndexedDB authority ends the party; guests never become replacement authority.

### Trust and authority

Guests send untrusted intents. The host owns canonical identity, order, membership/control state, and Chat history:

```text
guest intent -> authenticate -> validate -> canonicalize -> sequence -> persist -> broadcast
```

Durable host mutations persist successfully before in-memory canonical advancement and broadcast. Remote payloads are bounded and version/shape/identity/sequence validated before use.

The implementation separates:

- party ID;
- party incarnation ID;
- per-party ECDSA P-256 host signing identity;
- rendezvous capability;
- revocable new-member admission capability;
- durable guest credential;
- canonical member ID;
- transport-attempt ID;
- transient Trystero/WebRTC peer ID.

A guest verifies the expected host public-key fingerprint and ECDSA host proof before releasing admission or member credentials. Reconnecting guests keep the same canonical member identity even when their transient transport identity changes.

### Invite and reconnect URLs

The durable host route contains no shareable host secret:

```text
/chat#v=2&party=<partyId>&role=host
```

A shareable new-member invite carries rendezvous/admission capabilities and the expected host fingerprint in the fragment:

```text
/chat#v=2&party=<partyId>&r=<rendezvousCapability>&a=<admissionCapability>&host=<hostKeyFingerprint>
```

After successful admission, the guest stores its durable credentials locally and the address bar is scrubbed to:

```text
/chat#v=2&party=<partyId>&role=guest
```

Existing members reconnect with their durable member credential, not the admission capability. Locking admission persists first, invalidates the current admission capability, and still allows legitimate existing members to reconnect. Unlocking mints a new admission capability/invite without rotating the rendezvous capability.

Never log URL fragments, rendezvous/admission capabilities, guest member secrets, host private key material, or credential verifiers.

### Chat bounds and recovery

Production Chat keeps these explicit bounds:

- maximum text length: 1,000 characters;
- maximum serialized Chat message: 8 KiB UTF-8;
- bounded visible/recovery history: 200 messages;
- maximum party size: 8 total members;
- bounded per-member Chat submission rate.

Guests recover from host authority through ordered delta replay when their cursor is still retained, otherwise through a bounded snapshot. Corrupt/stale/gapped guest cache is disposable and never merged into host authority.

A removed member remains removed after refresh/reconnect. A successful reconnect supersedes that member’s prior transient transport rather than creating a second canonical member.

### Lifecycle constraint in Trystero 0.25.4

The production adapter pins the reviewed `@trystero-p2p/nostr` `0.25.4` release and contains the known upstream `room.leave()` closed-data-channel failure mode inside the transport boundary. If a room generation cannot be safely torn down, same-page reuse fails closed and the UI requires a page reload instead of silently reusing a stranded Trystero room.

This workaround is transport-specific and must not leak into Chat or authority semantics. Re-check the upstream lifecycle issue before upgrading Trystero.

## Multiplayer direction

The shared networking architecture is intentionally limited to party/control concerns that Chat and real future games can reuse.

### Shared party/control plane

`src/networking/party/` owns concepts such as:

- party/member identity and authentication;
- host proof and host authority;
- rendezvous/admission/lock/removal;
- reliable canonical control events;
- reconnect cursors, delta replay, and snapshot recovery;
- bounded durable party/Chat state;
- host-star transport lifecycle and one-current-transport-per-member binding.

### Game-owned real-time plane

Future multiplayer games own their own simulation/netcode. A game may choose tick-based inputs, unordered or partially reliable WebRTC traffic, host snapshots, interpolation, prediction, reconciliation, or game-specific checkpoints when its mechanics require them.

Do **not** route frame-by-frame simulation through React or persist every game frame to IndexedDB. Do not turn the Chat synchronization protocol into a speculative generic multiplayer engine.

The browser-host model is approved for Chat/private parties and near-term small casual/co-op multiplayer. A future game should reconsider a dedicated authoritative server when requirements include platform-trusted rankings/outcomes, valuable persistent progression, public matchmaking, host-independent availability, larger rooms, or connectivity/fairness requirements the browser listen server cannot meet. Colyseus is the first TypeScript dedicated-game-server framework to evaluate at that future evidence gate; it is not a current dependency.

## Moderation

Optional local profanity/phrase masking is configured at build time with:

```text
CHAT_MODERATION_TERMS=<comma-separated words and phrases>
```

`CHAT_MODERATION_TERMS` is intentionally not a `VITE_*` variable. The build normalizes configured terms and injects only hashed lookup data into the browser bundle. No moderation vocabulary is checked into this public repository. Missing/empty configuration is a safe no-op.

Moderation runs only when messages are sent, canonicalized, or rendered—not on every keystroke. It is a build-time/client capability and does not require a dynamic Chat backend.

## Networking limits

TURN is intentionally absent today. Restrictive corporate/school networks, carrier/VPN combinations, or certain NAT/firewall configurations can fail to establish direct WebRTC even when public rendezvous/signaling succeeds.

Issues #18 and #19 proved the architecture on tested paths; they did not prove universal connectivity or every browser/mobile lifecycle path. Production-oriented real-browser/network validation remains required before claiming a broader supported envelope.

## Deployment

### Current production

The site remains deployed on Vercel until the approved AWS cutover sequence reaches #23. Vercel now serves the application as a static SPA surface for Chat; production Chat does not require `/api/chat/*` or runtime coordinator secrets. Automatic Git deployments are restricted to `main`; ordinary PR/feature branches rely on GitHub Actions validation rather than Vercel previews.

### Approved hosting sequence

The evidence-backed sequence is:

1. **#20** — approve/document the browser-hosted networking target;
2. **#21** — migrate production Chat to client-only host authority and remove the dynamic coordinator dependency;
3. **#22** — provision/validate static AWS production hosting using Route 53, CloudFront, private S3, and GitHub Actions OIDC;
4. **#23** — cut `coolgamesplus.com` over to AWS, make AWS the canonical production host, retain the existing Vercel project as staging, and retire obsolete Vercel Functions/Upstash/backend production assumptions after validation.

AWS/static hosting is the planned production target, **not yet the current production host**.
