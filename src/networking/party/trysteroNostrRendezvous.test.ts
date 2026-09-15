import { describe, expect, it, vi } from 'vitest'
import {
  TrysteroNostrTransport,
  type TrysteroNostrModuleLike,
  type TrysteroRoomLike,
} from './trysteroNostrTransport'

class FakeSocket {
  readyState = 1
  sent: string[] = []
  private listeners = new Map<string, Set<EventListener>>()

  send(data: string) {
    this.sent.push(data)
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener)
  }

  emitMessage(data: string) {
    const event = { data } as MessageEvent<string>
    this.listeners.get('message')?.forEach((listener) => listener(event as unknown as Event))
  }
}

function createRoom(peer?: RTCPeerConnection) {
  const action = {
    send: vi.fn(async () => undefined),
    onMessage: null as ((data: string, context: { peerId: string }) => void | Promise<void>) | null,
  }
  const room: TrysteroRoomLike = {
    makeAction: vi.fn(() => action),
    leave: vi.fn(async () => undefined),
    isPassive: vi.fn(() => false),
    getPeers: vi.fn(() => peer ? { 'peer-secret': peer } : {}),
    onPeerJoin: null,
    onPeerLeave: null,
  }
  return room
}

function createEventDrivenModule(room: TrysteroRoomLike, socket: FakeSocket) {
  let rootReady: ((event: { relayUrl: string; socket: FakeSocket }) => void) | null = null
  let eventCounter = 0
  const relayUrl = 'wss://relay.example'
  const module = {
    selfId: 'transport-peer-secret',
    joinRoom: vi.fn(() => room),
    getRelaySockets: vi.fn(() => ({ [relayUrl]: socket })),
    createEvent: vi.fn(async (topic: string, content: string) => JSON.stringify([
      'EVENT',
      {
        id: `event-${++eventCounter}`,
        content,
        tags: [['x', topic]],
      },
    ])),
    subscribe: vi.fn((subscriptionId: string, topic: string) => JSON.stringify([
      'REQ',
      subscriptionId,
      { '#x': [topic] },
    ])),
    onRootSubscriptionReady: vi.fn((listener: (event: { relayUrl: string; socket: FakeSocket }) => void) => {
      rootReady = listener
      return () => {
        rootReady = null
      }
    }),
  }

  return {
    module: module as unknown as TrysteroNostrModuleLike,
    relayUrl,
    triggerRootReady() {
      rootReady?.({ relayUrl, socket })
    },
  }
}

function diagnosticsFrom(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls
    .filter((call) => call[0] === '[party-network]')
    .map((call) => call[1] as Record<string, unknown>)
}

describe('event-driven production Nostr rendezvous', () => {
  it('wakes an already-running host only after the guest root subscription is ready', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    try {
      const socket = new FakeSocket()
      const room = createRoom()
      const fake = createEventDrivenModule(room, socket)
      const transport = new TrysteroNostrTransport({
        role: 'guest',
        partyId: 'party-secret',
        rendezvousCapability: 'rendezvous-secret',
        loadModule: async () => fake.module,
        poisonRegistry: new Set(),
      })

      await transport.start()
      expect(socket.sent).toEqual([])

      fake.triggerRootReady()
      await Promise.resolve()

      const diagnostics = diagnosticsFrom(info)
      expect(diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          stage: 'guest-rendezvous-ready',
          role: 'guest',
          relayUrl: fake.relayUrl,
          readyRelayCount: 1,
          openRelayCount: 1,
          relayCount: 1,
        }),
        expect.objectContaining({
          stage: 'guest-wake-sent',
          role: 'guest',
          relayUrl: fake.relayUrl,
          wakeIndex: 1,
          readyRelayCount: 1,
        }),
      ]))
      expect(socket.sent).toHaveLength(1)

      const output = JSON.stringify(info.mock.calls)
      expect(output).not.toContain('party-secret')
      expect(output).not.toContain('rendezvous-secret')
      expect(output).not.toContain('transport-peer-secret')
    } finally {
      info.mockRestore()
    }
  })

  it('marks the host ready and re-announces immediately when a bounded wake arrives', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    try {
      const socket = new FakeSocket()
      const room = createRoom()
      const fake = createEventDrivenModule(room, socket)
      const transport = new TrysteroNostrTransport({
        role: 'host',
        partyId: 'party-secret',
        rendezvousCapability: 'rendezvous-secret',
        loadModule: async () => fake.module,
        poisonRegistry: new Set(),
      })

      await transport.start()
      const wakeReq = socket.sent.map((message) => JSON.parse(message) as unknown[])
        .find((message) => message[0] === 'REQ')
      expect(wakeReq).toBeDefined()
      const wakeSubscriptionId = wakeReq?.[1] as string
      const wakeFilter = wakeReq?.[2] as { '#x': string[] }
      const wakeTopic = wakeFilter['#x'][0]

      fake.triggerRootReady()
      socket.emitMessage(JSON.stringify(['EOSE', wakeSubscriptionId]))

      let diagnostics = diagnosticsFrom(info)
      expect(diagnostics).toContainEqual(expect.objectContaining({
        stage: 'host-rendezvous-ready',
        role: 'host',
        relayUrl: fake.relayUrl,
        readyRelayCount: 1,
        openRelayCount: 1,
        relayCount: 1,
      }))

      socket.emitMessage(JSON.stringify([
        'EVENT',
        wakeSubscriptionId,
        {
          id: 'wake-event-id',
          content: JSON.stringify({ type: 'wake', version: 1 }),
          tags: [['x', wakeTopic]],
        },
      ]))
      await Promise.resolve()
      await Promise.resolve()

      diagnostics = diagnosticsFrom(info)
      expect(diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          stage: 'host-wake-received',
          role: 'host',
          relayUrl: fake.relayUrl,
          openRelayCount: 1,
        }),
        expect.objectContaining({
          stage: 'host-reannounce-sent',
          role: 'host',
          openRelayCount: 1,
          attemptedRelayCount: 1,
        }),
      ]))

      const output = JSON.stringify(info.mock.calls)
      expect(output).not.toContain('party-secret')
      expect(output).not.toContain('rendezvous-secret')
      expect(output).not.toContain('transport-peer-secret')
      expect(output).not.toContain('wake-event-id')
    } finally {
      info.mockRestore()
    }
  })

  it('logs peer count and one privacy-safe RTC path summary after WebRTC connects', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    try {
      const stats = new Map<string, Record<string, unknown>>([
        ['pair', {
          id: 'pair',
          type: 'candidate-pair',
          state: 'succeeded',
          nominated: true,
          localCandidateId: 'local',
          remoteCandidateId: 'remote',
          currentRoundTripTime: 0.012,
        }],
        ['local', { id: 'local', type: 'local-candidate', candidateType: 'host' }],
        ['remote', { id: 'remote', type: 'remote-candidate', candidateType: 'srflx' }],
      ])
      const peer = {
        connectionState: 'connected',
        iceConnectionState: 'connected',
        close: vi.fn(),
        getStats: vi.fn(async () => stats),
      } as unknown as RTCPeerConnection
      const socket = new FakeSocket()
      const room = createRoom(peer)
      const fake = createEventDrivenModule(room, socket)
      const transport = new TrysteroNostrTransport({
        role: 'guest',
        partyId: 'party-secret',
        rendezvousCapability: 'rendezvous-secret',
        loadModule: async () => fake.module,
        poisonRegistry: new Set(),
      })

      await transport.start()
      room.onPeerJoin?.('peer-secret')
      await Promise.resolve()
      await Promise.resolve()

      const diagnostics = diagnosticsFrom(info)
      expect(diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ stage: 'peer-joined', peerCount: 1 }),
        expect.objectContaining({
          stage: 'rtc-path',
          localCandidateType: 'host',
          remoteCandidateType: 'srflx',
          roundTripTimeMs: 12,
          usesTurn: false,
        }),
      ]))

      const output = JSON.stringify(info.mock.calls)
      expect(output).not.toContain('peer-secret')
      expect(output).not.toContain('party-secret')
      expect(output).not.toContain('rendezvous-secret')
    } finally {
      info.mockRestore()
    }
  })
})
