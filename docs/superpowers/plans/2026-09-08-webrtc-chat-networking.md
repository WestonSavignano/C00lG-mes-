# WebRTC Chat Networking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Soundboard surface with a two-browser WebRTC chat prototype whose transport can later be reused by Warrior multiplayer.

**Architecture:** Keep WebRTC negotiation and data-channel lifecycle inside a React-independent `PeerSession`. Keep signaling serialization and Chat protocol parsing in pure modules with versioned validation. `ChatPage` owns only UI/session orchestration; routing exposes `/chat` and redirects legacy Soundboard URLs.

**Tech Stack:** React 19, TypeScript 6, React Router 7, browser WebRTC APIs, Vitest, Testing Library, GitHub Actions, Vite/Vercel.

**Spec:** `docs/superpowers/specs/2026-09-08-webrtc-chat-networking-design.md`

## Global Constraints

- Exactly two peers in the MVP.
- No C00lG@mes+ application server, ECS service, RDS/database, accounts, persistence, matchmaking, or TURN relay.
- WebRTC `RTCDataChannel` carries realtime application messages peer-to-peer.
- Manual non-trickle offer/answer signaling is required for the first version.
- Generic WebRTC transport must not depend on React or Chat semantics.
- Signaling and Chat protocols are versioned and validate untrusted input.
- `/chat` is canonical; legacy `/soundboard` routes remain compatible via redirect.
- Fresh `/chat` navigation must work on Vercel.
- Message size and in-memory history are bounded.

---

### Task 1: Add PR validation and signaling codec

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `src/networking/webrtc/signalingCodec.test.ts`
- Create: `src/networking/webrtc/signalingCodec.ts`
- Create: `src/networking/webrtc/types.ts`

**Interfaces:**
- Produces: `encodeSignal(description: RTCSessionDescriptionInit): string`
- Produces: `decodeSignal(encoded: string, expectedType: 'offer' | 'answer'): RTCSessionDescriptionInit`
- Produces: `SignalingPayloadV1` and `PeerConnectionState` types.

- [ ] **Step 1: Add PR CI plus failing codec tests** covering offer/answer round trips, URL-safe output, invalid encoded data, unsupported versions, and unexpected SDP type.
- [ ] **Step 2: Push the test-only commit and verify GitHub Actions fails because `signalingCodec` is missing.**
- [ ] **Step 3: Implement a versioned JSON payload encoded with browser-safe base64url helpers; validate version, type, and non-empty SDP.**
- [ ] **Step 4: Verify PR CI test/lint/build succeeds for this task.**
- [ ] **Step 5: Commit with `feat: add WebRTC signaling codec`.**

### Task 2: Implement the reusable PeerSession transport

**Files:**
- Create: `src/networking/webrtc/PeerSession.test.ts`
- Create: `src/networking/webrtc/PeerSession.ts`

**Interfaces:**
- Consumes: signaling session descriptions from Task 1.
- Produces: `class PeerSession` with `createOffer()`, `acceptOffer(offer)`, `applyAnswer(answer)`, `send(data)`, `close()`, `onMessage(handler)`, and `onStateChange(handler)`.
- Constructor accepts an injectable `PeerConnectionFactory` for tests and defaults to browser `RTCPeerConnection` with a STUN configuration.

- [ ] **Step 1: Write failing tests with a focused fake peer connection/data channel** for host offer creation, guest answer creation, answer application, send/receive, state changes, ICE gathering completion, and cleanup.
- [ ] **Step 2: Push the test-only commit and verify CI fails because `PeerSession` is missing.**
- [ ] **Step 3: Implement the minimal transport with non-trickle ICE, reliable ordered data channel, message forwarding, connection-state mapping, and cleanup.**
- [ ] **Step 4: Verify CI test/lint/build succeeds.**
- [ ] **Step 5: Commit with `feat: add reusable WebRTC peer session`.**

### Task 3: Add a strict Chat wire protocol

**Files:**
- Create: `src/chat/chatProtocol.test.ts`
- Create: `src/chat/chatProtocol.ts`

**Interfaces:**
- Produces: `ChatMessage`.
- Produces: `createChatMessage(text: string): ChatMessage`.
- Produces: `serializeChatMessage(message: ChatMessage): string`.
- Produces: `parseChatMessage(serialized: string): ChatMessage | null`.
- Export limits `MAX_CHAT_MESSAGE_LENGTH` and `MAX_CHAT_HISTORY`.

- [ ] **Step 1: Write failing tests** for valid serialization, invalid JSON/version/type rejection, blank/oversized text rejection, and deterministic field validation.
- [ ] **Step 2: Push the test-only commit and verify CI fails because the protocol module is missing.**
- [ ] **Step 3: Implement the version-1 `chat.message` envelope using `crypto.randomUUID()` and ISO timestamps while enforcing message length.**
- [ ] **Step 4: Verify CI test/lint/build succeeds.**
- [ ] **Step 5: Commit with `feat: add peer chat protocol`.**

### Task 4: Replace Soundboard with the Chat experience

**Files:**
- Create: `src/pages/ChatPage.test.tsx`
- Create: `src/pages/ChatPage.tsx`
- Create: `src/pages/ChatPage.css`
- Modify: `src/App.tsx`
- Modify: `src/components/HeaderNav.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `PeerSession`, signaling codec, and Chat protocol.
- Produces: canonical `/chat` page with host, guest, connecting, connected, failed, and restart states.

- [ ] **Step 1: Add failing router/component tests** proving navigation says Chat, `/chat` renders Create chat, offer fragments render Join chat, legacy Soundboard routes redirect, and connected mocked sessions send/receive messages.
- [ ] **Step 2: Push the test-only commit and verify CI fails against the old Soundboard UI.**
- [ ] **Step 3: Implement `ChatPage` with an injectable session factory seam for tests, host invite URL creation, guest answer generation, host answer application, copy controls, bounded ephemeral message history, and cleanup on unmount.**
- [ ] **Step 4: Update navigation/home copy and route redirects. Add accessible responsive styling consistent with existing site primitives.**
- [ ] **Step 5: Verify CI test/lint/build succeeds.**
- [ ] **Step 6: Commit with `feat: replace soundboard with peer chat`.**

### Task 5: Support fresh Vercel Chat routes

**Files:**
- Create: `vercel.json`
- Modify: `README.md`

**Interfaces:**
- Produces: SPA fallback for direct `/chat` navigation without changing client-side routing.

- [ ] **Step 1: Add a static configuration assertion/documentation check in the existing route test or a focused config test so missing SPA fallback is detectable.**
- [ ] **Step 2: Verify the test fails before `vercel.json` exists.**
- [ ] **Step 3: Add the Vercel rewrite to `/index.html` and document the zero-backend WebRTC chat handshake in README.**
- [ ] **Step 4: Verify CI test/lint/build succeeds.**
- [ ] **Step 5: Commit with `chore: support direct chat navigation`.**

### Task 6: Final verification and PR readiness

**Files:**
- Review all changed files in PR #1.

- [ ] **Step 1: Run/observe fresh CI for the final head SHA: `npm test`, `npm run lint`, and `npm run build` must all exit successfully.**
- [ ] **Step 2: Review the complete PR diff for accidental Soundboard remnants, React/WebRTC coupling, unbounded state, secrets, or unrelated changes.**
- [ ] **Step 3: Verify every acceptance criterion in the approved spec maps to code/tests; explicitly call out the physical-device/Vercel peer handshake as manual acceptance testing if it cannot be executed from this environment.**
- [ ] **Step 4: Update the PR description from design-only to implementation-ready with verification evidence and remaining manual test notes.**
