import { describe, expect, it } from 'vitest'
import type {
  ConnectionSignal,
  GuestAuth,
  HostAuth,
  RoomState,
} from './roomProtocol'
import type { RoomCoordinatorClient } from './RoomClient'
import { RoomClientError } from './RoomClient'
import { RoomPeerManager } from './RoomPeerManager'
import type {
  PeerMessageHandler,
  PeerSessionClient,
  PeerStateHandler,
} from '../webrtc/PeerSession'
import type { PeerConnectionState } from '../webrtc/types'

const ROOM_ID = 'room_1234567890123456'
const HOST_AUTH: HostAuth = {
  role: 'host',
  roomId: ROOM_ID,
  hostSecret: 'host_123456789012345678901234',
}
const GUEST_AUTH: GuestAuth = {
  role: 'guest',
  roomId: ROOM_ID,
  memberId: 'member_1234567890',
  memberSecret: 'secret_123456789012345678901234',
}

class ManualPoller {
  task: (() => Promise<void>) | null = null
  onError: ((error: unknown) => void) | null = null

  start(
    task: () => Promise<void>,
    _getMode: () => 'negotiating' | 'hostConnected' | 'guestConnected',
    onError: (error: unknown) => void,
  ) {
    this.task = task
    this.onError = onError
  }

  stop() {
    this.task = null
  }

  async run() {
    if (!this.task) {
      return
    }
    try {
      await this.task()
    } catch (error) {
      this.onError?.(error)
    }
  }
}

class FakePeerSession implements PeerSessionClient {
  readonly sent: string[] = []
  readonly appliedAnswers: RTCSessionDescriptionInit[] = []
  readonly acceptedOffers: RTCSessionDescriptionInit[] = []
  closeCount = 0
  private readonly messageHandlers = new Set<PeerMessageHandler>()
  private readonly stateHandlers = new Set<PeerStateHandler>()

  constructor(readonly id: number) {}

  async createOffer() {
    return { type: 'offer' as const, sdp: `offer-${this.id}` }
  }

  async acceptOffer(offer: RTCSessionDescriptionInit) {
    this.acceptedOffers.push(offer)
    return { type: 'answer' as const, sdp: `answer-${this.id}` }
  }

  async applyAnswer(answer: RTCSessionDescriptionInit) {
    this.appliedAnswers.push(answer)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closeCount += 1
  }

  onMessage(handler: PeerMessageHandler) {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStateChange(handler: PeerStateHandler) {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  emitState(state: PeerConnectionState) {
    for (const handler of this.stateHandlers) {
      handler(state)
    }
  }

  emitMessage(data: string) {
    for (const handler of this.messageHandlers) {
      handler(data)
    }
  }
}

class FakeCoordinator implements RoomCoordinatorClient {
  state: RoomState = {
    version: 1,
    roomId: ROOM_ID,
    locked: false,
    members: [],
    revision: 1,
  }
  readonly announced: string[] = []
  readonly published: ConnectionSignal[] = []
  readonly signals = new Map<string, ConnectionSignal>()
  closed = false
  stateError: Error | null = null

  async createRoom() {
    throw new Error('not used')
  }

  async joinOrResume() {
    throw new Error('not used')
  }

  async getState() {
    if (this.stateError) {
      throw this.stateError
    }
    return structuredClone(this.state)
  }

  async setLocked() {
    return structuredClone(this.state)
  }

  async removeMember() {
    return structuredClone(this.state)
  }

  async announceGeneration(_auth: GuestAuth, generation: string) {
    this.announced.push(generation)
    const member = this.state.members.find((candidate) => candidate.memberId === GUEST_AUTH.memberId)
    if (member) {
      member.connectionGeneration = generation
      member.present = true
    }
  }

  async publishSignal(_auth: HostAuth | GuestAuth, signal: ConnectionSignal) {
    this.published.push(structuredClone(signal))
    this.signals.set(this.key(signal.memberId, signal.generation, signal.kind), structuredClone(signal))
  }

  async getSignal(
    _auth: HostAuth | GuestAuth,
    memberId: string,
    generation: string,
    kind: 'offer' | 'answer',
  ) {
    return structuredClone(this.signals.get(this.key(memberId, generation, kind)) ?? null)
  }

  close() {
    this.closed = true
  }

  private key(memberId: string, generation: string, kind: 'offer' | 'answer') {
    return `${memberId}:${generation}:${kind}`
  }
}

function roomWithMember(generation: string): RoomState {
  return {
    version: 1,
    roomId: ROOM_ID,
    locked: false,
    revision: 1,
    members: [{
      memberId: GUEST_AUTH.memberId,
      label: 'Guest 1',
      present: true,
      removed: false,
      connectionGeneration: generation,
    }],
  }
}

describe('RoomPeerManager host mode', () => {
  it('creates one offer per member generation and applies the matching answer once', async () => {
    const coordinator = new FakeCoordinator()
    coordinator.state = roomWithMember('generation_111111111')
    const poller = new ManualPoller()
    const sessions: FakePeerSession[] = []
    const manager = new RoomPeerManager(
      coordinator,
      () => {
        const session = new FakePeerSession(sessions.length + 1)
        sessions.push(session)
        return session
      },
      () => 'unused_generation',
      poller,
    )

    manager.startHost(HOST_AUTH)
    await poller.run()

    expect(sessions).toHaveLength(1)
    expect(coordinator.published).toHaveLength(1)
    expect(coordinator.published[0]).toMatchObject({
      kind: 'offer',
      generation: 'generation_111111111',
      description: { sdp: 'offer-1' },
    })

    coordinator.signals.set(
      `${GUEST_AUTH.memberId}:generation_111111111:answer`,
      {
        version: 1,
        roomId: ROOM_ID,
        memberId: GUEST_AUTH.memberId,
        generation: 'generation_111111111',
        kind: 'answer',
        description: { type: 'answer', sdp: 'guest-answer' },
      },
    )

    await poller.run()
    await poller.run()
    expect(sessions[0]?.appliedAnswers).toEqual([{ type: 'answer', sdp: 'guest-answer' }])
    expect(coordinator.published.filter((signal) => signal.kind === 'offer')).toHaveLength(1)
  })

  it('closes the old peer and creates a new peer for a fresh generation', async () => {
    const coordinator = new FakeCoordinator()
    coordinator.state = roomWithMember('generation_111111111')
    const poller = new ManualPoller()
    const sessions: FakePeerSession[] = []
    const manager = new RoomPeerManager(
      coordinator,
      () => {
        const session = new FakePeerSession(sessions.length + 1)
        sessions.push(session)
        return session
      },
      () => 'unused_generation',
      poller,
    )

    manager.startHost(HOST_AUTH)
    await poller.run()
    coordinator.state = roomWithMember('generation_222222222')
    await poller.run()

    expect(sessions).toHaveLength(2)
    expect(sessions[0]?.closeCount).toBe(1)
    expect(coordinator.published.at(-1)).toMatchObject({
      generation: 'generation_222222222',
      description: { sdp: 'offer-2' },
    })
  })

  it('keeps guest transports isolated and broadcasts only to connected peers', async () => {
    const coordinator = new FakeCoordinator()
    coordinator.state = {
      ...roomWithMember('generation_111111111'),
      members: [
        ...roomWithMember('generation_111111111').members,
        {
          memberId: 'member_2222222222',
          label: 'Guest 2',
          present: true,
          removed: false,
          connectionGeneration: 'generation_222222222',
        },
      ],
    }
    const poller = new ManualPoller()
    const sessions: FakePeerSession[] = []
    const manager = new RoomPeerManager(
      coordinator,
      () => {
        const session = new FakePeerSession(sessions.length + 1)
        sessions.push(session)
        return session
      },
      () => 'unused_generation',
      poller,
    )

    manager.startHost(HOST_AUTH)
    await poller.run()
    sessions[0]?.emitState('connected')
    sessions[1]?.emitState('connected')
    manager.broadcast('hello')

    expect(sessions[0]?.sent).toEqual(['hello'])
    expect(sessions[1]?.sent).toEqual(['hello'])
    manager.removePeer(GUEST_AUTH.memberId)
    expect(sessions[0]?.closeCount).toBe(1)
    expect(sessions[1]?.closeCount).toBe(0)
  })
})

describe('RoomPeerManager guest mode', () => {
  it('announces a fresh generation, accepts the offer, and publishes the answer', async () => {
    const coordinator = new FakeCoordinator()
    coordinator.state = roomWithMember('old_generation_123')
    const poller = new ManualPoller()
    const session = new FakePeerSession(1)
    const manager = new RoomPeerManager(
      coordinator,
      () => session,
      () => 'generation_333333333',
      poller,
    )

    coordinator.signals.set(
      `${GUEST_AUTH.memberId}:generation_333333333:offer`,
      {
        version: 1,
        roomId: ROOM_ID,
        memberId: GUEST_AUTH.memberId,
        generation: 'generation_333333333',
        kind: 'offer',
        description: { type: 'offer', sdp: 'host-offer' },
      },
    )

    manager.startGuest(GUEST_AUTH)
    await poller.run()

    expect(coordinator.announced).toEqual(['generation_333333333'])
    expect(session.acceptedOffers).toEqual([{ type: 'offer', sdp: 'host-offer' }])
    expect(coordinator.published.at(-1)).toMatchObject({
      kind: 'answer',
      generation: 'generation_333333333',
      description: { sdp: 'answer-1' },
    })
  })

  it('announces another generation after its peer disconnects', async () => {
    const coordinator = new FakeCoordinator()
    coordinator.state = roomWithMember('old_generation_123')
    const poller = new ManualPoller()
    const generations = ['generation_333333333', 'generation_444444444']
    const sessions: FakePeerSession[] = []
    const manager = new RoomPeerManager(
      coordinator,
      () => {
        const session = new FakePeerSession(sessions.length + 1)
        sessions.push(session)
        return session
      },
      () => generations.shift() ?? 'generation_555555555',
      poller,
    )

    coordinator.signals.set(
      `${GUEST_AUTH.memberId}:generation_333333333:offer`,
      {
        version: 1,
        roomId: ROOM_ID,
        memberId: GUEST_AUTH.memberId,
        generation: 'generation_333333333',
        kind: 'offer',
        description: { type: 'offer', sdp: 'host-offer' },
      },
    )

    manager.startGuest(GUEST_AUTH)
    await poller.run()
    sessions[0]?.emitState('disconnected')
    await poller.run()

    expect(coordinator.announced).toEqual([
      'generation_333333333',
      'generation_444444444',
    ])
    expect(sessions[0]?.closeCount).toBe(1)
  })

  it('surfaces removal and stops polling', async () => {
    const coordinator = new FakeCoordinator()
    coordinator.stateError = new RoomClientError('member_removed', 'removed', 403)
    const poller = new ManualPoller()
    const manager = new RoomPeerManager(
      coordinator,
      () => new FakePeerSession(1),
      () => 'generation_333333333',
      poller,
    )
    const events: string[] = []
    manager.onEvent((event) => events.push(event.type))

    manager.startGuest(GUEST_AUTH)
    await poller.run()

    expect(events).toContain('removed')
    expect(poller.task).toBeNull()
  })
})
