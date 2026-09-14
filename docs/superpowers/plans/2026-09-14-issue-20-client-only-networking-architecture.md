# Issue #20 Client-Only Networking Architecture Documentation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one durable, unambiguous production target architecture for browser-hosted authoritative parties and reconcile all repository source-of-truth documentation without changing runtime behavior.

**Architecture:** Adopt a browser-hosted authoritative listen-server model for Chat/private parties and near-term small casual/co-op multiplayer: one active authoritative host, passive guests, direct host-star WebRTC application traffic, Trystero/Nostr public rendezvous, host-local IndexedDB authority, guest-local credentials/cursors, and no C00lG@mes+-owned dynamic application backend. Preserve a strict boundary between the reliable party/control plane and game-owned real-time replication. Document the conventional dedicated-server/Colyseus alternative and explicit reversal triggers without building it now.

**Tech Stack:** Markdown documentation; existing React/TypeScript/Vite repository; Trystero/Nostr as the approved target rendezvous layer; browser WebRTC, IndexedDB, Web Crypto, and Web Locks as target browser primitives.

**Spec:** `docs/superpowers/specs/2026-09-14-client-only-host-authoritative-networking-design.md`

## Global Constraints

- This Issue is design/documentation only; do not change production Chat/networking behavior.
- Do not delete or modify `api/chat/`, `server/chat/`, or current coordinator runtime code in #20.
- Current production remains Vercel + Upstash until #21 lands; the approved target must not be documented as already implemented.
- #18 / PR #24 and #19 / PR #35 are both **PROCEED WITH CONSTRAINTS** and are the measured feasibility basis.
- Target party size remains one host plus at most seven guests.
- No TURN, owned signaling backend, cloud application state, accounts, matchmaking, host election/migration, CRDTs, or speculative multiplayer framework is added by #20.
- Public rendezvous/STUN are third-party infrastructure; never describe the target as “zero infrastructure.”
- Permanent host disappearance/storage loss ends the v1 party.
- Future games own their simulation and real-time replication semantics; shared party/control networking must not become a generic game engine.
- Do not merge the PR without explicit authorization.

---

### Task 1: Finalize the canonical target architecture spec

**Files:**
- Modify: `docs/superpowers/specs/2026-09-14-client-only-host-authoritative-networking-design.md`

**Interfaces:**
- Consumes: Issue #20, merged #18/#24 evidence, merged #19/#35 evidence, current external browser/Trystero facts.
- Produces: The architecture contract #21 follows without reopening major design decisions.

- [ ] **Step 1: Add the conventional-baseline decision framing**

Document that a dedicated authoritative WebSocket game server (with Colyseus as the first TypeScript framework to evaluate) is the conventional lower-risk general-purpose alternative, while C00lG@mes+ deliberately chooses browser-hosted authority for current small private casual/co-op requirements.

- [ ] **Step 2: Scope the architecture explicitly**

State that the browser-host model is approved for Chat, private parties, and near-term small casual/co-op multiplayer, not an irreversible mandate for every future ranked/persistent/public game.

- [ ] **Step 3: Add explicit reversal triggers**

Name the requirements that should cause a dedicated-server architecture review: platform-trusted outcomes, valuable persistent progression, ranked/high-stakes competition, public matchmaking, host-independent availability, larger rooms, or unacceptable direct-connect/mobile-host reliability.

- [ ] **Step 4: Separate traffic planes**

Define a reliable party/control plane for admission, membership, Chat, lock/removal, canonical durable events, replay protection, and recovery; define a game-owned real-time plane that may later use tick/input sequencing, unordered/partially reliable channels, prediction, interpolation, reconciliation, and game snapshots without persisting every frame.

- [ ] **Step 5: Verify all required Issue #20 decisions are explicit**

Check transport/rendezvous, topology, identity, invite/authentication, host persistence, guest replica, canonical protocol, single-writer safety, lifecycle semantics, TURN, privacy, future game boundary, and coordinator-responsibility ownership.

- [ ] **Step 6: Self-review the spec**

Search for `TBD`, `TODO`, contradictory target/current-state language, undefined authority, accidental POC constants, and statements that overclaim universal browser/network reliability. Fix any result before proceeding.

### Task 2: Supersede the September 8 coordinator design without erasing history

**Files:**
- Modify: `docs/superpowers/specs/2026-09-08-webrtc-chat-networking-design.md`

**Interfaces:**
- Consumes: New canonical #20 spec.
- Produces: A clear historical/current-runtime reference that cannot be mistaken for the approved future architecture.

- [ ] **Step 1: Add a supersession notice at the top**

State that the Vercel + Redis coordinator design describes the current implementation lineage until #21 but is superseded as the future architecture by the September 14 #20 spec.

- [ ] **Step 2: Preserve historical content**

Do not rewrite the old implementation history into the new design or falsely imply the coordinator was never intentional.

### Task 3: Reconcile README and AGENTS source-of-truth boundaries

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: New #20 spec and current production coordinator behavior.
- Produces: Accurate reader/agent guidance that distinguishes current runtime from approved target.

- [ ] **Step 1: Update README networking section**

Keep the current Vercel/Upstash production implementation factual, then add an approved-target section linking #20 and stating that #21 will replace it with browser-hosted authority. Do not describe target URLs/storage/Trystero behavior as live production yet.

- [ ] **Step 2: Update README multiplayer direction**

Describe the browser listen-server model, direct host-star traffic, host-local authority, no owned dynamic backend target, lifecycle/TURN constraints, and the party/control versus game-realtime boundary.

- [ ] **Step 3: Update AGENTS networking/security rules**

Replace “preserve current coordinator direction” assumptions with explicit current-vs-target guidance. Require remote-client distrust, application identity separate from transport identity, host-authoritative canonicalization, single-writer host authority, fail-closed local persistence, and game-owned high-frequency simulation.

- [ ] **Step 4: Preserve scope boundaries**

Keep `api/chat/` and `server/chat/` documented as current production boundaries until #21 removes them; do not prematurely redefine them as dead code.

### Task 4: Reconcile ROADMAP with current main and the approved networking/hosting sequence

**Files:**
- Modify: `ROADMAP.md`

**Interfaces:**
- Consumes: Current `main`, merged Stage 0 work, #18/#19 outcomes, and Issues #20-#23.
- Produces: Durable roadmap direction matching current repository truth.

- [ ] **Step 1: Refresh stale Stage 0/current-state statements**

Remove claims that merged shell/input work remains open or unlanded. Reflect the current source-of-truth state rather than preserving September 11 PR status.

- [ ] **Step 2: Record networking evidence gates**

Document #18 and #19 as completed PROCEED WITH CONSTRAINTS feasibility gates and #20 as the architecture source-of-truth gate.

- [ ] **Step 3: Record approved downstream sequence**

Show #21 production networking migration → #22 static AWS foundation → #23 `coolgamesplus.com` cutover/legacy retirement. State that AWS static hosting is planned/evidence-backed but not yet the production host.

- [ ] **Step 4: Update intentional deferrals**

Remove “speculative hosting migration” as a generic deferral while preserving deliberate deferral of TURN, accounts, matchmaking, host migration, large multiplayer systems, and backend game authority until product evidence requires them.

### Task 5: Validate the documentation PR and make it review-ready

**Files:**
- Review: all changed files in PR #41
- No runtime source modifications.

**Interfaces:**
- Consumes: Completed Tasks 1-4.
- Produces: Focused #20 PR with clean diff and passing repository validation.

- [ ] **Step 1: Audit the complete branch diff against main**

Expected changed files are documentation/source-of-truth files only. Reject any runtime, dependency, API/server, Vercel config, AWS implementation, or generated artifact change.

- [ ] **Step 2: Search the changed docs for contradictions**

Verify `Vercel`, `Redis`, `Upstash`, `Trystero`, `TURN`, `client-only`, `listen server`, `AWS`, `current production`, and `approved target` are used consistently with current-vs-target status.

- [ ] **Step 3: Run the repository validation gate through GitHub Actions**

Expected on the final branch head:

```text
npm test
npm run lint
npm run build
```

All three must pass before claiming completion.

- [ ] **Step 4: Update PR #41 body with final decision/evidence**

Include `Closes #20`, both POC outcomes as **PROCEED WITH CONSTRAINTS**, current-vs-target distinction, coordinator responsibility disposition, validation results, risks/deferred items, and explicit statement that no runtime migration is included.

- [ ] **Step 5: Mark PR ready for review**

Only after the final diff audit and CI are green. Do not merge.
