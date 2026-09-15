import { describe, expect, it, vi } from 'vitest'
import { createBrowserPartySessionFactory } from './createPartySession'
import type { GuestPartyRecord, GuestPartyStore } from './guestPartyStore'
import type { HostPartyRecord, HostPartyStore } from './hostPartyStore'
import type { HostPartyLockLease } from './hostPartyLock'
import type { PartyTransportClient } from './PartySession'
import {
  TrysteroNostrTransport,
  type TrysteroNostrModuleLike,
  type TrysteroNostrTransportOptions,
  type TrysteroRoomLike,
} from './trysteroNostrTransport'

class MemoryHostStore implements HostPartyStore {
  value: HostPartyRecord | null = null
  async load(partyId: string) { return this.value?.partyId === partyId ? this.value : null }
  async save(record: HostPartyRecord) { this.value = record }
}

class MemoryGuestStore implements GuestPartyStore {
  value: GuestPartyRecord | null = null
  async load(partyId: string) { return this.value?.partyId === partyId ? this.value : null }
  async save(record: GuestPartyRecord) { this.value = record }
  async delete() { this.value = null }
}

class NoopTransport implements PartyTransportClient {
  async start() {}
  async send() {}
  peerIds() { return [] }
  disconnectPeer() {}
  async dispose() { return { requiresReload: false } }
}

function lockLease(): HostPartyLockLease {
  return {
    name: 'coolgamesplus:party-host:test',
    release: vi.fn(),
    released: Promise.resolve(),
  }
}

function guestInvite() {
  return {
    kind: 'guest-invite' as const,
    partyId: 'party-a',
    rendezvousCapability: 'rendezvous-a',
    admissionCapability: 'admission-a',
    hostFingerprint: 'sha256:host-a',
  }
}

function fakeRoom(): TrysteroRoomLike {
  return {
    makeAction: () => ({ send: async () => undefined, onMessage: null }),
    leave: async () => undefined,
    isPassive: () => false,
    getPeers: () => ({}),
    onPeerJoin: null,
    onPeerLeave: null,
  }
}

describe('party diagnostics provenance', () => {
  it('tags transport generations with their session factory source', async () => {
    const hostStore = new MemoryHostStore()
    const guestStore = new MemoryGuestStore()
    const captured: TrysteroNostrTransportOptions[] = []
    const factory = createBrowserPartySessionFactory({
      hostStore,
      guestStore,
      acquireLock: async () => lockLease(),
      transportFactory: (options) => {
        captured.push(options)
        return new NoopTransport()
      },
      requestPersistentStorage: async () => undefined,
    })

    const startedHost = await factory.startHost()
    const hostPartyId = startedHost.session.getSnapshot().partyId
    await startedHost.session.dispose()
    const restoredHost = await factory.restoreHost(hostPartyId)
    await restoredHost.session.dispose()

    const joinedGuest = await factory.joinGuestInvite(guestInvite())
    await joinedGuest.session.dispose()
    const restoredGuest = await factory.restoreGuest('party-a')
    await restoredGuest.session.dispose()

    expect(captured.map((options) => options.diagnosticSource)).toEqual([
      'start-host',
      'restore-host',
      'join-invite',
      'restore-guest',
    ])
  })

  it('emits a privacy-safe structured diagnostic object with the transport source', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    try {
      const room = fakeRoom()
      const module: TrysteroNostrModuleLike = {
        joinRoom: () => room,
        getRelaySockets: () => ({}),
      }
      const transport = new TrysteroNostrTransport({
        role: 'guest',
        diagnosticSource: 'join-invite',
        partyId: 'party-secret',
        rendezvousCapability: 'rendezvous-secret',
        loadModule: async () => module,
        poisonRegistry: new Set(),
      })

      await transport.start()

      const transportStarted = info.mock.calls.find((call) => (
        call[0] === '[party-network]'
        && typeof call[1] === 'object'
        && call[1] !== null
        && (call[1] as { stage?: unknown }).stage === 'transport-started'
      ))
      expect(transportStarted?.[1]).toEqual(expect.objectContaining({
        stage: 'transport-started',
        source: 'join-invite',
      }))
      expect(transportStarted).toHaveLength(2)

      const output = JSON.stringify(transportStarted?.[1])
      expect(output).not.toContain('party-secret')
      expect(output).not.toContain('rendezvous-secret')
    } finally {
      info.mockRestore()
    }
  })
})
