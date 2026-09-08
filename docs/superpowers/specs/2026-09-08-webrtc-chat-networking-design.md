# WebRTC Chat Networking Design

Date: 2026-09-08
Status: Proposed for review

## Goal

Replace the current Soundboard experience with a small peer-to-peer Chat feature that proves the networking model we can later reuse for Warrior multiplayer.

The first version must:

- Connect exactly two browsers in real time.
- Send chat messages directly over WebRTC `RTCDataChannel`.
- Require no application server, ECS service, RDS database, message store, or user account system.
- Keep the generic WebRTC transport independent from the Chat UI so Warrior can reuse it later.
- Work from the deployed Vercel site, including fresh navigation from a shared invite URL.

## Non-goals for the first version

- Matchmaking or public rooms.
- More than two peers.
- Persistent accounts, profiles, presence, or message history.
- Server-side signaling.
- TURN relay infrastructure.
- Automatic reconnect after the initiating tab is closed or refreshed.
- Multiplayer changes to Warrior itself.

## Decision

Use WebRTC with manual, zero-backend signaling for the first implementation.

The browsers exchange the WebRTC offer and answer through copy/share actions. Once negotiation completes, all Chat traffic flows over a reliable, ordered `RTCDataChannel` between the two browsers.

This deliberately optimizes for proving the reusable networking layer before introducing infrastructure.

### Alternatives considered

1. **Manual WebRTC signaling — selected for MVP.**
   - No application backend.
   - Exposes the true browser-to-browser connection flow.
   - Slightly clunky two-step invite/answer UX.

2. **Ephemeral serverless signaling — likely next step.**
   - Enables a one-click invite flow while keeping chat/game traffic peer-to-peer.
   - Adds a small signaling service and room/session lifecycle.
   - Should be added only after the peer transport is proven.

3. **Server-authoritative realtime transport.**
   - Best long-term fit for larger competitive games or anti-cheat requirements.
   - Introduces infrastructure and operating cost too early for this experiment.

## User flow

### Host

1. Open `/chat`.
2. Click **Create chat**.
3. The browser creates an `RTCPeerConnection` and a reliable, ordered data channel.
4. The browser creates an SDP offer and waits for ICE gathering to finish.
5. The complete offer is encoded into a shareable `/chat#offer=...` URL.
6. The host copies/shares that URL and keeps the original tab open.
7. The host waits for the guest to return an answer code.
8. The host pastes the answer code into the original tab.
9. The peer connection completes and Chat becomes active.

### Guest

1. Open the host's `/chat#offer=...` invite URL.
2. The browser decodes the offer locally.
3. The guest clicks **Join chat**.
4. The browser applies the remote offer, creates an SDP answer, and waits for ICE gathering to finish.
5. The guest receives a copyable answer code.
6. The guest sends the answer code back to the host using any existing channel such as Messages, email, or another chat.
7. When the host applies the answer, the WebRTC data channel opens and Chat becomes active.

The invite payload is placed in the URL fragment rather than the query string so it is handled client-side and is not sent to Vercel as part of the HTTP request.

## Connectivity model

The MVP uses non-trickle ICE: each side waits for ICE gathering to complete before encoding its session description. This avoids requiring a signaling channel to exchange ICE candidates incrementally.

A public STUN service may be configured to improve direct-connect success across NAT boundaries. STUN is not application state or a C00lG@mes+ backend; it only helps peers discover reachable addresses.

TURN is intentionally omitted from the MVP. Some restrictive corporate, carrier, or symmetric-NAT networks may therefore fail to connect. That failure mode should be surfaced clearly in the UI rather than hidden.

If testing shows TURN is materially necessary, it becomes a separate infrastructure decision after the peer-to-peer prototype is validated.

## Architecture

### `src/networking/webrtc/PeerSession.ts`

Owns one `RTCPeerConnection` and its data channel.

Responsibilities:

- Create host offers.
- Accept guest offers and create answers.
- Apply answers on the host.
- Wait for ICE gathering completion.
- Expose connection state changes.
- Send and receive opaque application messages.
- Close and clean up WebRTC resources.

It must not know about React, pages, chat bubbles, routes, or Warrior game state.

The public API should be small enough that Chat and future games can consume it without knowing WebRTC negotiation details.

### `src/networking/webrtc/signalingCodec.ts`

Pure encoding/decoding helpers for versioned signaling payloads.

Responsibilities:

- Encode an `RTCSessionDescriptionInit` into a URL-safe string.
- Decode and validate a URL-safe string.
- Reject unsupported versions, invalid JSON, and unexpected SDP types.

Signaling should be versioned from day one so later signaling changes do not silently misinterpret old invite links.

### `src/networking/webrtc/types.ts`

Defines transport-level states and signaling types. Application message types should not live here.

Suggested connection states:

- `idle`
- `creating-offer`
- `awaiting-answer`
- `creating-answer`
- `connecting`
- `connected`
- `disconnected`
- `failed`
- `closed`

### `src/chat/chatProtocol.ts`

Defines Chat-specific messages sent over the generic peer transport.

Use a versioned envelope, for example conceptually:

```text
{
  version: 1,
  type: "chat.message",
  id: "...",
  sentAt: "...",
  payload: { text: "..." }
}
```

The networking layer transports the serialized message but does not interpret its Chat semantics.

This boundary is important for Warrior: a future game can define its own protocol (`input`, `snapshot`, `event`, etc.) while reusing the same `PeerSession`.

### `src/pages/ChatPage.tsx`

Owns the Chat user experience and React state.

Responsibilities:

- Host/create flow.
- Guest/join flow when an invite fragment is present.
- Answer-code copy/paste flow.
- Connection status and actionable failures.
- Ephemeral message list.
- Sending messages only when connected.
- Closing the peer session on unmount.

The page should remove sensitive signaling data from the visible URL after decoding when practical without breaking the active in-memory session.

### Routing/navigation

- Add canonical `/chat`.
- Change primary navigation and home-page copy from **Soundboard** to **Chat**.
- Preserve `/soundboard` as a compatibility redirect to `/chat` rather than leaving existing links dead.
- Remove or redirect `/soundboard/sound` as appropriate.

Because the app uses `BrowserRouter`, the deployed Vercel configuration must support fresh navigation to `/chat` and `/chat#offer=...`; this must be verified against the deployed build rather than assumed from client-side navigation.

## Data ownership and lifecycle

There is no server-side state in the MVP.

- Signaling offer/answer data exists only in browser memory, the invite URL fragment, and the copied answer code.
- Chat messages exist only in the two active browser tabs.
- Refreshing or closing either tab ends the session.
- There is no history after both tabs are gone.

This is intentional and keeps the first prototype focused on realtime transport.

## Reliability and security

- Use WebRTC's encrypted transport; do not invent application-level encryption for the MVP.
- Treat signaling strings as untrusted input and validate decoded shape/version/type.
- Bound individual chat message size to prevent accidental or hostile oversized messages.
- Bound the in-memory rendered message history to avoid unbounded growth in long-running tabs.
- Disable sending until the data channel is open.
- Surface `failed` and `disconnected` states with clear restart guidance.
- Do not auto-execute arbitrary message payloads; deserialize only the versioned Chat protocol.

## Testing

### Unit tests

`signalingCodec`:

- Offer round trip.
- Answer round trip.
- URL-safe output.
- Invalid base64/JSON rejection.
- Unsupported version rejection.
- Wrong SDP type rejection.

`PeerSession`:

- Use an injectable/mock `RTCPeerConnection` because jsdom does not provide a real WebRTC stack.
- Host offer lifecycle.
- Guest answer lifecycle.
- Apply-answer lifecycle.
- Data-channel send/receive.
- State transitions.
- Cleanup and failure paths.

`chatProtocol`:

- Valid message serialization/parsing.
- Invalid version/type/payload rejection.
- Message length enforcement.

### Component/router tests

- Header and home page expose **Chat** instead of **Soundboard**.
- `/chat` renders the host flow.
- Invite fragments render the guest flow.
- Legacy `/soundboard` routes redirect to `/chat`.
- Connected Chat UI sends and displays messages through a mocked peer session.

### Manual acceptance test

On the Vercel preview deployment:

1. Host in Browser A creates an invite.
2. Guest opens the invite as a fresh navigation in Browser B/device B.
3. Guest creates and returns an answer.
4. Host applies the answer.
5. Both sides reach `connected`.
6. Messages are delivered both directions with no application server or database.
7. Closing one side surfaces the disconnect on the other.

Run the same test with two tabs on one machine first, then with two physical devices on different networks to expose NAT behavior.

## Future Warrior integration

The Chat feature is a transport proving ground, not a separate networking architecture.

After this works, Warrior multiplayer should consume the same peer-session abstraction while defining a game-specific protocol. The likely first game architecture is host-authoritative:

- Host browser owns canonical simulation state.
- Guest sends player inputs.
- Host sends authoritative snapshots/events.
- Chat/control can remain on a reliable ordered channel.
- A future game-state channel can use different reliability/ordering characteristics if profiling shows that is valuable.

Server-side matchmaking, TURN, anti-cheat, persistence, and larger player counts should be evaluated independently rather than being forced into this first Chat prototype.

## Acceptance criteria for implementation

The implementation is complete when:

- The Soundboard surface is replaced by Chat in site navigation.
- A host can generate a shareable invite without C00lG@mes+ backend infrastructure.
- A guest can open that invite and generate an answer.
- The host can apply the answer and establish a WebRTC data channel.
- The two browsers can exchange realtime text messages in both directions.
- The connection lifecycle and failures are visible and recoverable by restarting the flow.
- No chat messages or session state are persisted server-side.
- The networking layer is independent of React and Chat semantics.
- Existing tests are updated and new networking/chat tests pass.
- The production build succeeds.
- Fresh `/chat` invite navigation works on the Vercel preview deployment.
