import { RoomClientError, RoomPoller, type RoomCoordinatorClient, type RoomPollMode } from './RoomClient'
import {
  ROOM_PROTOCOL_VERSION,
  type GuestAuth,
  type HostAuth,
  type RoomMemberView,
  type RoomState,
} from './roomProtocol'
import {
  PeerSession,
  type PeerSessionClient,
} from '../webrtc/PeerSession'
import type { PeerConnectionState } from '../webrtc/types'

type PeerSessionFactory = () => PeerSessionClient

type PollerLike = Pick<RoomPoller, 'start' | 'stop'>

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

type ManagedPeer = {
  generation: string
  session: PeerSessionClient
  state: PeerConnectionState
  offerSdp: string | null
  answerApplied: boolean
  unsubscribes: Array<() => void>
}

type GuestPeer = {
  session: PeerSessionClient
  state: PeerConnectionState
  offerSdp: string
  unsubscribes: Array<() => void>
}

function defaultSessionFactory() {
  return new PeerSession()
}

function defaultGenerationFactory() {
  return crypto.randomUUID()
}

function asError(error: unknown) {
  return error instanceof Error ? error : new Error('Unknown room networking error')
}

export class RoomPeerManager implements RoomPeerManagerClient {
  private readonly handlers = new Set<(event: RoomPeerEvent) => void>()
  private readonly hostPeers = new Map<string, ManagedPeer>()
  private hostAuth: HostAuth | null = null
  private guestAuth: GuestAuth | null = null
  private guestGeneration: string | null = null
  private guestGenerationAnnounced = false
  private guestPeer: GuestPeer | null = null
  private closed = false

  constructor(
    private readonly coordinator: RoomCoordinatorClient,
    private readonly sessionFactory: PeerSessionFactory = defaultSessionFactory,
    private readonly generationFactory: () => string = defaultGenerationFactory,
    private readonly poller: PollerLike = new RoomPoller(),
  ) {}

  onEvent(handler: (event: RoomPeerEvent) => void) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  startHost(auth: HostAuth) {
    this.resetMode()
    this.hostAuth = auth
    this.closed = false
    this.poller.start(
      () => this.hostTick(),
      () => this.hostPollMode(),
      (error) => this.handlePollError(error),
    )
  }

  startGuest(auth: GuestAuth) {
    this.resetMode()
    this.guestAuth = auth
    this.closed = false
    this.beginGuestGeneration()
    this.poller.start(
      () => this.guestTick(),
      () => this.guestPollMode(),
      (error) => this.handlePollError(error),
    )
  }

  sendToHost(data: string) {
    if (!this.guestPeer) {
      throw new Error('Host connection is not ready')
    }
    this.guestPeer.session.send(data)
  }

  sendToMember(memberId: string, data: string) {
    const peer = this.hostPeers.get(memberId)
    if (!peer) {
      throw new Error(`Member ${memberId} is not connected`)
    }
    peer.session.send(data)
  }

  broadcast(data: string, exceptMemberId?: string) {
    for (const [memberId, peer] of this.hostPeers) {
      if (memberId !== exceptMemberId && peer.state === 'connected') {
        peer.session.send(data)
      }
    }
  }

  removePeer(memberId: string) {
    const peer = this.hostPeers.get(memberId)
    if (peer) {
      this.closeManagedPeer(peer)
      this.hostPeers.delete(memberId)
    }
  }

  close() {
    if (this.closed) {
      return
    }
    this.closed = true
    this.poller.stop()
    this.closeAllPeers()
    this.coordinator.close()
    this.handlers.clear()
    this.hostAuth = null
    this.guestAuth = null
  }

  private async hostTick() {
    const auth = this.hostAuth
    if (!auth || this.closed) {
      return
    }

    const state = await this.coordinator.getState(auth)
    if (this.closed || this.hostAuth !== auth) {
      return
    }
    this.emit({ type: 'room-state', state })

    const active = new Map(
      state.members
        .filter((member) => member.present && !member.removed && member.connectionGeneration)
        .map((member) => [member.memberId, member] as const),
    )

    for (const [memberId, peer] of this.hostPeers) {
      const member = active.get(memberId)
      if (!member || member.connectionGeneration !== peer.generation) {
        this.closeManagedPeer(peer)
        this.hostPeers.delete(memberId)
      }
    }

    const work = [...active.values()].map(async (member) => {
      try {
        await this.ensureHostPeer(auth, member)
      } catch (error) {
        this.emit({ type: 'error', error: asError(error) })
      }
    })
    await Promise.all(work)
  }

  private async ensureHostPeer(auth: HostAuth, member: RoomMemberView) {
    const generation = member.connectionGeneration
    if (!generation) {
      return
    }

    let peer = this.hostPeers.get(member.memberId)
    if (!peer) {
      peer = this.createManagedHostPeer(member.memberId, generation)
      this.hostPeers.set(member.memberId, peer)
    }

    if (!peer.offerSdp) {
      const offer = await peer.session.createOffer()
      if (!this.isCurrentHostPeer(member.memberId, generation, peer)) {
        return
      }
      peer.offerSdp = offer.sdp ?? ''
      await this.coordinator.publishSignal(auth, {
        version: ROOM_PROTOCOL_VERSION,
        roomId: auth.roomId,
        memberId: member.memberId,
        generation,
        kind: 'offer',
        description: offer,
      })
    }

    if (!peer.answerApplied) {
      const answer = await this.coordinator.getSignal(
        auth,
        member.memberId,
        generation,
        'answer',
      )
      if (!answer || !this.isCurrentHostPeer(member.memberId, generation, peer)) {
        return
      }
      await peer.session.applyAnswer(answer.description)
      if (this.isCurrentHostPeer(member.memberId, generation, peer)) {
        peer.answerApplied = true
      }
    }
  }

  private createManagedHostPeer(memberId: string, generation: string): ManagedPeer {
    const session = this.sessionFactory()
    const peer: ManagedPeer = {
      generation,
      session,
      state: 'idle',
      offerSdp: null,
      answerApplied: false,
      unsubscribes: [],
    }
    peer.unsubscribes = [
      session.onMessage((data) => this.emit({ type: 'message', memberId, data })),
      session.onStateChange((state) => {
        peer.state = state
        this.emit({ type: 'peer-state', memberId, state })
      }),
    ]
    return peer
  }

  private async guestTick() {
    const auth = this.guestAuth
    const generation = this.guestGeneration
    if (!auth || !generation || this.closed) {
      return
    }

    if (!this.guestGenerationAnnounced) {
      await this.coordinator.announceGeneration(auth, generation)
      if (this.guestGeneration === generation) {
        this.guestGenerationAnnounced = true
      }
    }

    const state = await this.coordinator.getState(auth)
    if (this.closed || this.guestAuth !== auth || this.guestGeneration !== generation) {
      return
    }
    this.emit({ type: 'room-state', state })

    const offer = await this.coordinator.getSignal(auth, auth.memberId, generation, 'offer')
    if (!offer || this.closed || this.guestGeneration !== generation) {
      return
    }

    const offerSdp = offer.description.sdp ?? ''
    if (this.guestPeer?.offerSdp === offerSdp) {
      return
    }

    this.closeGuestPeer()
    const session = this.sessionFactory()
    const peer: GuestPeer = {
      session,
      state: 'idle',
      offerSdp,
      unsubscribes: [],
    }
    peer.unsubscribes = [
      session.onMessage((data) => this.emit({ type: 'message', memberId: 'host', data })),
      session.onStateChange((peerState) => {
        peer.state = peerState
        this.emit({ type: 'peer-state', memberId: 'host', state: peerState })
        if (peerState === 'failed' || peerState === 'disconnected') {
          this.beginGuestGeneration()
        }
      }),
    ]
    this.guestPeer = peer

    const answer = await session.acceptOffer(offer.description)
    if (this.closed || this.guestGeneration !== generation || this.guestPeer !== peer) {
      return
    }
    await this.coordinator.publishSignal(auth, {
      version: ROOM_PROTOCOL_VERSION,
      roomId: auth.roomId,
      memberId: auth.memberId,
      generation,
      kind: 'answer',
      description: answer,
    })
  }

  private beginGuestGeneration() {
    if (!this.guestAuth || this.closed) {
      return
    }
    this.closeGuestPeer()
    this.guestGeneration = this.generationFactory()
    this.guestGenerationAnnounced = false
  }

  private hostPollMode(): RoomPollMode {
    for (const peer of this.hostPeers.values()) {
      if (peer.state !== 'connected') {
        return 'negotiating'
      }
    }
    return 'hostConnected'
  }

  private guestPollMode(): RoomPollMode {
    return this.guestPeer?.state === 'connected' ? 'guestConnected' : 'negotiating'
  }

  private isCurrentHostPeer(memberId: string, generation: string, peer: ManagedPeer) {
    return !this.closed
      && this.hostPeers.get(memberId) === peer
      && peer.generation === generation
  }

  private handlePollError(error: unknown) {
    if (error instanceof RoomClientError && error.code === 'member_removed') {
      this.poller.stop()
      this.closeAllPeers()
      this.emit({ type: 'removed' })
      return
    }

    if (
      error instanceof RoomClientError
      && (error.code === 'invalid_credentials' || error.code === 'room_not_found')
    ) {
      this.poller.stop()
      this.closeAllPeers()
    }
    this.emit({ type: 'error', error: asError(error) })
  }

  private resetMode() {
    this.poller.stop()
    this.closeAllPeers()
    this.hostAuth = null
    this.guestAuth = null
    this.guestGeneration = null
    this.guestGenerationAnnounced = false
  }

  private closeAllPeers() {
    for (const peer of this.hostPeers.values()) {
      this.closeManagedPeer(peer)
    }
    this.hostPeers.clear()
    this.closeGuestPeer()
  }

  private closeManagedPeer(peer: ManagedPeer) {
    for (const unsubscribe of peer.unsubscribes) {
      unsubscribe()
    }
    peer.unsubscribes = []
    peer.session.close()
  }

  private closeGuestPeer() {
    if (!this.guestPeer) {
      return
    }
    for (const unsubscribe of this.guestPeer.unsubscribes) {
      unsubscribe()
    }
    this.guestPeer.unsubscribes = []
    this.guestPeer.session.close()
    this.guestPeer = null
  }

  private emit(event: RoomPeerEvent) {
    for (const handler of this.handlers) {
      handler(event)
    }
  }
}
