import { generateCapability } from './partyCrypto'
import type { GuestPartyStore } from './guestPartyStore'
import { GuestPartyReplica } from './guestPartyReplica'
import type { HostPartyAuthority } from './hostPartyAuthority'
import type { HostPartyLockLease } from './hostPartyLock'
import {
  buildGuestInviteUrl,
} from './partyRoutes'
import {
  parsePartyMessage,
  PARTY_PROTOCOL_GENERATION,
  serializePartyMessage,
  type PartyCanonicalWireEvent,
  type PartyWireMessage,
} from './partyProtocol'
import type { PartyChatMessage, PartyMemberView } from './partyTypes'
import type { GuestHandshakeAuthenticated, HostHandshakeAuthenticated } from './partyHandshake'

export type PartyConnectionStatus =
  | 'starting'
  | 'waiting'
  | 'finding-host'
  | 'connected'
  | 'reconnecting'
  | 'removed'
  | 'error'
  | 'reload-required'

export type PartySessionSnapshot = {
  role: 'host' | 'guest'
  partyId: string
  status: PartyConnectionStatus
  locked: boolean
  members: PartyMemberView[]
  messages: PartyChatMessage[]
  localMemberId: string
  localLabel: string
  inviteUrl: string | null
  error: string | null
}

export interface PartyTransportClient {
  start(): Promise<void>
  send(data: string, target?: string | string[] | null): Promise<void>
  peerIds(): string[]
  disconnectPeer(peerId: string): void
  dispose(): Promise<{ requiresReload: boolean }>
}

export interface PartySessionClient {
  getSnapshot(): PartySessionSnapshot
  subscribe(handler: (snapshot: PartySessionSnapshot) => void): () => void
  sendMessage(text: string): Promise<void>
  dispose(): Promise<{ requiresReload: boolean }>
}

type Subscriber = (snapshot: PartySessionSnapshot) => void

function canonicalDeltaMessage(
  partyId: string,
  incarnationId: string,
  event: PartyCanonicalWireEvent,
): PartyWireMessage {
  return {
    version: PARTY_PROTOCOL_GENERATION,
    type: 'sync-delta',
    partyId,
    incarnationId,
    fromCanonicalSequence: event.canonicalSequence,
    toCanonicalSequence: event.canonicalSequence,
    events: [event],
  }
}

export class HostPartySession implements PartySessionClient {
  private readonly subscribers = new Set<Subscriber>()
  private readonly connectedPeers = new Set<string>()
  private readonly bindingByMember = new Map<string, { peerId: string; transportAttemptId: string }>()
  private readonly postJoin = new Map<string, HostHandshakeAuthenticated>()
  private readonly input: {
    authority: HostPartyAuthority
    transport: PartyTransportClient
    lock: HostPartyLockLease
    origin: string
  }
  private error: string | null = null
  private disposed = false
  private disposePromise: Promise<{ requiresReload: boolean }> | null = null

  constructor(input: {
    authority: HostPartyAuthority
    transport: PartyTransportClient
    lock: HostPartyLockLease
    origin: string
  }) {
    this.input = input
  }

  getSnapshot(): PartySessionSnapshot {
    const state = this.input.authority.state
    const members = state.members
      .filter((member) => !member.removed)
      .map((member) => ({ memberId: member.memberId, label: member.label, removed: false }))
    return {
      role: 'host',
      partyId: state.partyId,
      status: this.error
        ? 'error'
        : this.connectedPeers.size > 0 ? 'connected' : 'waiting',
      locked: state.locked,
      members,
      messages: [...state.messages],
      localMemberId: 'host',
      localLabel: 'Host',
      inviteUrl: state.locked || !state.admissionCapability
        ? null
        : buildGuestInviteUrl(this.input.origin, {
            partyId: state.partyId,
            rendezvousCapability: state.rendezvousCapability,
            admissionCapability: state.admissionCapability,
            hostFingerprint: state.hostFingerprint,
          }),
      error: this.error,
    }
  }

  subscribe(handler: Subscriber) {
    this.subscribers.add(handler)
    return () => this.subscribers.delete(handler)
  }

  private emit() {
    const snapshot = this.getSnapshot()
    for (const subscriber of this.subscribers) subscriber(snapshot)
  }

  private async sendMessageToPeer(message: PartyWireMessage, peerId: string) {
    await this.input.transport.send(serializePartyMessage(message), peerId)
  }

  private async broadcastEvent(event: PartyCanonicalWireEvent, excludePeerId?: string) {
    const message = canonicalDeltaMessage(
      this.input.authority.state.partyId,
      this.input.authority.state.incarnationId,
      event,
    )
    const targets = this.input.transport.peerIds().filter((peerId) => peerId !== excludePeerId)
    await Promise.all(targets.map((peerId) => this.sendMessageToPeer(message, peerId)))
  }

  handleAuthenticated(authenticated: HostHandshakeAuthenticated) {
    if (this.disposed) return
    this.bindingByMember.set(authenticated.member.memberId, {
      peerId: authenticated.peerId,
      transportAttemptId: authenticated.transportAttemptId,
    })
    this.postJoin.set(authenticated.peerId, authenticated)
  }

  handlePeerJoin(peerId: string) {
    if (this.disposed) return
    this.connectedPeers.add(peerId)
    const authenticated = this.postJoin.get(peerId)
    this.postJoin.delete(peerId)
    this.emit()

    if (!authenticated) return
    void (async () => {
      try {
        if (authenticated.event) {
          await this.broadcastEvent(authenticated.event, peerId)
        }
        if (authenticated.replaced) {
          await this.sendMessageToPeer({
            version: PARTY_PROTOCOL_GENERATION,
            type: 'superseded',
            partyId: this.input.authority.state.partyId,
            memberId: authenticated.member.memberId,
          }, authenticated.replaced.peerId)
          this.input.transport.disconnectPeer(authenticated.replaced.peerId)
        }
      } catch (error) {
        if (this.disposed) return
        this.error = error instanceof Error ? error.message : 'Unable to publish party state'
        this.emit()
      }
    })()
  }

  handlePeerLeave(peerId: string) {
    this.connectedPeers.delete(peerId)
    this.input.authority.unbindTransport(peerId)
    for (const [memberId, binding] of this.bindingByMember.entries()) {
      if (binding.peerId === peerId) this.bindingByMember.delete(memberId)
    }
    if (!this.disposed) this.emit()
  }

  async handleMessage(data: string, peerId: string) {
    if (this.disposed) return
    const message = parsePartyMessage(data)
    if (!message || message.partyId !== this.input.authority.state.partyId) return

    if (message.type === 'chat-intent') {
      const memberId = this.input.authority.memberForTransport(peerId, message.transportAttemptId)
      if (!memberId) return
      const result = await this.input.authority.submitChat({
        memberId,
        peerId,
        transportAttemptId: message.transportAttemptId,
        requestSequence: message.requestSequence,
        clientMessageId: message.clientMessageId,
        sentAt: message.sentAt,
        text: message.text,
      })
      if (!result.accepted) {
        await this.sendMessageToPeer({
          version: PARTY_PROTOCOL_GENERATION,
          type: 'rejected',
          partyId: this.input.authority.state.partyId,
          code: result.reason,
        }, peerId)
        return
      }
      await this.broadcastEvent(result.event)
      this.emit()
      return
    }

    if (message.type === 'sync-request') {
      if (!this.input.authority.memberForTransport(peerId, message.transportAttemptId)) return
      const sync = this.input.authority.buildSync(message.afterCanonicalSequence)
      if (sync.kind === 'delta') {
        await this.sendMessageToPeer({
          version: PARTY_PROTOCOL_GENERATION,
          type: 'sync-delta',
          partyId: this.input.authority.state.partyId,
          incarnationId: this.input.authority.state.incarnationId,
          fromCanonicalSequence: sync.fromCanonicalSequence,
          toCanonicalSequence: sync.toCanonicalSequence,
          events: sync.events,
        }, peerId)
      } else {
        await this.sendMessageToPeer({
          version: PARTY_PROTOCOL_GENERATION,
          type: 'sync-snapshot',
          partyId: this.input.authority.state.partyId,
          incarnationId: this.input.authority.state.incarnationId,
          canonicalSequence: sync.canonicalSequence,
          locked: sync.locked,
          members: sync.members,
          messages: sync.messages,
        }, peerId)
      }
    }
  }

  async sendMessage(text: string) {
    if (this.disposed) throw new Error('Host party session is disposed')
    const result = await this.input.authority.commitHostChat({
      clientMessageId: generateCapability(),
      sentAt: Date.now(),
      text,
    })
    if (!result.accepted) throw new Error(result.reason)
    await this.broadcastEvent(result.event)
    this.emit()
  }

  async setLocked(locked: boolean) {
    if (this.disposed) throw new Error('Host party session is disposed')
    const result = await this.input.authority.setAdmissionLocked(locked)
    if (result.event) await this.broadcastEvent(result.event)
    this.emit()
  }

  async removeMember(memberId: string) {
    if (this.disposed) throw new Error('Host party session is disposed')
    const binding = this.bindingByMember.get(memberId) ?? null
    const result = await this.input.authority.removeMember(memberId)
    if (!result.accepted) throw new Error(result.reason)

    await this.broadcastEvent(result.event, binding?.peerId)
    if (binding) {
      await this.sendMessageToPeer({
        version: PARTY_PROTOCOL_GENERATION,
        type: 'removed',
        partyId: this.input.authority.state.partyId,
        memberId,
      }, binding.peerId)
      this.input.transport.disconnectPeer(binding.peerId)
      this.connectedPeers.delete(binding.peerId)
      this.bindingByMember.delete(memberId)
    }
    this.emit()
  }

  dispose() {
    if (!this.disposePromise) {
      this.disposed = true
      this.disposePromise = this.disposeInternal()
    }
    return this.disposePromise
  }

  private async disposeInternal() {
    await this.input.authority.close()

    let transportResult: { requiresReload: boolean }
    try {
      transportResult = await this.input.transport.dispose()
    } catch {
      transportResult = { requiresReload: true }
    }

    if (!transportResult.requiresReload) {
      this.input.lock.release()
      await this.input.lock.released
    }

    this.connectedPeers.clear()
    this.bindingByMember.clear()
    this.postJoin.clear()
    this.subscribers.clear()
    return transportResult
  }
}

type PendingGuestMessage = {
  clientMessageId: string
  requestSequence: number
}

export class GuestPartySession implements PartySessionClient {
  private readonly subscribers = new Set<Subscriber>()
  private readonly input: {
    replica: GuestPartyReplica
    store: GuestPartyStore
    transport: PartyTransportClient
  }
  private status: PartyConnectionStatus = 'finding-host'
  private error: string | null = null
  private hostPeerId: string | null = null
  private transportAttemptId: string | null = null
  private pendingMessage: PendingGuestMessage | null = null
  private disposed = false
  private disposePromise: Promise<{ requiresReload: boolean }> | null = null

  constructor(input: {
    replica: GuestPartyReplica
    store: GuestPartyStore
    transport: PartyTransportClient
  }) {
    this.input = input
  }

  getSnapshot(): PartySessionSnapshot {
    const state = this.input.replica.state
    return {
      role: 'guest',
      partyId: state.partyId,
      status: this.status,
      locked: state.locked,
      members: [...state.members],
      messages: [...state.messages],
      localMemberId: state.memberId ?? 'guest',
      localLabel: state.label ?? 'Guest',
      inviteUrl: null,
      error: this.error,
    }
  }

  subscribe(handler: Subscriber) {
    this.subscribers.add(handler)
    return () => this.subscribers.delete(handler)
  }

  private emit() {
    const snapshot = this.getSnapshot()
    for (const subscriber of this.subscribers) subscriber(snapshot)
  }

  handleAuthenticated(authenticated: GuestHandshakeAuthenticated) {
    if (this.disposed) return
    this.hostPeerId = authenticated.hostPeerId
    this.transportAttemptId = authenticated.transportAttemptId
    this.error = null
    if (this.status !== 'connected') this.status = 'finding-host'
    this.emit()
  }

  async handlePeerJoin(peerId: string) {
    if (this.disposed || peerId !== this.hostPeerId || !this.transportAttemptId) return
    this.status = 'connected'
    this.error = null
    this.emit()
    await this.requestSync()
  }

  handlePeerLeave(peerId: string) {
    if (peerId !== this.hostPeerId) return
    this.hostPeerId = null
    this.transportAttemptId = null
    if (!this.disposed && this.status !== 'removed' && this.status !== 'error') {
      this.status = 'reconnecting'
      this.emit()
    }
  }

  private async requestSync() {
    if (this.disposed || !this.hostPeerId || !this.transportAttemptId) return
    await this.input.transport.send(serializePartyMessage({
      version: PARTY_PROTOCOL_GENERATION,
      type: 'sync-request',
      partyId: this.input.replica.state.partyId,
      transportAttemptId: this.transportAttemptId,
      afterCanonicalSequence: this.input.replica.state.canonicalSequence,
    }), this.hostPeerId)
  }

  private acknowledgePending(events: PartyCanonicalWireEvent[]) {
    if (!this.pendingMessage) return
    const pending = this.pendingMessage
    const matched = events.some((event) => event.kind === 'chat'
      && event.message.id === pending.clientMessageId
      && event.message.sender.memberId === this.input.replica.state.memberId)
    if (matched) {
      this.input.replica.setNextRequestSequence(pending.requestSequence + 1)
      this.pendingMessage = null
    }
  }

  async handleMessage(data: string, peerId: string) {
    if (this.disposed || !this.hostPeerId || peerId !== this.hostPeerId) return
    const message = parsePartyMessage(data)
    if (!message || message.partyId !== this.input.replica.state.partyId) return

    if (message.type === 'sync-delta') {
      const result = this.input.replica.applyDelta({
        incarnationId: message.incarnationId,
        fromCanonicalSequence: message.fromCanonicalSequence,
        toCanonicalSequence: message.toCanonicalSequence,
        events: message.events,
      })
      if (!result.applied) {
        if (result.reason === 'wrong-incarnation') {
          this.status = 'error'
          this.error = 'The original Chat party is no longer available.'
          this.emit()
          return
        }
        await this.requestSync()
        return
      }
      this.acknowledgePending(message.events)
      await this.input.store.save(this.input.replica.state)
      this.emit()
      return
    }

    if (message.type === 'sync-snapshot') {
      const result = this.input.replica.applySnapshot({
        incarnationId: message.incarnationId,
        canonicalSequence: message.canonicalSequence,
        locked: message.locked,
        members: message.members,
        messages: message.messages,
      })
      if (!result.applied) {
        this.status = 'error'
        this.error = 'The original Chat party is no longer available.'
      } else {
        await this.input.store.save(this.input.replica.state)
      }
      this.emit()
      return
    }

    if (message.type === 'rejected') {
      this.pendingMessage = null
      this.error = message.code === 'rate-limited'
        ? 'You are sending messages too quickly. Try again in a moment.'
        : 'That Chat action was rejected by the host.'
      this.emit()
      return
    }

    if (message.type === 'superseded' && message.memberId === this.input.replica.state.memberId) {
      this.status = 'error'
      this.error = 'This Chat connection was replaced by a newer connection for the same member.'
      this.emit()
      return
    }

    if (message.type === 'removed' && message.memberId === this.input.replica.state.memberId) {
      this.status = 'removed'
      this.error = null
      this.emit()
    }
  }

  async sendMessage(text: string) {
    if (this.disposed) throw new Error('Guest party session is disposed')
    if (!this.hostPeerId || !this.transportAttemptId || this.status !== 'connected') {
      throw new Error('The host is not connected')
    }
    if (this.pendingMessage) {
      throw new Error('Your previous message is still being confirmed by the host')
    }

    const clientMessageId = generateCapability()
    const requestSequence = this.input.replica.state.nextRequestSequence
    this.pendingMessage = { clientMessageId, requestSequence }
    try {
      await this.input.transport.send(serializePartyMessage({
        version: PARTY_PROTOCOL_GENERATION,
        type: 'chat-intent',
        partyId: this.input.replica.state.partyId,
        transportAttemptId: this.transportAttemptId,
        requestSequence,
        clientMessageId,
        sentAt: Date.now(),
        text,
      }), this.hostPeerId)
    } catch (error) {
      this.pendingMessage = null
      throw error
    }
  }

  dispose() {
    if (!this.disposePromise) {
      this.disposed = true
      this.disposePromise = this.disposeInternal()
    }
    return this.disposePromise
  }

  private async disposeInternal() {
    let result: { requiresReload: boolean }
    try {
      result = await this.input.transport.dispose()
    } catch {
      result = { requiresReload: true }
    }
    this.hostPeerId = null
    this.transportAttemptId = null
    this.pendingMessage = null
    this.subscribers.clear()
    return result
  }
}
