# Durable WebRTC Chat Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual two-browser SDP exchange with durable small-group Chat rooms that automatically rebuild disposable WebRTC connections after refresh, add host membership controls, and mask configured words/phrases without storing moderation vocabulary in the public repo.

**Architecture:** A small Vercel room coordinator stores durable room/member state and short-lived signaling state in Upstash Redis. Browsers use host-star WebRTC data channels for all Chat traffic; Vercel/Redis never relay or persist Chat messages. Room/member identity survives refresh, while every page instance creates fresh connection generations and WebRTC sessions. Moderation is compiled from an optional server-side `CHAT_MODERATION_TERMS` variable into hashed client lookup data and runs only on message send/relay/render.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, WebRTC `RTCDataChannel`, Vercel Functions, Upstash Redis REST SDK, browser `localStorage`.

**Spec:** `docs/superpowers/specs/2026-09-08-webrtc-chat-networking-design.md`

## Global Constraints

- Room identity is durable; WebRTC connections are disposable and rebuilt automatically after refresh.
- Chat history remains ephemeral and may clear on refresh.
- Host-star topology; cap rooms at **8 total members** in v1.
- `CHAT_MODERATION_TERMS` is optional, comma-separated, mask-only, and must be a safe no-op when absent/empty.
- No actual moderation vocabulary may be committed to source or tests.
- Chat messages must never pass through or be stored by Vercel/Redis coordinator APIs.
- Use STUN without TURN in this iteration.
- Keep moderation off the keystroke path and avoid heavyweight client dependencies.
- Keep Redis code server-only; no Redis SDK code may enter the browser bundle.
- Keep PR history clean: RED tests are run locally/in the execution environment but intentional failing checkpoints are not pushed to GitHub.
- **Start Chat** navigates the current tab to the durable host URL; it does not open a new tab.

---

## File Structure

Create or modify these focused units:

- `src/networking/room/roomProtocol.ts` — shared versioned request/response/domain types and validation limits.
- `api/chat/roomService.ts` — credential hashing, authorization, room lifecycle, admission, control, signaling rules.
- `api/chat/roomStore.ts` — server-only `RoomStore` interface.
- `api/chat/inMemoryRoomStore.ts` — deterministic test implementation.
- `api/chat/upstashRoomStore.ts` — production Upstash Redis implementation.
- `api/chat/http.ts` — bounded JSON parsing and consistent JSON responses for Vercel Functions.
- `api/chat/create.ts`, `join.ts`, `state.ts`, `control.ts`, `signal.ts` — thin Vercel Function endpoints.
- `src/networking/room/memberStorage.ts` — room-scoped guest member credential persistence.
- `src/networking/room/RoomClient.ts` — browser coordinator client and adaptive polling.
- `src/networking/room/RoomPeerManager.ts` — host-star map of disposable `PeerSession`s and reconnect generations.
- `src/chat/roomChatProtocol.ts` — canonical host-relayed room Chat envelopes.
- `src/chat/RoomChatController.ts` — host relay / guest send behavior independent of React.
- `src/moderation/moderationCore.ts` — token normalization, hashing, span masking.
- `src/moderation/buildModerationConfig.ts` — build-only parsing/hash generation from `CHAT_MODERATION_TERMS`.
- `src/moderation/moderationConfig.ts` + `.d.ts` — browser access to injected hash config.
- `src/pages/ChatPage.tsx` / `ChatPage.css` — room-oriented host/guest UI.
- `vite.config.ts` — build-time moderation injection.
- `tsconfig.api.json`, `tsconfig.json`, `tsconfig.node.json` — typecheck Vercel API/build helpers without bundling them into the app.
- `vercel.json` — preserve `/api/*` Functions while retaining SPA fallback.
- `README.md` — room flow, Upstash/Vercel environment setup, moderation configuration, refresh semantics.

---

### Task 1: Define the Room Protocol and Server Build Boundary

**Files:**
- Create: `src/networking/room/roomProtocol.ts`
- Create: `src/networking/room/roomProtocol.test.ts`
- Create: `tsconfig.api.json`
- Modify: `tsconfig.json`
- Modify: `tsconfig.node.json`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `ROOM_PROTOCOL_VERSION`, `MAX_ROOM_MEMBERS`, `MAX_SIGNAL_SDP_LENGTH`, `RoomMemberView`, `RoomState`, `CreateRoomResult`, `JoinRoomResult`, `RoomAuth`, `ConnectionSignal`.
- Later tasks import these types but do not duplicate protocol literals.

- [ ] **Step 1: Write protocol validation tests**

Create harmless tests that prove IDs, generations, SDP sizes, protocol versions, and the 8-member constant are bounded. The public helper surface should be:

```ts
export const ROOM_PROTOCOL_VERSION = 1 as const
export const MAX_ROOM_MEMBERS = 8
export const MAX_SIGNAL_SDP_LENGTH = 32_768

export type RoomRole = 'host' | 'guest'

export type RoomMemberView = {
  memberId: string
  label: string
  present: boolean
  removed: boolean
  connectionGeneration: string | null
}

export type RoomState = {
  version: typeof ROOM_PROTOCOL_VERSION
  roomId: string
  locked: boolean
  members: RoomMemberView[]
  revision: number
}

export type CreateRoomResult = {
  version: typeof ROOM_PROTOCOL_VERSION
  roomId: string
  hostSecret: string
  inviteSecret: string
}

export type JoinRoomResult = {
  version: typeof ROOM_PROTOCOL_VERSION
  roomId: string
  memberId: string
  memberSecret: string
  label: string
  resumed: boolean
}

export type RoomAuth =
  | { role: 'host'; roomId: string; hostSecret: string }
  | { role: 'guest'; roomId: string; memberId: string; memberSecret: string }

export type ConnectionSignal = {
  version: typeof ROOM_PROTOCOL_VERSION
  roomId: string
  memberId: string
  generation: string
  kind: 'offer' | 'answer'
  description: RTCSessionDescriptionInit
}
```

`roomProtocol.ts` must also export small validators for untrusted API payload primitives (`isRoomId`, `isSecret`, `isGeneration`, `isSignalDescription`) with explicit max lengths.

- [ ] **Step 2: Run the protocol test locally and confirm RED**

Run:

```bash
npm test -- src/networking/room/roomProtocol.test.ts
```

Expected before implementation: FAIL because `roomProtocol.ts` does not exist. Do not push this failing state.

- [ ] **Step 3: Implement the shared protocol constants/types/validators**

Use only pure TypeScript; no React, Redis, WebRTC construction, or browser storage in this file.

- [ ] **Step 4: Add the server TypeScript boundary and Upstash dependency**

Add `@upstash/redis` as the only new runtime dependency for room storage. Add `tsconfig.api.json` with `ES2023` + `DOM` libs so Vercel's standard Web `Request`/`Response` APIs typecheck, and include only `api/**/*.ts` plus the shared protocol files they import. Reference it from root `tsconfig.json`. Extend `tsconfig.node.json` later only for build-time moderation helpers.

- [ ] **Step 5: Run focused and repository gates**

```bash
npm test -- src/networking/room/roomProtocol.test.ts
npm run build
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit the green protocol boundary**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.api.json tsconfig.node.json src/networking/room
 git commit -m "feat: define durable chat room protocol"
```

---

### Task 2: Implement Room Lifecycle and Authorization Against an In-Memory Store

**Files:**
- Create: `api/chat/roomStore.ts`
- Create: `api/chat/inMemoryRoomStore.ts`
- Create: `api/chat/roomService.ts`
- Create: `api/chat/roomService.test.ts`

**Interfaces:**
- Consumes: room protocol types/constants from Task 1.
- Produces:

```ts
export interface RoomStore {
  createRoom(record: StoredRoom): Promise<void>
  getRoom(roomId: string): Promise<StoredRoom | null>
  saveRoom(room: StoredRoom): Promise<void>
  putSignal(signal: StoredSignal, ttlSeconds: number): Promise<void>
  getSignal(key: SignalKey): Promise<StoredSignal | null>
  deleteSignal(key: SignalKey): Promise<void>
}

export class RoomService {
  constructor(store: RoomStore, clock?: () => number)
  createRoom(): Promise<CreateRoomResult>
  join(input: JoinInput): Promise<JoinRoomResult>
  getState(auth: RoomAuth): Promise<RoomState>
  setLocked(hostAuth: HostAuth, locked: boolean): Promise<RoomState>
  removeMember(hostAuth: HostAuth, memberId: string): Promise<RoomState>
  announceGeneration(guestAuth: GuestAuth, generation: string): Promise<void>
  publishOffer(hostAuth: HostAuth, signal: ConnectionSignal): Promise<void>
  publishAnswer(guestAuth: GuestAuth, signal: ConnectionSignal): Promise<void>
  readSignal(auth: RoomAuth, memberId: string, generation: string, kind: 'offer' | 'answer'): Promise<ConnectionSignal | null>
}
```

`StoredRoom` contains hashed secrets, lock state, revision, member records, activity timestamps, and next guest label. It never stores Chat messages.

- [ ] **Step 1: Write lifecycle/security tests**

Cover create, join, resume, invalid credentials, removed credentials, locked admission, 8-member cap, host remove, host lock/unlock, 7-day inactivity expiry, fresh connection generations, stale signal rejection, and 120-second signal TTL. Use injected fake time.

Example critical tests:

```ts
it('allows an existing member to resume while the room is locked', async () => {
  const created = await service.createRoom()
  const first = await service.join({ roomId: created.roomId, inviteSecret: created.inviteSecret })
  await service.setLocked({ role: 'host', roomId: created.roomId, hostSecret: created.hostSecret }, true)

  const resumed = await service.join({
    roomId: created.roomId,
    member: { memberId: first.memberId, memberSecret: first.memberSecret },
  })

  expect(resumed.resumed).toBe(true)
  expect(resumed.memberId).toBe(first.memberId)
})

it('does not convert removed credentials into a new invite join', async () => {
  // create -> join -> remove -> retry with the removed member credentials
  // expect a typed `member_removed` error, not a new member
})
```

- [ ] **Step 2: Run the service test locally and confirm RED**

```bash
npm test -- api/chat/roomService.test.ts
```

Expected before implementation: FAIL. Do not push RED.

- [ ] **Step 3: Implement credential generation/hashing and constant-time verification**

Use Node's built-in crypto only:

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

function newSecret(bytes = 24) {
  return randomBytes(bytes).toString('base64url')
}

function hashSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex')
}

function hashesEqual(left: string, right: string) {
  const a = Buffer.from(left, 'hex')
  const b = Buffer.from(right, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
```

Raw host/invite/member secrets must never be stored in `StoredRoom`.

- [ ] **Step 4: Implement the in-memory store and RoomService rules**

Keep room mutation rules in `RoomService`; the store only persists/retrieves state. Increment `revision` on membership/control/generation changes. A room older than 7 days since `lastActivityAt` behaves as not found. Signal records expire after 120 seconds and are keyed by room/member/generation/kind.

- [ ] **Step 5: Run focused and API typecheck gates**

```bash
npm test -- api/chat/roomService.test.ts
npx tsc -p tsconfig.api.json
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit the green room domain**

```bash
git add api/chat src/networking/room
 git commit -m "feat: add durable chat room lifecycle"
```

---

### Task 3: Add Upstash Storage and Thin Vercel Coordinator Functions

**Files:**
- Create: `api/chat/upstashRoomStore.ts`
- Create: `api/chat/upstashRoomStore.test.ts`
- Create: `api/chat/http.ts`
- Create: `api/chat/create.ts`
- Create: `api/chat/join.ts`
- Create: `api/chat/state.ts`
- Create: `api/chat/control.ts`
- Create: `api/chat/signal.ts`
- Create: `api/chat/routes.test.ts`
- Modify: `vercel.json`
- Modify: `src/vercelConfig.test.ts`

**Interfaces:**
- Consumes: `RoomStore`, `RoomService`, shared protocol.
- Production environment uses `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` via `Redis.fromEnv()`.
- Produces POST-only JSON coordinator endpoints under `/api/chat/*`; secrets never go in query strings.

- [ ] **Step 1: Write adapter contract tests and route tests**

The Upstash adapter test uses a fake Redis command surface, not a live database. Prove the room durable state uses one room hash/key namespace with a 7-day TTL and signaling keys get a 120-second TTL. Route tests inject an in-memory service and verify status codes/body bounds.

`http.ts` should expose:

```ts
export async function readJson<T>(request: Request, maxBytes: number): Promise<T>
export function json(data: unknown, status?: number): Response
export function errorJson(code: string, message: string, status: number): Response
```

Reject request bodies above 64 KiB before parsing.

- [ ] **Step 2: Run focused tests locally and confirm RED**

```bash
npm test -- api/chat/upstashRoomStore.test.ts api/chat/routes.test.ts src/vercelConfig.test.ts
```

Expected before implementation: FAIL. Do not push RED.

- [ ] **Step 3: Implement the Upstash RoomStore**

Use `@upstash/redis` only in `api/`. Store all durable room/member fields under a room-scoped Redis hash so a single 7-day expiry controls the durable room. Store offers/answers in separate short-TTL keys. Encapsulate Redis key construction in this file.

Room mutation must be concurrency-safe. Implement compare-and-swap on `revision` (retry a bounded maximum of 3 times) or an atomic Lua mutation in the adapter; do not use unguarded read-modify-write for join/member-limit/lock/remove operations.

- [ ] **Step 4: Implement thin Vercel Functions using standard Web Request/Response**

Use the current Vercel Function shape:

```ts
export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'POST' } })
    }
    // bounded JSON parse -> RoomService call -> JSON response
  },
}
```

Map service errors to stable response codes such as `room_not_found`, `invalid_credentials`, `room_locked`, `room_full`, `member_removed`, `stale_generation`, and `coordinator_unavailable`.

- [ ] **Step 5: Fix SPA fallback so `/api/*` remains Functions**

Replace the single catch-all rewrite with a configuration that leaves `/api/*` untouched and only falls back application routes to `/index.html`. Extend `src/vercelConfig.test.ts` to assert both `/chat` SPA behavior and `/api/chat/create` function preservation.

- [ ] **Step 6: Run server/repository gates**

```bash
npm test -- api/chat/upstashRoomStore.test.ts api/chat/routes.test.ts src/vercelConfig.test.ts
npx tsc -p tsconfig.api.json
npm run build
npm run lint
```

Expected: PASS even when Upstash environment variables are absent; absence must fail at coordinator request time, not import/build time.

- [ ] **Step 7: Commit the green coordinator**

```bash
git add api/chat vercel.json src/vercelConfig.test.ts
 git commit -m "feat: add Vercel room coordinator"
```

---

### Task 4: Add Durable Guest Membership and Browser RoomClient

**Files:**
- Create: `src/networking/room/memberStorage.ts`
- Create: `src/networking/room/memberStorage.test.ts`
- Create: `src/networking/room/RoomClient.ts`
- Create: `src/networking/room/RoomClient.test.ts`

**Interfaces:**
- Consumes: coordinator HTTP endpoints and shared room protocol.
- Produces:

```ts
export type StoredMemberCredentials = {
  memberId: string
  memberSecret: string
}

export interface RoomCoordinatorClient {
  createRoom(): Promise<CreateRoomResult>
  joinOrResume(roomId: string, inviteSecret: string): Promise<JoinRoomResult>
  getState(auth: RoomAuth): Promise<RoomState>
  setLocked(auth: HostAuth, locked: boolean): Promise<RoomState>
  removeMember(auth: HostAuth, memberId: string): Promise<RoomState>
  announceGeneration(auth: GuestAuth, generation: string): Promise<void>
  publishSignal(auth: RoomAuth, signal: ConnectionSignal): Promise<void>
  getSignal(auth: RoomAuth, memberId: string, generation: string, kind: 'offer' | 'answer'): Promise<ConnectionSignal | null>
}
```

- [ ] **Step 1: Write storage/reconnect/client tests**

Use `localStorage` key `c00lgames.chat.member.<roomId>`. Prove malformed stored JSON is ignored/removed. Prove `joinOrResume` sends stored member credentials first, persists newly issued credentials, and surfaces `member_removed` instead of silently creating a new identity.

Test abortable polling with fake timers and mocked `fetch`; never allow overlapping poll requests.

- [ ] **Step 2: Run focused tests locally and confirm RED**

```bash
npm test -- src/networking/room/memberStorage.test.ts src/networking/room/RoomClient.test.ts
```

- [ ] **Step 3: Implement member storage**

No room invite/host secret is written to localStorage. Only guest member ID/secret is persisted. Host authority remains in the durable URL fragment.

- [ ] **Step 4: Implement RoomClient fetch methods and typed errors**

Use POST bodies for credentials. Apply an `AbortController` to every in-flight request. Expose `RoomClientError` with the server `code` so the UI can distinguish unavailable/removed/locked/full states.

- [ ] **Step 5: Implement adaptive non-overlapping polling helper**

Use `setTimeout` scheduled only after the prior request resolves. Initial constants:

```ts
export const ROOM_POLL_MS = {
  negotiating: 750,
  hostConnected: 1_500,
  guestConnected: 5_000,
  hidden: 10_000,
} as const
```

The poller chooses `hidden` when `document.hidden` is true and cancels on stop/unmount.

- [ ] **Step 6: Run focused and repository gates**

```bash
npm test -- src/networking/room/memberStorage.test.ts src/networking/room/RoomClient.test.ts
npm run build
npm run lint
```

- [ ] **Step 7: Commit the green browser coordinator client**

```bash
git add src/networking/room
 git commit -m "feat: add durable room browser client"
```

---

### Task 5: Build Host-Star RoomPeerManager and Automatic Reconnect

**Files:**
- Create: `src/networking/room/RoomPeerManager.ts`
- Create: `src/networking/room/RoomPeerManager.test.ts`
- Modify only if required: `src/networking/webrtc/PeerSession.ts`
- Modify only if required: `src/networking/webrtc/PeerSession.test.ts`

**Interfaces:**
- Consumes: `PeerSessionClient`, `RoomCoordinatorClient`, `RoomAuth`, `RoomState`.
- Produces:

```ts
export type RoomPeerEvent =
  | { type: 'peer-state'; memberId: string; state: PeerConnectionState }
  | { type: 'message'; memberId: string; data: string }
  | { type: 'room-state'; state: RoomState }
  | { type: 'removed' }
  | { type: 'error'; error: Error }

export interface RoomPeerManagerClient {
  startHost(auth: HostAuth): void
  startGuest(auth: GuestAuth): void
  sendToHost(data: string): void
  sendToMember(memberId: string, data: string): void
  broadcast(data: string, exceptMemberId?: string): void
  removePeer(memberId: string): void
  onEvent(handler: (event: RoomPeerEvent) => void): () => void
  close(): void
}
```

- [ ] **Step 1: Write mocked-PeerSession reconnect tests**

Cover: one peer per guest, multiple guests isolated, host offer publication, guest answer publication, host/guest refresh generations, stale generation ignored, removed guest closes only its peer, manager cleanup, and no duplicate offer for the same generation.

Critical race test:

```ts
it('replaces the old peer when the same member announces a fresh generation', async () => {
  // generation A creates peer A
  // room state changes to generation B
  // peer A is closed exactly once; peer B is created; stale A answer is ignored
})
```

- [ ] **Step 2: Run the manager test locally and confirm RED**

```bash
npm test -- src/networking/room/RoomPeerManager.test.ts
```

- [ ] **Step 3: Implement host mode**

Maintain `Map<memberId, { generation, session }>` and an in-flight offer map. When a non-removed member's generation changes, close the old session before creating the new one. Publish the complete non-trickle offer through `RoomClient`, poll for the matching answer, then apply only if the member/generation is still current.

- [ ] **Step 4: Implement guest mode**

On each page start, create a fresh cryptographically random generation, announce it, poll for the matching offer, accept it with a new `PeerSession`, publish the answer, and surface connection state. A refresh naturally creates a new manager/generation; no old WebRTC object is reused.

- [ ] **Step 5: Add any minimal PeerSession hooks required by the manager**

Do not move room concepts into `PeerSession`. If a hook is required, keep it transport-generic (for example, exposing whether the application data channel is open).

- [ ] **Step 6: Run focused and repository gates**

```bash
npm test -- src/networking/room/RoomPeerManager.test.ts src/networking/webrtc/PeerSession.test.ts
npm run build
npm run lint
```

- [ ] **Step 7: Commit the green reconnect layer**

```bash
git add src/networking/room src/networking/webrtc
 git commit -m "feat: add automatic WebRTC room reconnect"
```

---

### Task 6: Add Canonical Host-Relayed Room Chat

**Files:**
- Create: `src/chat/roomChatProtocol.ts`
- Create: `src/chat/roomChatProtocol.test.ts`
- Create: `src/chat/RoomChatController.ts`
- Create: `src/chat/RoomChatController.test.ts`
- Keep/modify as needed: `src/chat/chatProtocol.ts`

**Interfaces:**
- Consumes: `RoomPeerManagerClient`, current 1,000-character text limit.
- Produces a host-authoritative wire protocol in which guests cannot choose their visible sender identity.

```ts
export type RoomChatClientMessage = {
  version: 1
  type: 'chat.submit'
  id: string
  sentAt: string
  payload: { text: string }
}

export type RoomChatCanonicalMessage = {
  version: 1
  type: 'chat.message'
  id: string
  sentAt: string
  sender: { memberId: string; label: string }
  payload: { text: string }
}
```

- [ ] **Step 1: Write protocol/controller tests**

Prove a guest submission received on member connection `guest-2` is canonicalized with the coordinator label for `guest-2`, regardless of any spoofed fields in guest JSON. Prove host messages broadcast to all guests and guest messages broadcast to host UI + all other connected guests.

- [ ] **Step 2: Run focused tests locally and confirm RED**

```bash
npm test -- src/chat/roomChatProtocol.test.ts src/chat/RoomChatController.test.ts
```

- [ ] **Step 3: Implement bounded parse/serialize helpers**

Reuse the existing 1,000-character text contract and 8 KiB serialized envelope bound where possible. Canonical parsing must strip unknown fields rather than passing guest objects through unchanged.

- [ ] **Step 4: Implement RoomChatController**

The controller receives peer events, resolves sender labels from the current room roster, creates canonical messages, and broadcasts serialized canonical messages through the peer manager. It owns no React state and no coordinator polling.

- [ ] **Step 5: Run focused and repository gates**

```bash
npm test -- src/chat/roomChatProtocol.test.ts src/chat/RoomChatController.test.ts
npm run build
npm run lint
```

- [ ] **Step 6: Commit the green room Chat protocol**

```bash
git add src/chat
 git commit -m "feat: add host-relayed room chat protocol"
```

---

### Task 7: Add Env-Driven Hashed Moderation With Safe No-Op Behavior

**Files:**
- Create: `src/moderation/moderationCore.ts`
- Create: `src/moderation/moderationCore.test.ts`
- Create: `src/moderation/buildModerationConfig.ts`
- Create: `src/moderation/buildModerationConfig.test.ts`
- Create: `src/moderation/moderationConfig.ts`
- Create: `src/moderation/moderationConfig.d.ts`
- Modify: `vite.config.ts`
- Modify: `tsconfig.node.json`
- Modify: `src/chat/RoomChatController.ts`
- Modify: `src/chat/RoomChatController.test.ts`

**Interfaces:**
- Produces:

```ts
export type ModerationConfig = {
  hashesByTokenCount: Readonly<Record<string, readonly string[]>>
}

export function normalizeModerationToken(value: string): string
export function hashNormalizedModerationText(value: string): string
export function maskConfiguredTerms(text: string, config: ModerationConfig): string
export function buildModerationConfig(rawTerms: string | undefined): ModerationConfig
```

- [ ] **Step 1: Write harmless moderation tests**

Use stand-ins such as `spoiler` and `secret phrase`, never real profanity.

Required cases:

```ts
expect(buildModerationConfig(undefined)).toEqual({ hashesByTokenCount: {} })
expect(maskConfiguredTerms('normal message', { hashesByTokenCount: {} })).toBe('normal message')
```

Also cover trimming/deduplication, case normalization, punctuation between phrase tokens, preserving separators, phrase matching, and non-match text.

- [ ] **Step 2: Run moderation tests locally and confirm RED**

```bash
npm test -- src/moderation/moderationCore.test.ts src/moderation/buildModerationConfig.test.ts
```

- [ ] **Step 3: Implement normalization/hash/masking with indexed phrase lengths**

Tokenize once into `{ raw, normalized, start, end }` records. Build candidate windows only for token counts present in `hashesByTokenCount`; never scan every configured term. Mask only matched token spans so whitespace/punctuation remains readable.

Use a deterministic compact hash implemented identically at build and runtime. Include normalized string length in the encoded hash to reduce accidental collisions. Do not use fuzzy edit distance in v1.

- [ ] **Step 4: Inject only hashed configuration from Vite**

In `vite.config.ts`, read `process.env.CHAT_MODERATION_TERMS` (not `VITE_*`) and add:

```ts
define: {
  __CHAT_MODERATION_CONFIG__: JSON.stringify(
    buildModerationConfig(process.env.CHAT_MODERATION_TERMS),
  ),
},
```

`moderationConfig.d.ts` declares the injected constant. `moderationConfig.ts` exports it through a typed accessor. `buildModerationConfig(undefined)` must guarantee the production build succeeds with no env variable.

- [ ] **Step 5: Apply moderation on submit, host relay, and receive/render boundary**

`RoomChatController` masks guest text before host canonical broadcast and host-originated text before broadcast. The UI also masks canonical incoming text before rendering as defense-in-depth. Do not moderate on `onChange`/keystrokes.

- [ ] **Step 6: Run focused and repository gates with the env absent**

```bash
unset CHAT_MODERATION_TERMS
npm test -- src/moderation src/chat/RoomChatController.test.ts
npm run build
npm run lint
```

Expected: PASS; moderation no-op.

- [ ] **Step 7: Run a harmless configured build test**

```bash
CHAT_MODERATION_TERMS='spoiler,secret phrase' npm run build
```

Expected: PASS; no plaintext fixture should appear in committed source. If inspecting `dist` during execution, verify the configured plaintext strings are not intentionally emitted.

- [ ] **Step 8: Commit the green moderation layer**

```bash
git add src/moderation src/chat vite.config.ts tsconfig.node.json
 git commit -m "feat: add local hashed chat moderation"
```

---

### Task 8: Replace Manual ChatPage Ceremony With Durable Room UX and Host Controls

**Files:**
- Modify: `src/pages/ChatPage.tsx`
- Modify: `src/pages/ChatPage.css`
- Replace/update: `src/pages/ChatPage.test.tsx`
- Replace/update: `src/pages/ChatPage.restart.test.tsx`
- Replace/update: `src/pages/ChatPage.invitePersistence.test.tsx`
- Create: `src/pages/ChatPage.rooms.test.tsx`

**Interfaces:**
- Consumes: `RoomClient`, `RoomPeerManager`, `RoomChatController`, member storage, moderation accessor.
- URL fragments:

```text
Host:  /chat#room=<roomId>&host=<hostSecret>
Guest: /chat#room=<roomId>&invite=<inviteSecret>
```

- [ ] **Step 1: Write room UX component/router tests**

Cover:

- `/chat` renders **Start Chat**.
- Start Chat creates a room and navigates the current tab to the durable host fragment using router/location replacement.
- Room creation failure leaves `/chat` usable and shows a clear unavailable error.
- Host page shows only the guest invite as the copyable share URL.
- Guest invite automatically joins/resumes; there is no `Join chat` button or answer-code textarea.
- Refresh/remount with host URL restores host role and room.
- Refresh/remount with invite + localStorage resumes the same guest member.
- Host roster shows Guest labels and Remove buttons.
- Lock/Unlock controls call the coordinator and update admission state.
- Removed guest sees `Removed from room` and stops reconnecting.
- Reconnecting/waiting states are visible.
- Connected multi-user messages display authoritative sender labels.
- Message history remains bounded/ephemeral.

- [ ] **Step 2: Run the room page tests locally and confirm RED**

```bash
npm test -- src/pages/ChatPage.rooms.test.tsx src/pages/ChatPage.test.tsx
```

Do not push RED.

- [ ] **Step 3: Replace the manual offer/answer UI**

Delete the invite-SDP/answer-code state and handlers from `ChatPage`. Parse room role from `location.hash`. `/chat` without room credentials is the room-creation screen only.

On Start Chat:

```ts
const created = await roomClient.createRoom()
navigate(`/chat#room=${created.roomId}&host=${created.hostSecret}`, { replace: true })
```

After navigation, host initialization derives from the durable URL, not from the prior component's in-memory creation result.

- [ ] **Step 4: Implement host room UI**

Show: share URL, copy action, open/locked status, member roster/presence, Remove, Lock/Unlock, connection status, and message panel. Never label/copy the host URL as the invitation.

- [ ] **Step 5: Implement guest autojoin/resume UI**

Opening the invite immediately attempts stored-member resume or invite join. Show `Joining…`, `Waiting for host…`, `Reconnecting…`, `Connected`, `Room is locked`, `Room is full`, `Removed from room`, or coordinator unavailable states as appropriate.

- [ ] **Step 6: Wire controller lifecycle and cleanup**

Use generation guards/AbortController cleanup so stale async callbacks from a previous route/page instance cannot restore old state after Restart or unmount. Close the room peer manager and controller on cleanup.

- [ ] **Step 7: Run page and full repository gates**

```bash
npm test -- src/pages/ChatPage.rooms.test.tsx src/pages/ChatPage.test.tsx src/pages/ChatPage.restart.test.tsx src/pages/ChatPage.invitePersistence.test.tsx
npm test
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit the green room UX**

```bash
git add src/pages
 git commit -m "feat: replace manual signaling with durable chat rooms"
```

---

### Task 9: Documentation, Deployment Safety, and Manual Vercel Acceptance

**Files:**
- Modify: `README.md`
- Modify: PR #1 body after implementation verification

**Interfaces:**
- Documents required Vercel server env vars:

```text
UPSTASH_REDIS_REST_URL=<server-only Upstash REST URL>
UPSTASH_REDIS_REST_TOKEN=<server-only Upstash REST token>
CHAT_MODERATION_TERMS=<optional comma-separated words/phrases>
```

- [ ] **Step 1: Update README for the room model**

Document Start Chat current-tab navigation, separate host/share URLs, automatic guest join, refresh reconnect, host removal/lock behavior, 7-day inactivity expiry, ephemeral messages, STUN/no-TURN limitation, and that Redis carries signaling/membership only.

- [ ] **Step 2: Document graceful missing-env behavior**

State explicitly:

- Missing `CHAT_MODERATION_TERMS`: Chat works with no masking.
- Missing Upstash credentials: the site and games load; Chat room creation/join shows coordinator unavailable.

Do not put sample profanity values in README.

- [ ] **Step 3: Run final local verification before pushing the final implementation checkpoint**

```bash
npm test
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 4: Verify Vercel deployment before real room testing**

Confirm `/chat` fresh navigation works and `/api/chat/create` reaches a Function rather than `index.html`. Before Upstash is configured, confirm Chat fails gracefully without breaking the site. After Upstash is configured, confirm room creation succeeds.

- [ ] **Step 5: Run the approved multi-context acceptance scenario**

Use host + two guests:

1. Start Chat; current tab becomes durable host URL.
2. Open one share URL in Guest A and Guest B; both autojoin without returning codes.
3. Send messages from all three and verify sender labels and host-star relay.
4. Refresh Guest A; its message history may clear, but it resumes the same member and reconnects automatically.
5. Refresh host; guests wait and reconnect automatically without new invite URLs.
6. Remove Guest B; its connection closes and its existing member credential cannot resume.
7. Lock the room; Guest A can refresh/rejoin while a fresh browser cannot join.
8. Unlock; a fresh browser can join again.
9. Verify missing moderation env is a no-op; optionally set harmless preview-only terms to verify masking behavior.
10. Repeat host/guest on different physical networks and record whether TURN is needed.

- [ ] **Step 6: Update PR #1 summary/verification with the actual final SHA and Vercel result**

Remove stale references to the manual offer/answer design. Do not merge; leave the PR open for the user's local/manual acceptance unless explicitly asked to merge.

- [ ] **Step 7: Commit documentation**

```bash
git add README.md
 git commit -m "docs: document durable WebRTC chat rooms"
```

---

## Plan Self-Review

- Spec coverage: durable room identity, current-tab host navigation, reusable invite, automatic join, automatic refresh reconnect, host-star topology, 8-member cap, member removal, lock/unlock, 7-day inactivity, short-lived signaling, graceful Redis failure, optional moderation no-op, hashed build config, performance constraints, Vercel routing, STUN/no-TURN, and Warrior reuse are all assigned to explicit tasks.
- Placeholder scan: no implementation step is left as TBD/TODO; tests and public interfaces are named.
- Type consistency: `RoomAuth`, `RoomState`, `ConnectionSignal`, `RoomCoordinatorClient`, and `RoomPeerManagerClient` are introduced before consumers and reused consistently.
- Dependency boundary: `@upstash/redis` is the only new runtime dependency and remains under `api/`; browser modules depend only on `fetch`, WebRTC, and existing app packages.
- PR hygiene: RED is verified without pushing failing commits; each pushed task checkpoint is expected green.
