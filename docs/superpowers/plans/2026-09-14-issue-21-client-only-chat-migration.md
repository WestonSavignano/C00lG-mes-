# Issue #21 Client-Only Chat Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while implementing meaningful behavior and superpowers:executing-plans to execute this plan. Keep all work on the focused Issue #21 branch and do not merge without explicit authorization.

**Goal:** Replace production Chat's Vercel/Upstash coordinator with the browser-hosted authoritative party architecture approved by Issue #20 while preserving simple player-facing Chat, durable host/member identity, moderation, reconnect/recovery, lock/removal, and fail-closed authority guarantees.

**Architecture:** One active browser host owns canonical party/Chat state in IndexedDB under an exclusive Web Lock. Up to seven passive guests discover the host through the explicit `@trystero-p2p/nostr` strategy and exchange application traffic over a host-star WebRTC topology. The party/control layer performs host proof, admission/resume authentication, canonical sequencing, persistence-before-publication, replay/snapshot recovery, and transport rebinding. Chat remains responsible for Chat semantics/moderation/rate policy; future game real-time replication stays outside this Issue.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, IndexedDB, Web Crypto ECDSA P-256/SHA-256, Web Locks, WebRTC, `@trystero-p2p/nostr@0.25.4`.

**Spec:** `docs/superpowers/specs/2026-09-14-client-only-host-authoritative-networking-design.md`

## Material implementation constraints

- Trystero `0.25.4` is the current stable Nostr package baseline as of 2026-09-14. Upstream issue #195 remains open and `room.leave()` can reject while sending on a closed data channel before Trystero clears its occupied-room registry. Production lifecycle handling must be isolated in the transport adapter and covered by adapter tests; Chat/authority code must not depend on Trystero internals.
- The #19 POC proves important semantics but is not production state: it has a 24-event history bound, localStorage guest state, no ECDSA host proof, no separate admission capability lifecycle, and no Web Lock single-writer guard. Reuse semantics, not POC constants/identity shortcuts.
- Host canonical state is authoritative only if durable IndexedDB persistence succeeds. Never reconstruct host state from guests.
- No TURN, owned signaling/backend fallback, host election/migration, accounts, matchmaking, AWS hosting work, or game-frame replication belongs in #21.
- Public Nostr relays and STUN remain external infrastructure; the result is client-only application authority, not zero infrastructure.

---

### Task 1: Define production party identity, invite, crypto, and wire contracts

**Files:**
- Create: `src/networking/party/partyTypes.ts`
- Create: `src/networking/party/partyRoutes.ts`
- Create: `src/networking/party/partyCrypto.ts`
- Create: `src/networking/party/partyProtocol.ts`
- Create tests beside each production module.

- [ ] Write failing tests for v2 host/guest fragment parsing/building, sensitive-fragment scrubbing, identity separation, and invalid/missing capability rejection.
- [ ] Implement host routes containing only party + host role and guest invites containing party, rendezvous capability, admission capability, and host fingerprint.
- [ ] Write failing tests for non-extractable P-256 host key generation, stable SHA-256 host fingerprint, challenge signing/verification, credential-verifier derivation, and secret-safe serialization.
- [ ] Implement Web Crypto helpers without logging or exporting private key material.
- [ ] Write failing tests for bounded/versioned hello, host-proof challenge/response, admission/resume, authenticated, intent, canonical-event, delta/snapshot, rejection, supersession, and removal wire messages.
- [ ] Implement strict parse/serialize validation with bounded remote payloads and explicit protocol generation/incarnation checks.

### Task 2: Build fail-closed durable authority and guest storage

**Files:**
- Create: `src/networking/party/hostPartyStore.ts`
- Create: `src/networking/party/guestPartyStore.ts`
- Create: `src/networking/party/hostPartyLock.ts`
- Create tests beside each production module.

- [ ] Write failing tests for the durable host schema: party/incarnation, host key/public identity, rendezvous/admission state, canonical sequence, lock state, member/tombstone/verifier/request cursor state, and bounded Chat history.
- [ ] Implement IndexedDB host storage that preserves a non-extractable `CryptoKey`, validates schema/protocol/version on restore, and fails closed on missing/corrupt/incompatible authority.
- [ ] Write failing tests for guest-local host pin, credentials, canonical cursor, transport-attempt metadata, and optional bounded replica/cache restore/discard behavior.
- [ ] Implement guest IndexedDB state; stale/gapped/corrupt replicas are discardable and never authoritative.
- [ ] Write failing tests for single-host-writer acquisition, second-tab rejection, and unsupported Web Locks behavior.
- [ ] Implement an exclusive `coolgamesplus:party-host:<partyId>` Web Lock guard with no localStorage lease fallback.

### Task 3: Implement the host-authoritative party/control state machine

**Files:**
- Create: `src/networking/party/hostPartyAuthority.ts`
- Create: `src/networking/party/guestPartyReplica.ts`
- Create: `src/chat/chatRateLimiter.ts`
- Update: `src/chat/roomChatProtocol.ts` only where the production party protocol needs Chat-specific intent/canonical helpers.
- Add/modify focused tests.

- [ ] Write failing tests proving admission credentials are rejected before host proof, admission capability creates members only while admission is open, existing member credentials reconnect while locked, lock persists before acknowledgement and invalidates admission, and unlock mints a new admission capability without rotating rendezvous.
- [ ] Implement admission/resume authentication against stored verifiers with constant-time-style byte comparison where practical and stable canonical member identity independent of transport identity.
- [ ] Write failing tests for one-current-transport-per-member, stale transport rejection, reconnect supersession, request replay/duplicate/gap handling, and canonical sender assignment by host authority.
- [ ] Implement serialized host mutation processing: authenticate -> validate -> canonicalize -> allocate sequence -> persist -> advance memory -> broadcast.
- [ ] Write failing tests for 1,000-character Chat bound, 8 KiB serialized Chat bound, 200-message history bound, moderation, and bounded per-member Chat/control rate rejection without automatic removal.
- [ ] Implement Chat policy/rate limiting without moving game simulation into the shared party layer.
- [ ] Write failing tests for delta recovery, snapshot fallback, stale/gapped guest cache replacement, host restore, removed-member persistence, and storage-write failure producing no authoritative in-memory advance/broadcast.
- [ ] Implement recovery and replica application from host authority only.

### Task 4: Add the production Trystero/Nostr transport adapter

**Files:**
- Create: `src/networking/party/trysteroNostrTransport.ts`
- Create: `src/networking/party/trysteroNostrTypes.ts`
- Create tests with a narrow fake Trystero module/room boundary.
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Add exact production dependency `@trystero-p2p/nostr@0.25.4` through the normal build dependency graph.
- [ ] Write failing tests proving host uses active mode, guests use passive mode, rendezvous capability is the Trystero password, no TURN is configured, one guest targets only the host, and library diagnostics never become authority.
- [ ] Implement lazy dynamic import of the explicit Nostr package from the `/chat` runtime only.
- [ ] Write failing lifecycle tests for dispose/rejoin, closed/stale data channels, duplicate start attempts, stale transport attempts, offline/online retry, and superseded generations.
- [ ] Implement a narrow lifecycle wrapper that proactively closes stale peer connections, avoids overlapping room generations, waits for peer cleanup before `leave()`, and treats a failed cleanup as a poisoned in-page transport generation rather than silently creating competing authority. Preserve identity/state and surface a recoverable reload-required/fresh-page failure if the upstream occupied-room bug cannot be safely cleared through public APIs.
- [ ] Keep Trystero-specific behavior entirely behind the adapter.

### Task 5: Compose production host/guest sessions and migrate `/chat`

**Files:**
- Create: `src/networking/party/PartySession.ts`
- Create: `src/networking/party/createPartySession.ts`
- Create tests for host/guest session orchestration.
- Modify: `src/pages/ChatPage.tsx`
- Modify: `src/pages/ChatPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/ChatPage.css` only if status/UX changes require it.

- [ ] Write failing orchestration tests for create/start, new guest invite join, host-proof-before-secret, automatic member resume, host/guest reload restore, simultaneous reconnect generation handling, lock/unlock, remove, delta/snapshot sync, and host-unavailable states.
- [ ] Implement `PartySession` as the React-facing coarse-event facade so network chatter does not become frame-by-frame React state.
- [ ] Write failing UI tests for Start Chat, copy/share invite, fragment scrub after guest admission, Waiting/Finding host/Reconnecting/Removed/error states, host lock/unlock, member removal, bounded history rendering, and no coordinator calls.
- [ ] Migrate ChatPage to the client-only session facade while preserving moderation and simple player language.
- [ ] Lazy-load ChatPage/networking from `App.tsx` so unrelated arcade/game routes do not pay Trystero startup cost.
- [ ] Update the privacy/infrastructure note to accurately say Chat uses public Nostr rendezvous/STUN plus direct WebRTC and no C00lG@mes+-owned dynamic application backend.

### Task 6: Retire coordinator/server runtime and reconcile configuration/docs

**Files:**
- Delete: `src/networking/room/`
- Delete: `src/networking/webrtc/` if no production/POC consumer remains after migration; otherwise retain only genuinely used non-coordinator code.
- Delete: `api/chat/`
- Delete: `server/chat/`
- Delete/update coordinator-only tests/configuration.
- Modify: `vercel.json`
- Modify: `src/vercelConfig.test.ts`
- Remove: `tsconfig.api.json` if no longer referenced.
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `AGENTS.md` only if current-vs-target wording becomes stale after #21 lands.

- [ ] Write/adjust a failing configuration/reference test proving production source/config contains no `/api/chat`, Upstash runtime dependency, Vercel Function requirement, coordinator polling, or coordinator secret expectation.
- [ ] Remove coordinator production code only after the new path is wired and covered.
- [ ] Preserve static SPA routing on Vercel previews without reserving Chat Functions.
- [ ] Update docs from “approved target” to actual #21 production architecture while keeping Nostr/STUN external-infrastructure and no-TURN/restrictive-network caveats explicit.
- [ ] Search the complete branch for `api/chat`, `UPSTASH`, `RoomClient`, `RoomPeerManager`, coordinator fetch/poll paths, and secret logging. Resolve all production references; historical superseded design docs may remain as labeled history.

### Task 7: Validate, audit, and open the focused PR

**Files:**
- Review all changed files against `main`.
- PR only; do not merge.

- [ ] Run/confirm branch CI for `npm test`, `npm run lint`, and `npm run build`; do not claim success until the GitHub Actions run for the final branch head is green.
- [ ] Audit the final diff for Issue #21 scope only: no AWS/DNS, TURN, accounts/matchmaking, game-netcode framework, host migration/election, or unrelated game work.
- [ ] Verify build output keeps Trystero/party networking out of unrelated initial routes through lazy chunking.
- [ ] Perform only manual/browser/network validation actually available from the execution environment and record gaps honestly. Required follow-up evidence includes desktop Chromium, Safari/iOS, Chrome/Android, Firefox baseline, multiple guests, reload/reconnect/network transitions/sleep, relay degradation/restrictive networks, and network inspection showing no C00lG@mes+ dynamic backend Chat traffic.
- [ ] Open one focused PR against `main` with `Closes #21`, implementation summary, CI evidence, exact manual coverage, untested gaps, performance impact, and explicit Trystero #195/no-TURN risk notes.
- [ ] Request review only after final CI is green. Do not merge.
