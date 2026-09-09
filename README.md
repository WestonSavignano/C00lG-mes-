# C00lG@mes+

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

## Durable peer-to-peer Chat rooms

`/chat` is a small-group WebRTC room system that also serves as the networking foundation for future multiplayer games.

Room identity survives refreshes, while WebRTC connections are intentionally disposable. When a host or guest refreshes, the page returns to the same room and automatically negotiates fresh WebRTC connections. Visible message history is intentionally ephemeral and may clear on refresh.

Chat uses a host-star topology with a v1 limit of 8 total members. Each guest maintains one WebRTC `RTCDataChannel` connection to the host. Guest messages travel to the host over WebRTC, and the host broadcasts canonical messages to the other connected guests. Chat-message payloads are never relayed or persisted by the room coordinator.

### Host flow

1. Open `/chat`.
2. Select **Start Chat**.
3. The current tab navigates to the private durable host URL.
4. Copy the separate **Guest invite** shown in the room UI and share it with the group.
5. Guests join automatically when they open that URL; nobody returns an answer code or token.
6. The host can lock/unlock admission and remove individual guests.

The private host URL contains the room ID plus host and invite credentials so the host can refresh and still reconstruct the share link:

```text
/chat#room=<roomId>&host=<hostSecret>&invite=<inviteSecret>
```

Do not share the private host URL. The UI exposes a guest-only invite:

```text
/chat#room=<roomId>&invite=<inviteSecret>
```

### Guest flow

1. Open the guest invite.
2. The browser automatically joins the room.
3. A random member ID and member secret are stored in `localStorage` for that room only.
4. WebRTC negotiation happens automatically through the coordinator.
5. Refreshing the browser resumes the same member identity and creates a fresh WebRTC connection.

If the room is locked, existing non-removed members can reconnect, but a new browser cannot create a new member identity. If the host removes a member, that member credential can no longer resume.

### Signaling and room coordination

Vercel Functions and Upstash Redis provide only room membership/control state and short-lived WebRTC signaling:

- Rooms expire after 7 days of inactivity.
- Offer/answer signaling records expire after 120 seconds.
- Connection generations prevent stale signaling from an old page instance from being reused.
- Host/invite/member secrets are stored in Redis as hashes rather than plaintext.
- Coordinator credentials are sent in HTTPS POST bodies, not query strings.
- `/api/chat` contains only Vercel Function entrypoints; shared server code lives under `server/chat`.

Chat messages themselves remain WebRTC-only.

### Environment variables

Room creation/joining requires the following server-only Vercel environment variables:

```text
UPSTASH_REDIS_REST_URL=<Upstash REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash REST token>
```

If Redis is not configured or unavailable, the rest of C00lG@mes+ still loads normally and Chat reports that rooms are temporarily unavailable.

Optional local profanity/phrase masking is configured with:

```text
CHAT_MODERATION_TERMS=<comma-separated words and phrases>
```

`CHAT_MODERATION_TERMS` is intentionally not a `VITE_*` variable. The build normalizes the configured terms and injects only hashed lookup data into the browser bundle. No moderation vocabulary is checked into this public repository. If the variable is missing or empty, moderation is a safe no-op and Chat continues normally.

Moderation runs only when messages are sent, relayed, or rendered—not on every keystroke. The lookup is indexed by phrase length and uses local hash-set checks to keep the UX lightweight on older devices.

### Current networking limits

The peer connection uses public STUN discovery but intentionally does not use a TURN relay yet. Restrictive corporate networks, carrier networks, or certain NAT combinations may therefore fail to establish a direct WebRTC connection even when room coordination succeeds.

TURN remains a separate follow-up decision based on real-network testing.

## Multiplayer direction

The room architecture is intentionally aligned with future Warrior multiplayer:

- The room coordinator provides durable lobby/member identity and reconnect semantics.
- Host-star WebRTC provides the initial host-authoritative topology.
- A player refresh can return to the same room/player slot with a fresh transport.
- Warrior can define game-specific input/snapshot/event messages while reusing `PeerSession`, room membership, signaling, reconnect generations, and host controls.

Matchmaking, TURN, persistent accounts, anti-cheat, spectators, and larger player counts remain separate follow-on decisions.

## Deployment

The site is deployed on Vercel. `vercel.json` preserves `/api/*` as Vercel Functions first and falls back other fresh client-side routes to `index.html`, so durable `/chat#room=...` URLs can be opened directly or refreshed.
