import { describe, expect, it, vi } from 'vitest'
import {
  TrysteroNostrTransport,
  type TrysteroNostrModuleLike,
  type TrysteroRoomLike,
} from './trysteroNostrTransport'

function closedRoom() {
  const peer = {
    connectionState: 'closed' as RTCPeerConnectionState,
    iceConnectionState: 'closed' as RTCIceConnectionState,
    close: vi.fn(),
  }
  const action = {
    send: vi.fn(async () => undefined),
    onMessage: null as ((data: string, context: { peerId: string }) => void | Promise<void>) | null,
  }
  const room: TrysteroRoomLike = {
    makeAction: vi.fn(() => action),
    leave: vi.fn(async () => undefined),
    isPassive: vi.fn(() => false),
    getPeers: vi.fn(() => ({ peer: peer as unknown as RTCPeerConnection })),
    onPeerJoin: null,
    onPeerLeave: null,
  }
  return { room, action }
}

describe('TrysteroNostrTransport stranded-room containment', () => {
  it('rejects new application handshakes after an unsafe room is disposed', async () => {
    const fake = closedRoom()
    let callbacks: Parameters<TrysteroNostrModuleLike['joinRoom']>[2]
    const module: TrysteroNostrModuleLike = {
      joinRoom: vi.fn((_config, _roomId, suppliedCallbacks) => {
        callbacks = suppliedCallbacks
        return fake.room
      }),
    }
    const applicationHandshake = vi.fn(async () => undefined)
    const transport = new TrysteroNostrTransport({
      role: 'host',
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      onPeerHandshake: applicationHandshake,
      loadModule: async () => module,
      poisonRegistry: new Set(),
    })
    await transport.start()

    await expect(transport.dispose()).resolves.toEqual({ requiresReload: true })

    await expect(callbacks!.onPeerHandshake?.(
      'late-peer',
      async () => undefined,
      async () => ({ data: 'ignored' }),
      true,
    )).rejects.toThrow(/disposed|inactive|closed/i)
    expect(applicationHandshake).not.toHaveBeenCalled()
    expect(fake.room.leave).not.toHaveBeenCalled()
  })
})
