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

## Chat networking status

C00lG@mes+ has an approved browser-hosted networking target, but production Chat has **not migrated to it yet**.

- **Current production implementation:** Vercel Functions + Upstash Redis coordinate durable membership/control and short-lived WebRTC signaling. Chat payloads travel over host-star WebRTC.
- **Approved target architecture:** browser-hosted authoritative listen server + Trystero/Nostr public rendezvous + host-local IndexedDB authority + direct host-star WebRTC, with no C00lG@mes+-owned dynamic application backend.
- **Migration boundary:** Issue #21 implements the approved target. Until #21 lands, `api/chat/`, `server/chat/`, `src/networking/room/`, the current URLs below, and Upstash runtime configuration remain real production dependencies.

The canonical target design is:

`docs/superpowers/specs/2026-09-14-client-only-host-authoritative-networking-design.md`

The prior coordinator design is retained as explicitly superseded implementation history at:

`docs/superpowers/specs/2026-09-08-webrtc-chat-networking-design.md`

## Current production Chat implementation

`/chat` is currently a small-group WebRTC room system with a v1 limit of 8 total members.

Room/member identity survives refreshes, while WebRTC connections are disposable. When a host or guest refreshes, the current coordinator helps the browsers negotiate fresh WebRTC connections. Current visible Chat history is ephemeral and may clear on refresh.

Each guest maintains one WebRTC `RTCDataChannel` connection to the host. Guest messages travel to the host over WebRTC, and the host broadcasts canonical messages to the other connected guests. Chat-message payloads are never relayed or persisted by the coordinator.

### Current host flow

1. Open `/chat`.
2. Select **Start Chat**.
3. The current tab navigates to the private durable host URL.
4. Copy the separate **Guest invite** shown in the room UI and share it with the group.
5. Guests join automatically when they open that URL; nobody returns an answer code or token.
6. The host can lock/unlock admission and remove individual guests.

The current private host URL contains room, host, and invite credentials:

```text
/chat#room=<roomId>&host=<hostSecret>&invite=<inviteSecret>
```

Do not share the private host URL. The current guest-only invite is:

```text
/chat#room=<roomId>&invite=<inviteSecret>
```

These are the **current production URL semantics**, not the approved #20 target URL/capability design.

### Current guest flow

1. Open the guest invite.
2. The browser automatically joins the room.
3. A random member ID and member secret are stored in `localStorage` for that room.
4. WebRTC negotiation happens automatically through the coordinator.
5. Refreshing resumes the same member identity and creates a fresh WebRTC connection.

If the room is locked, existing non-removed members can reconnect but a new browser cannot create a new member identity. If the host removes a member, that member credential can no longer resume.

### Current signaling and room coordination

Vercel Functions and Upstash Redis currently provide room membership/control state and short-lived WebRTC signaling:

- Rooms expire after 7 days of inactivity.
- Offer/answer signaling records expire after 120 seconds.
- Connection generations prevent stale signaling from an old page instance from being reused.
- Host/invite/member secrets are stored in Redis as hashes rather than plaintext.
- Coordinator credentials are sent in HTTPS POST bodies, not query strings.
- `/api/chat` contains Vercel Function entrypoints; shared server code lives under `server/chat`.

Chat payloads themselves remain WebRTC-only.

### Current runtime environment

Production room creation/joining currently requires:

```text
UPSTASH_REDIS_REST_URL=<Upstash REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash REST token>
```

If Redis is unavailable, the rest of the arcade still loads and current Chat reports that rooms are temporarily unavailable.

Issue #21 removes this production Chat runtime dependency; Issue #20 does **not** remove it.

## Approved target networking architecture

Issues #18 and #19 both reached **PROCEED WITH CONSTRAINTS** and established enough evidence to approve the target for production migration through #21.

The target is a **browser-hosted authoritative listen-server architecture**:

- one active host browser is the authoritative session server;
- up to seven guests are passive, untrusted clients;
- Trystero/Nostr supplies public decentralized rendezvous/signaling;
- application identity is independent from transient Trystero/WebRTC peer IDs;
- guests send intents/requests, never canonical state;
- the host authenticates, validates, canonicalizes, sequences, persists when applicable, then broadcasts;
- host canonical party/Chat authority is stored in IndexedDB;
- guest member credentials/cursors and optional cache are stored locally;
- an exclusive browser-local host-writer guard prevents same-origin duplicate host authority;
- reconnect uses bounded delta replay or snapshot fallback;
- missing/corrupt/unavailable host authority fails closed;
- permanent host disappearance/storage loss ends the v1 party;
- public Nostr/STUN are third-party infrastructure; this is not “zero infrastructure.”

The target intentionally ships without TURN initially and accepts a documented restrictive-network failure envelope while #21 gathers broader production-oriented evidence.

### Target security/trust model

The target separates:

- party identity;
- per-party host signing identity;
- rendezvous capability;
- revocable new-member admission capability;
- durable guest/member credential;
- transient connection attempt;
- transient Trystero/WebRTC peer identity.

A guest verifies cryptographic host proof before releasing member/admission credentials. Possessing a leaked rendezvous capability does not make a browser the authoritative host or canonical member.

Locking new admission revokes the current admission capability; unlocking creates a new admission capability/invite while existing members continue to use their durable member credentials.

See the #20 spec for exact production semantics and failure behavior.

## Multiplayer direction

The shared networking architecture is intentionally limited to party/authority concepts that Chat and real future games can genuinely reuse.

### Shared party/control plane

The reliable party/control plane owns concepts such as:

- party/member identity and authentication;
- host authority;
- invite/admission/lock/removal;
- reliable canonical control events;
- Chat;
- reconnect cursors, delta replay, and snapshot recovery;
- bounded durable party/checkpoint state where a real consumer needs it.

### Game-owned real-time plane

Future multiplayer games own their own simulation/netcode. A game may choose tick-based inputs, unordered or partially reliable WebRTC traffic, host snapshots, interpolation, prediction, reconciliation, or game-specific checkpoints when its mechanics require them.

Do **not** route frame-by-frame simulation through React or persist every game frame to IndexedDB. Do not turn the Chat synchronization protocol into a speculative generic multiplayer engine.

The browser-host model is approved for Chat/private parties and near-term small casual/co-op multiplayer. A future game should reconsider a dedicated authoritative server when requirements include platform-trusted rankings/outcomes, valuable persistent progression, public matchmaking, host-independent availability, larger rooms, or connectivity/fairness requirements the browser listen server cannot meet. Colyseus is the first TypeScript dedicated-game-server framework to evaluate at that future evidence gate; it is not a current dependency.

## Moderation

Optional local profanity/phrase masking is currently configured at build time with:

```text
CHAT_MODERATION_TERMS=<comma-separated words and phrases>
```

`CHAT_MODERATION_TERMS` is intentionally not a `VITE_*` variable. The build normalizes configured terms and injects only hashed lookup data into the browser bundle. No moderation vocabulary is checked into this public repository. Missing/empty configuration is a safe no-op.

Moderation runs only when messages are sent, relayed, or rendered—not on every keystroke. This remains compatible with the approved client-only target because it is a build-time/client capability, not a required dynamic server.

## Current networking limits

Both the current coordinator implementation and the approved target intentionally omit TURN today. Restrictive corporate/school networks, carrier/VPN combinations, or certain NAT/firewall configurations can therefore fail to establish direct WebRTC even when rendezvous/signaling succeeds.

#18 proved successful direct connectivity without TURN on tested paths; it did not prove universal connectivity. #21 must record broader browser/network evidence and create a separate TURN decision if the supported player experience requires it.

## Deployment

### Current production

The site is currently deployed on Vercel. `vercel.json` preserves `/api/*` as Vercel Functions and falls back fresh SPA routes to `index.html`.

### Approved hosting sequence

The evidence-backed sequence is:

1. **#20** — approve/document the browser-hosted networking target;
2. **#21** — migrate production Chat so it no longer requires `/api/*`, Upstash, or another C00lG@mes+ dynamic application backend;
3. **#22** — provision/validate static AWS production hosting using Route 53, CloudFront, and private S3;
4. **#23** — cut `coolgamesplus.com` over to AWS and retire obsolete legacy hosting/runtime resources after validation.

AWS/static hosting is therefore the planned target, **not yet the current production host**.
