import { describe, expect, it, vi } from 'vitest'
import {
  TrysteroNostrTransport,
  type TrysteroNostrModuleLike,
  type TrysteroRoomLike,
} from './trysteroNostrTransport'

function createFakeRoom(input: { leaveRejects?: boolean; peerState?: RTCPeerConnectionState } = {}) {
  const sent: Array<{ data: string; target: string | string[] | null | undefined }> = []
  const action = {
    send: vi.fn(async (data: string, options?: { target?: string | string[] | null }) => {
      sent.push({ data, target: options?.target })
    }),
    onMessage: null as ((data: string, context: { peerId: string }) => void | Promise<void>) | null,
  }
  const peer = input.peerState
    ? { connectionState: input.peerState, close: vi.fn() }
    : null
  const room: TrysteroRoomLike = {
    makeAction: vi.fn(() => action),
    leave: input.leaveRejects
      ? vi.fn(async () => { throw new Error('data channel closed') })
      : vi.fn(async () => undefined),
    isPassive: vi.fn(() => false),
    getPeers: vi.fn(() => peer ? { peer: peer as unknown as RTCPeerConnection } : {}),
    onPeerJoin: null,
    onPeerLeave: null,
  }
  return { room, action, sent }
}

function createModule(room: TrysteroRoomLike) {
  const joinRoom = vi.fn(() => room)
  return { module: { joinRoom } as TrysteroNostrModuleLike, joinRoom }
}

describe('TrysteroNostrTransport', () => {
  it('uses the reviewed active-host/passive-guest Nostr configuration with a pinned relay pool and no TURN', async () => {
    const hostRoom = createFakeRoom()
    const hostModule = createModule(hostRoom.room)
    const host = new TrysteroNostrTransport({
      role: 'host',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      loadModule: async () => hostModule.module,
      poisonRegistry: new Set(),
    })
    await host.start()

    expect(hostModule.joinRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'coolgamesplus-party-v2',
        password: 'rendezvous-a',
        passive: false,
        trickleIce: true,
        relayConfig: {
          urls: [
            'wss://relay02.lnfi.network',
            'wss://nostr.data.haus',
            'wss://relay-can.zombi.cloudrodion.com',
            'wss://yabu.me/v2',
          ],
          manualReconnection: false,
          warnOnRelayFailure: true,
        },
      }),
      'party-a',
      expect.any(Object),
    )
    expect(hostModule.joinRoom.mock.calls[0]?.[0]).not.toHaveProperty('turnConfig')
    expect(hostModule.joinRoom.mock.calls[0]?.[0].relayConfig).not.toHaveProperty('redundancy')

    const guestRoom = createFakeRoom()
    const guestModule = createModule(guestRoom.room)
    const guest = new TrysteroNostrTransport({
      role: 'guest',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      loadModule: async () => guestModule.module,
      poisonRegistry: new Set(),
    })
    await guest.start()
    expect(guestModule.joinRoom.mock.calls[0]?.[0]).toMatchObject({ passive: true })
  })

  it('emits privacy-safe diagnostics across transport, handshake, join-error, and peer-join boundaries', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const fake = createFakeRoom()
      const module = createModule(fake.room)
      const transport = new TrysteroNostrTransport({
        role: 'guest',
        partyId: 'party-secret',
        rendezvousCapability: 'rendezvous-secret',
        onPeerHandshake: async () => undefined,
        loadModule: async () => module.module,
        poisonRegistry: new Set(),
      })

      await transport.start()
      const callbacks = module.joinRoom.mock.calls[0]?.[2]
      expect(callbacks).toBeDefined()

      await callbacks?.onPeerHandshake?.(
        'peer-secret',
        async () => undefined,
        async () => ({ data: 'ignored' }),
        false,
      )
      callbacks?.onJoinError?.({ error: 'handshake timed out', peerId: 'peer-secret' })
      fake.room.onPeerJoin?.('peer-secret')

      const output = JSON.stringify([...info.mock.calls, ...warn.mock.calls])
      expect(output).toContain('transport-started')
      expect(output).toContain('handshake-started')
      expect(output).toContain('handshake-accepted')
      expect(output).toContain('join-error')
      expect(output).toContain('peer-joined')
      expect(output).toContain('handshake timed out')
      expect(output).not.toContain('peer-secret')
      expect(output).not.toContain('party-secret')
      expect(output).not.toContain('rendezvous-secret')
    } finally {
      info.mockRestore()
      warn.mockRestore()
    }
  })

  it('targets guest application traffic only at the authenticated host peer', async () => {
    const fake = createFakeRoom()
    const module = createModule(fake.room)
    const guest = new TrysteroNostrTransport({
      role: 'guest',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      loadModule: async () => module.module,
      poisonRegistry: new Set(),
    })
    await guest.start()

    await guest.send('hello', 'host-peer')

    expect(fake.sent).toEqual([{ data: 'hello', target: 'host-peer' }])
  })

  it('does not create overlapping in-page room generations', async () => {
    const fake = createFakeRoom()
    const module = createModule(fake.room)
    const transport = new TrysteroNostrTransport({
      role: 'host',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      loadModule: async () => module.module,
      poisonRegistry: new Set(),
    })

    await Promise.all([transport.start(), transport.start()])

    expect(module.joinRoom).toHaveBeenCalledTimes(1)
  })

  it('permits a clean leave/rejoin only after the previous room generation fully disposes', async () => {
    const poisonRegistry = new Set<string>()
    const firstFake = createFakeRoom()
    const firstModule = createModule(firstFake.room)
    const first = new TrysteroNostrTransport({
      role: 'host',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      loadModule: async () => firstModule.module,
      poisonRegistry,
    })
    await first.start()

    await expect(first.dispose()).resolves.toEqual({ requiresReload: false })
    expect(firstFake.room.leave).toHaveBeenCalledTimes(1)

    const secondFake = createFakeRoom()
    const secondModule = createModule(secondFake.room)
    const second = new TrysteroNostrTransport({
      role: 'host',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      loadModule: async () => secondModule.module,
      poisonRegistry,
    })
    await expect(second.start()).resolves.toBeUndefined()
  })

  it('contains Trystero issue #195 by poisoning a failed leave instead of silently reusing the stranded room', async () => {
    const poisonRegistry = new Set<string>()
    const fake = createFakeRoom({ leaveRejects: true })
    const module = createModule(fake.room)
    const first = new TrysteroNostrTransport({
      role: 'host',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      loadModule: async () => module.module,
      poisonRegistry,
    })
    await first.start()

    await expect(first.dispose()).resolves.toEqual({ requiresReload: true })

    const replacement = new TrysteroNostrTransport({
      role: 'host',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      loadModule: async () => module.module,
      poisonRegistry,
    })
    await expect(replacement.start()).rejects.toThrow('reload this page')
    expect(module.joinRoom).toHaveBeenCalledTimes(1)
  })

  it('does not call room.leave when a peer connection is already failed/closed and therefore known unsafe for issue #195', async () => {
    const poisonRegistry = new Set<string>()
    const fake = createFakeRoom({ peerState: 'closed' })
    const module = createModule(fake.room)
    const transport = new TrysteroNostrTransport({
      role: 'guest',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      loadModule: async () => module.module,
      poisonRegistry,
    })
    await transport.start()

    await expect(transport.dispose()).resolves.toEqual({ requiresReload: true })
    expect(fake.room.leave).not.toHaveBeenCalled()
  })
})
