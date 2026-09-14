# WebRTC Chat Networking Design — Superseded Coordinator Architecture

Date: 2026-09-08  
Original status: Approved and implemented through PR #1  
Future-architecture status: **Superseded by Issue #20 / `2026-09-14-client-only-host-authoritative-networking-design.md`**

## Supersession notice

This document recorded the design that introduced the current production Chat architecture: a Vercel Functions + Upstash Redis room coordinator for durable membership/control and short-lived WebRTC signaling, with Chat payloads kept on host-star WebRTC.

That design was valid for its implementation and remains useful historical/current-runtime context **until Issue #21 replaces the coordinator**. It is no longer the intended future networking architecture.

The approved target is now:

- browser-hosted authoritative listen server;
- one active host plus passive guests in a small host-star party;
- direct WebRTC application traffic;
- Trystero/Nostr public decentralized rendezvous;
- host-local IndexedDB canonical authority;
- guest-local durable credential/cursor state;
- no C00lG@mes+-owned dynamic signaling, room-state, Chat-history, or game-state backend;
- permanent host loss ends the v1 party;
- TURN remains an evidence-gated follow-up rather than a current dependency.

Read the canonical target architecture here:

`docs/superpowers/specs/2026-09-14-client-only-host-authoritative-networking-design.md`

## Current runtime distinction

Until #21 lands, production `/chat` still implements the September 8 coordinator lineage:

- `src/networking/room/RoomClient.ts` talks to the coordinator;
- `src/networking/room/RoomPeerManager.ts` manages current host-star WebRTC peers and reconnect generations;
- `api/chat/` contains Vercel Function entrypoints;
- `server/chat/` owns coordinator authorization, room/member state, signaling, and Upstash storage;
- production Chat currently requires the Upstash runtime configuration documented in `README.md`;
- Chat message payloads themselves remain WebRTC-only.

Do not delete, bypass, or describe those paths as dead until #21 has migrated production behavior and proven the old coordinator is no longer referenced.

## Historical architecture summary

The September 8 design established several concepts that remain useful even though the coordinator ownership changes:

- durable application room/member identity is separate from disposable WebRTC connection identity;
- guests are untrusted;
- the host owns visible/canonical sender identity;
- the supported topology is a small host-star rather than a guest full mesh;
- reconnect should rebuild transport automatically rather than ask players to exchange SDP codes;
- host removal and lock/unlock are explicit party controls;
- Chat protocol payloads are bounded/versioned;
- normal Chat traffic stays off signaling infrastructure;
- TURN is not added without evidence;
- networking remains below Chat/game-specific semantics.

The original coordinator implementation added additional server-owned behavior—Redis room records, room TTL, member presence, connection generations, short-lived signaling records, adaptive HTTP polling, host/invite/member secrets, and Vercel deployment/runtime assumptions. Issue #20 explicitly maps each of those responsibilities to browser host, guest browser, public rendezvous, local persistence, deletion, or deliberate deferral.

## Why the direction changed

Two focused feasibility gates landed after this design:

- **#18 / PR #24 — PROCEED WITH CONSTRAINTS:** proved active-host/passive-guest Trystero/Nostr discovery, direct WebRTC on tested paths without TURN, one-link join/reconnect, and application identity/admission independent of Trystero peer identity. It also exposed public-relay dependency and potentially material late-join latency.
- **#19 / PR #35 — PROCEED WITH CONSTRAINTS:** proved host-local canonical authority, IndexedDB persistence-before-broadcast, replay/gap rejection, durable lock/removal state, host/guest reload recovery, delta/snapshot convergence, and fail-closed host storage without a remote application-state backend.

That evidence is sufficient to approve a browser-hosted listen-server target while carrying forward explicit production constraints around lifecycle, local-storage durability, public rendezvous, single-host-writer safety, restrictive networks, and host availability.

Git history and PR #1 preserve the complete original implementation/design lineage. New networking implementation work should use the September 14 target spec and current GitHub Issues/PRs as the architecture source of truth.
