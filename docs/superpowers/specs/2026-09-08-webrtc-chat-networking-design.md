# WebRTC Chat Networking Design

Date: 2026-09-08
Status: Approved in chat

## Goal

Evolve the current two-browser WebRTC Chat prototype into a small-group, room-based system that removes the manual offer/answer ceremony while preserving peer-to-peer chat traffic and creating a reusable networking foundation for future Warrior multiplayer.

The key abstraction is:

- **Room identity is durable.** A room survives browser refreshes and short disconnects.
- **Member identity is durable per browser and room.** A returning browser can rejoin the same room without becoming a new member.
- **WebRTC connections are disposable.** Refreshing destroys the old connection; the app automatically negotiates a fresh one inside the same room.
- **Chat history remains ephemeral.** Refreshing may clear visible messages. We are not adding message persistence.

The first room-based version must:

- Let a host create a room once and receive a durable host URL.
- Navigate the host's current tab to the durable host URL immediately after room creation.
- Provide a separate share URL that anyone with the invite can open.
- Let invite recipients join automatically with no answer-code copy/paste step.
- Support a small group rather than exactly two browsers.
- Re-establish WebRTC connections automatically when the host or a guest refreshes.
- Let the host see room members and remove members.
- Let the host lock or unlock the room so existing members can reconnect while new identities can be prevented from joining.
- Keep chat messages off the room coordinator and send them over WebRTC `RTCDataChannel` connections.
- Keep the generic WebRTC transport independent from Chat UI and semantics so Warrior can reuse it later.
- Add lightweight, repo-code-only moderation whose word/phrase vocabulary comes from a Vercel environment variable and becomes a no-op when that variable is absent.
- Preserve performance as a first-class constraint, including on older machines.

## Non-goals for this version

- Server-side chat-message relay or persistence.
- Persistent user accounts, passwords, profiles, or cross-device identity.
- Public room discovery or matchmaking.
- Large rooms. The initial design targets small groups; the implementation should cap the room at 8 total members unless later evidence supports raising it.
- TURN relay infrastructure.
- Full anti-cheat or competitive-game authority beyond the host-authoritative topology.
- Durable chat history after refresh.
- Hiding moderation policy as a cryptographic secret. The source terms stay out of GitHub and plaintext client source, but a determined user could still infer a hashed profanity list by dictionary testing.
- Invite rotation in the first room iteration. Lock/unlock plus member removal are sufficient initial controls.

## Architecture decision

Use a **durable room coordinator on Vercel backed by Redis**, while retaining WebRTC for chat/game traffic.

The coordinator is signaling and membership infrastructure, not a chat server. It stores room membership, authorization metadata, presence, and short-lived WebRTC offer/answer state. Chat messages never pass through Redis or the Vercel coordinator.

For the first implementation, use ordinary HTTPS Vercel Functions with lightweight adaptive polling rather than depending on Vercel's WebSocket support while that capability is still in public beta. Polling is limited to small signaling/control payloads and is independent of chat-message throughput. A future transport adapter may replace HTTP polling with WebSockets without changing room semantics.

Use a Vercel Marketplace Redis integration such as Upstash Redis. The server-side Redis adapter must be isolated so the storage provider can be replaced without changing Chat or WebRTC code.

## URL and identity model

### Room ID

Each room receives a cryptographically random public `roomId`. The room ID identifies state but does not authorize privileged actions.

### Host URL

The host receives a durable URL conceptually shaped like:

```text
/chat#room=<roomId>&host=<hostSecret>
```

The `hostSecret` grants room-owner authority. The UI must never present the host URL as the URL to share with guests.

When **Start Chat** is clicked, the current `/chat` page creates the room and then replaces/navigates the current tab to the resulting durable host URL. From that point forward, refreshes reload the same room identity and host authority. If room creation fails, the current page stays usable and surfaces an actionable error without navigating to a partial room URL.

### Guest invite URL

The host receives a separate share URL conceptually shaped like:

```text
/chat#room=<roomId>&invite=<inviteSecret>
```

Anyone with a valid invite URL can join while the room is open and under the member limit. Opening the URL automatically starts the join/reconnect flow; there is no manual **Join chat**, offer, answer, or return-code ceremony.

### Member identity

When a browser first joins a room, it receives:

```text
memberId
memberSecret
```

The browser stores those credentials in `localStorage`, keyed by `roomId`. They are not added to the share URL because the invite URL must remain reusable by multiple people.

On refresh, the browser presents the stored member credentials and reconnects as the same member. Opening the invite from a different browser/device creates a new member identity.

For v1, the coordinator assigns simple stable labels such as `Guest 1`, `Guest 2`, etc. Display-name editing can be added separately later; it is not required for reconnect or host removal.

### Credential storage

Redis stores hashes of host, invite, and member secrets rather than the raw secrets. Raw credentials live only in browser URL fragments/local storage and the HTTPS request that authenticates them.

URL fragments are intentionally used so room credentials are not automatically sent to Vercel in the initial page request. Client code explicitly sends the required credential to the coordinator API over HTTPS when authenticating.

## Room lifecycle

A room is created with:

- `roomId`
- `hostSecretHash`
- `inviteSecretHash`
- `locked: false`
- member records
- room timestamps/version

Rooms expire after **7 days of inactivity**. Valid host/member activity refreshes the room TTL. This avoids permanent anonymous-room storage while allowing normal refreshes, sleep/wake cycles, and short-term revisits without recreating the room.

A member record contains conceptually:

- `memberId`
- `memberSecretHash`
- assigned display label
- `removed` state
- last-seen/presence metadata
- current connection generation

Presence and membership are different:

- Membership persists while the room exists unless the host removes the member.
- Presence becomes offline when heartbeats stop.
- An offline member can return with the same member credentials and reconnect automatically.

## Host controls

### Remove member

The host member list exposes **Remove** for each guest.

Removing a member:

1. Marks/revokes that member in coordinator state.
2. Causes the host to close the corresponding WebRTC peer session.
3. Causes the guest to surface a clear `Removed from room` state when it next receives coordinator/control state.
4. Prevents the same member credentials from reconnecting.

A reusable invite can still create a new identity while the room is open. Therefore member removal is paired with room locking for stronger practical control.

### Lock/unlock room

The host can toggle room admission:

- **Open:** anyone with the invite may create a new member identity, subject to the room limit.
- **Locked:** existing, non-removed members may reconnect with their member credentials, but the invite cannot create new member identities.

This lets the host share one reusable invite, wait for the intended group to arrive, then lock the room.

## Signaling and reconnect flow

The existing URL-embedded SDP offer is removed from the room URL. URLs identify the room and authorization role; SDP belongs to a single disposable connection generation.

### Connection generation

Every member reconnect attempt uses a fresh random `connectionGeneration` (or equivalent monotonic/random generation identifier). Signaling messages include that generation. Offers/answers from older generations are ignored.

This prevents stale signaling from a previous page instance or rapid refresh from corrupting the current connection.

### Guest first join or refresh

1. Guest loads the invite/room URL.
2. Client reads `roomId` and invite credential from the fragment.
3. If valid stored member credentials exist for this room, the client tries to resume that member first.
4. Otherwise, if the room is open, it creates a new member using the invite.
5. Guest announces a new connection generation through the coordinator.
6. Host sees that the member needs a connection.
7. Host creates a fresh WebRTC offer for that member and publishes it to the coordinator.
8. Guest retrieves the offer, applies it, creates a complete answer, and publishes the answer.
9. Host retrieves/applies the answer.
10. The data channel opens and Chat becomes active.

No user copies signaling data at any point.

### Host refresh

1. Host reloads its durable host URL.
2. Client authenticates the room with the host credential.
3. It reads the existing room roster from Redis.
4. It starts a new host page generation and discards any prior local peer objects.
5. Active/returning guests announce fresh connection generations.
6. Host creates new peer sessions/offers for those members.
7. Normal automatic offer/answer signaling rebuilds the host-star connections.

If guests are online first, they show a lightweight `Waiting for host…` or `Reconnecting…` state until the host returns.

### Signaling polling

The coordinator exposes small versioned HTTP operations for room state and signaling.

Polling should be adaptive:

- Faster while creating/re-establishing a connection.
- Slower while connected and idle, sufficient to detect joins, host controls, or required reconnects.
- Back off further when the tab is hidden/offline where practical.

The implementation must avoid per-keystroke or per-message coordinator calls. Chat traffic is entirely independent from signaling polling.

WebRTC signaling remains non-trickle in this iteration: each side waits for ICE gathering completion before publishing its complete SDP description. This keeps coordinator state and reconnect races simple. Trickle ICE can be evaluated later if real-device connection setup latency warrants it.

## Networking topology

Use a **host-star topology**:

```text
              Host
           /   |   \
       Guest Guest Guest
```

Each guest owns one WebRTC data-channel connection to the host. Guests do not create a full peer mesh with every other guest.

Benefits:

- One connection per guest device.
- Predictable host resource use for small groups.
- Simple member removal.
- Natural host authority for future Warrior multiplayer.
- Easier reconnect semantics.
- Avoids the quadratic peer count of a full mesh.

The host maintains one generic `PeerSession` per connected guest. A room-level manager owns the map of `memberId -> PeerSession` and coordinates host-side broadcast/cleanup.

## Chat protocol in a host-star room

The Chat application protocol remains separate from WebRTC signaling.

A guest sends a Chat message to the host over its data channel. The host validates/moderates the message and broadcasts the canonical message to the other connected guests. Host-originated messages are broadcast directly.

The host assigns/attaches authoritative sender identity based on the connection that delivered the message rather than trusting a guest-supplied sender ID.

Conceptually:

```text
Guest A -> WebRTC -> Host -> WebRTC -> Guest B / Guest C
```

The room coordinator and Redis never receive the chat message.

The Chat protocol remains versioned and bounded. The current 1,000-character message limit and bounded in-memory history should remain unless testing provides a reason to change them.

## Moderation design

### Configuration

Use one optional Vercel environment variable:

```text
CHAT_MODERATION_TERMS=word,another word,bad phrase
```

The value is a simple comma-separated list of words and phrases.

Rules:

- Missing variable: moderation vocabulary is empty; the app continues normally.
- Empty variable: same no-op behavior.
- Whitespace around comma-separated entries is trimmed.
- Empty entries are ignored.
- Duplicate normalized terms are deduplicated.
- There is only one action: matching content is masked with `*` characters. There is no mask-vs-block severity distinction.

### Keep plaintext terms out of the public repo/client source

`CHAT_MODERATION_TERMS` is a build-time server environment variable, not a checked-in source file and not a `VITE_*` value.

The Vite build configuration parses and normalizes the terms at build time and injects only hashed lookup data needed by the browser moderation module. The plaintext vocabulary must not be committed to GitHub or intentionally emitted into the client bundle.

This is source hygiene, not cryptographic secrecy. Common words can be guessed against a hash list, which is acceptable for this requirement.

### Runtime moderation

Moderation runs only when a message is sent/received/relayed, never on each keystroke.

The browser:

1. Tokenizes once while retaining original character spans.
2. Normalizes tokens using lightweight deterministic rules (case, Unicode normalization, surrounding/interstitial punctuation, and a small explicit substitution map where appropriate).
3. Computes hashes for candidate words/phrases using precomputed configured phrase lengths.
4. Checks hash `Set`s.
5. Masks matching original spans.

The host repeats moderation before rebroadcasting guest messages, and recipients moderate before rendering. This provides defense-in-depth if a modified client bypasses its outgoing filter.

The implementation should avoid fuzzy edit-distance matching or large regex chains in v1. Exact normalized word/phrase hashing gives predictable performance and fewer false positives.

## Components and boundaries

### `src/networking/webrtc/PeerSession.ts`

Continue to own exactly one `RTCPeerConnection` and one application data channel.

Responsibilities:

- Create an offer.
- Accept an offer and create an answer.
- Apply an answer.
- Wait for ICE gathering completion.
- Send/receive opaque application messages.
- Expose connection state.
- Close/clean up resources.

It must not know about rooms, Redis, React, Chat messages, or member identity.

### `src/networking/room/RoomClient.ts`

Browser-side room/coordinator client.

Responsibilities:

- Create a room.
- Join/resume a member.
- Authenticate host/member coordinator calls.
- Fetch room roster/control state.
- Publish/retrieve versioned signaling records.
- Maintain adaptive polling lifecycle.
- Surface coordinator failures without crashing the rest of the site.

It must not own `RTCPeerConnection` objects.

### `src/networking/room/RoomPeerManager.ts`

Coordinates WebRTC peers at room level.

Host responsibilities:

- Maintain `memberId -> PeerSession`.
- Start/restart offers for fresh member generations.
- Ignore stale generations.
- Broadcast application messages.
- Close removed/offline/stale peers.

Guest responsibilities may use the same abstraction or a smaller guest controller around one `PeerSession`.

### `api/chat/*`

Vercel Functions implementing the room coordinator API.

Responsibilities:

- Validate all request shapes and protocol versions.
- Create rooms and credentials.
- Join/resume members.
- Authenticate host/member actions.
- Lock/unlock rooms.
- Remove members.
- Store/fetch short-lived signaling records.
- Enforce room-member limits and TTL.
- Rate-limit obviously abusive coordinator calls where practical.

They must never accept, relay, or store chat-message payloads.

### `api/chat/roomStore.ts` or equivalent server-only adapter

Encapsulates Redis operations so API logic can be tested with an in-memory substitute and Redis can be changed later.

### `src/moderation/*`

Pure client moderation utilities and generated/hash configuration boundary.

Responsibilities:

- Normalize terms/message tokens.
- Hash candidate words/phrases.
- Mask matching spans.
- Return input unchanged when no moderation hashes are configured.

No actual profanity strings belong in source or tests. Tests use harmless stand-in terms supplied directly to the test configuration.

### `src/pages/ChatPage.tsx`

The page becomes room-oriented rather than manual SDP-oriented.

Host UX:

- `/chat` shows **Start Chat**.
- Start Chat creates the room and navigates the current tab to its durable host URL.
- Host room shows share URL, room status, member roster, lock/unlock, and remove controls.
- Host page automatically negotiates/re-negotiates each guest peer.

Guest UX:

- Opening a valid invite automatically joins/resumes the room.
- UI shows `Joining…`, `Waiting for host…`, `Reconnecting…`, or `Connected` as appropriate.
- No answer-code textbox/copy-paste flow remains.

Connected UI:

- Shows roster plus ephemeral messages.
- Messages are labeled with coordinator-assigned member labels.
- A refresh clears message history but automatically returns the browser to the same room/member and re-establishes connectivity.

## Vercel and failure behavior

### Redis unavailable or not configured

Room creation/joining requires the Redis-backed coordinator. If Redis environment variables are absent or the provider is unavailable:

- The overall app still loads.
- Other games/routes still work.
- Chat shows a clear `Chat rooms are temporarily unavailable` style error.
- No uncaught startup/build error should break the site.

This is separate from `CHAT_MODERATION_TERMS`; missing moderation configuration always means a silent no-op.

### SPA routing

`vercel.json` must continue to support fresh React routes while preserving `/api/*` for Vercel Functions. The current catch-all SPA rewrite must be adjusted/tested so it does not swallow coordinator endpoints.

### TURN

The peer connection continues to use STUN without TURN initially. Some restrictive network combinations may fail even though room signaling succeeds. UI should distinguish coordinator/join failures from WebRTC connectivity failures.

TURN remains a separate follow-up decision based on real-network testing.

## Security and abuse controls

- Generate room/member/invite/host secrets with browser/server cryptographic randomness; never sequential IDs.
- Use constant-time-capable server-side hash comparison where practical for credential verification.
- Never log raw host, invite, or member secrets.
- Never log URL fragments.
- Treat all coordinator and WebRTC payloads as untrusted and validate protocol version, type, size, and identifiers.
- Keep signaling records short-lived independently of the 7-day room TTL.
- Bound room size to 8 total members in v1.
- Bound signaling record count/size per room and generation.
- A removed member credential can never resume that member.
- Locking a room blocks creation of new member identities while still allowing existing non-removed members to resume.
- Client-side moderation is a product-safety layer, not a trusted security boundary; host and recipient re-filtering reduce easy bypasses.

## Performance constraints

Performance is a first-class requirement.

- No moderation work on keystrokes; only on message send/relay/render.
- Parse moderation configuration once at build/startup.
- Use `Set`/indexed hash lookups rather than scanning the entire configured term list for every message.
- Keep room polling payloads small and adaptive.
- Never route normal chat traffic through Vercel/Redis.
- Guest devices maintain one WebRTC connection, not N peer-mesh connections.
- Host peer count is explicitly bounded by the room-member cap.
- Close old peer sessions immediately on generation changes/removal to avoid resource leaks.
- Do not add heavyweight client runtime dependencies for moderation or room state.
- Any Redis SDK dependency must stay server-only and out of the browser bundle.

## Testing

### Moderation unit tests

Use harmless fixture terms rather than real profanity.

Cover:

- Missing/empty configuration produces an empty lookup and unchanged messages.
- Comma-separated parsing, trimming, deduplication, words, and phrases.
- Normalized case/punctuation matching.
- Masking preserves unaffected text.
- Phrase matching.
- No false mutation when nothing matches.
- Maximum-length chat message remains within expected work bounds by construction (no list scan/fuzzy matching).

### Room/coordinator unit tests

Use an in-memory room store for deterministic tests.

Cover:

- Create room.
- Valid/invalid host credential.
- Valid/invalid invite credential.
- Join new member.
- Resume same member.
- Locked room allows resume but rejects new member identity.
- Member removal prevents resume.
- Member cap enforcement.
- Room expiry/TTL refresh behavior.
- Host/guest signaling publish/fetch.
- Stale connection generation ignored.
- Signaling size/count bounds.

### WebRTC room-manager tests

Use mocked `PeerSession` instances.

Cover:

- Host creates one peer per member generation.
- Multiple guests remain isolated at the transport layer.
- Guest refresh causes a fresh peer connection without changing member identity.
- Host refresh causes fresh connections for returning guests.
- Old generation signals/peers are discarded.
- Host broadcasts canonical Chat messages to connected guests.
- Removing a guest closes only that guest peer.
- Cleanup on page unmount.

### Component/router tests

Cover:

- `/chat` exposes **Start Chat**.
- Start Chat navigates the current tab to a durable host URL after room creation.
- Host UI displays only the guest share URL as the copyable invite.
- Invite URL automatically joins without an answer-code ceremony.
- Guest refresh/remount resumes the same stored member identity.
- Host refresh/remount keeps the same room identity.
- Host roster, remove, lock/unlock controls.
- Reconnecting/waiting/removed/failure states.
- Missing moderation environment behaves as no-op.
- Missing coordinator/Redis config fails Chat gracefully without breaking the app.
- `/api/*` is not swallowed by the SPA rewrite test.

### Manual Vercel acceptance

Test on the Vercel preview with at least three browser contexts/devices:

1. Open `/chat` and click **Start Chat**.
2. Confirm the current tab navigates to a durable host room URL.
3. Copy the guest share URL and open it in Guest A and Guest B.
4. Confirm both guests join without returning any token/code to the host.
5. Confirm all three can exchange chat messages through the host-star WebRTC topology.
6. Refresh Guest A; confirm its previous messages disappear but it automatically resumes the same room/member and reconnects.
7. Refresh the host; confirm guests wait/reconnect and fresh WebRTC sessions are established without new invite links.
8. Remove Guest B and confirm its connection closes and its existing member credentials cannot resume.
9. Lock the room and confirm existing Guest A can refresh/rejoin while a fresh browser opening the invite cannot create a new member.
10. Unlock and confirm a fresh invite browser can join again.
11. Test with `CHAT_MODERATION_TERMS` absent; Chat must work normally with no masking.
12. Test with harmless configured fixture terms in a preview environment and confirm matching words/phrases are masked on send/relay/render.
13. Repeat a connection test across different physical networks to evaluate whether TURN is needed.

## Future Warrior integration

This room architecture is intentionally aligned with multiplayer Warrior.

- The room coordinator becomes the reusable lobby/membership/reconnect layer.
- The host-star WebRTC topology becomes the initial host-authoritative game topology.
- Member identity can map to player slots.
- A player refresh can return to the same room/member and establish a fresh transport.
- Warrior defines its own application protocol for inputs, snapshots, and events while reusing `PeerSession`, room identity, signaling, reconnect generations, and host controls.
- Chat/control can remain on reliable ordered channels.
- A future high-frequency game-state channel may use different ordering/reliability characteristics if profiling supports it.

TURN, matchmaking, persistent accounts, anti-cheat, spectators, and larger player counts remain independent later decisions.

## Acceptance criteria for implementation

The room redesign is complete when:

- **Start Chat** creates a durable room and navigates the current tab to its host URL.
- The host receives a separate reusable invite URL suitable for sharing.
- Multiple guests can open the invite and join automatically without answer-code exchange.
- Host and guest refreshes preserve room/member identity and automatically establish fresh WebRTC connections.
- Chat history may reset on refresh, but the room does not need to be recreated.
- Host can view members, remove a guest, and lock/unlock admission.
- Removed credentials cannot resume; locked rooms reject new identities while existing members can reconnect.
- Chat messages remain WebRTC-only and are never stored/relayed by Redis/Vercel coordinator APIs.
- The host-star topology supports the configured small-group cap without peer-mesh growth.
- `CHAT_MODERATION_TERMS` is optional, comma-separated, mask-only, and absent/empty configuration is a safe no-op.
- No actual moderation vocabulary is checked into the public repository.
- Plaintext moderation terms are not intentionally emitted into the client bundle.
- Coordinator/Redis misconfiguration degrades Chat gracefully without breaking the rest of the site.
- Networking, room coordination, Chat protocol, moderation, and UI remain independently testable modules.
- Vercel fresh-route and `/api/*` behavior is verified.
- Tests, lint, and production build pass.
- Real-device Vercel testing verifies automatic reconnect and documents whether TURN is needed.
