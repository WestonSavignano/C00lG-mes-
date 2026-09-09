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

## Peer-to-peer Chat

`/chat` is a two-browser WebRTC experiment that also serves as the networking foundation for future multiplayer games.

The current prototype intentionally uses no C00lG@mes+ application server, database, account system, matchmaking service, or persistent message history. Once connected, Chat messages travel directly between the two browsers over an encrypted WebRTC `RTCDataChannel`.

### Host flow

1. Open `/chat`.
2. Select **Create chat**.
3. Copy the generated invite link and send it to one friend.
4. Keep the original browser tab open.
5. Your friend opens the invite and returns an answer code.
6. Paste that answer code into the original tab and select **Connect**.
7. When the peer connection opens, both browsers can send real-time messages.

### Guest flow

1. Open the invite link from the host.
2. Select **Join chat**.
3. Copy the generated answer code and send it back to the host.
4. Keep the tab open while the host applies the answer.
5. When the connection opens, Chat becomes available automatically.

### How signaling works

The prototype uses manual, non-trickle WebRTC signaling:

- The host's complete WebRTC offer is encoded into the invite URL fragment (`#offer=...`).
- The guest creates a complete WebRTC answer and returns it as a copyable code.
- Each browser waits for ICE gathering to finish before sharing its session description.
- The invite fragment deliberately remains in the guest URL so refreshing or reopening the invite can recover the same offer and return to the Join flow.
- Selecting **Restart chat** clears the invite fragment and returns to a fresh `/chat` session.

This lets us prove the browser-to-browser transport without introducing a signaling backend yet.

### Current networking limits

The peer connection uses public STUN discovery but intentionally does not use a TURN relay in this first version. Most ordinary home/mobile network combinations should be testable, but restrictive corporate networks, carrier networks, or certain NAT combinations may fail to establish a direct connection.

A failed direct connection should be treated as connectivity evidence for a future TURN/signaling decision, not as a reason to move game traffic to a conventional application server prematurely.

The invite URL is durable across a guest page refresh, but an active WebRTC connection is not: refreshing either browser destroys that browser's in-memory `RTCPeerConnection` and message history. A refreshed guest can recover the invite and create a fresh answer; the peers must negotiate a new connection. Full connected-session/message persistence would require additional state/signaling beyond the invite URL.

## Multiplayer direction

The WebRTC implementation is separated from the Chat protocol and React UI under `src/networking/webrtc`. Future Warrior multiplayer can reuse `PeerSession` while defining a game-specific wire protocol for player input, authoritative snapshots, and game events.

The likely first multiplayer model is host-authoritative: one browser owns canonical game state while the other sends inputs. Matchmaking, TURN, persistence, anti-cheat, and larger player counts remain separate follow-on decisions.

## Deployment

The site is deployed on Vercel. `vercel.json` rewrites fresh client-side routes to `index.html`, so invite URLs such as `/chat#offer=...` can be opened directly rather than only through in-app navigation.
