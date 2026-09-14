import { describe, expect, it, vi } from 'vitest'
import {
  createInitialGuestPartyRecord,
  type GuestPartyRecord,
  type GuestPartyStore,
} from './guestPartyStore'
import type { HostPartyRecord, HostPartyStore } from './hostPartyStore'
import { createBrowserPartySessionFactory } from './createPartySession'
import type { HostPartyLockLease } from './hostPartyLock'
import type { PartyTransportClient } from './PartySession'
import type { TrysteroNostrTransportOptions } from './trysteroNostrTransport'

class MemoryGuestStore implements GuestPartyStore {
  constructor(public value: GuestPartyRecord | null) {}
  async load(partyId: string) {
    return this.value?.partyId === partyId ? this.value : null
  }
  async save(record: GuestPartyRecord) { this.value = record }
  async delete() { this.value = null }
}

class MemoryHostStore implements HostPartyStore {
  value: HostPartyRecord | null = null
  async load(partyId: string) { return this.value?.partyId === partyId ? this.value : null }
  async save(record: HostPartyRecord) { this.value = record }
}

class NoopTransport implements PartyTransportClient {
  async start() {}
  async send() {}
  peerIds() { return [] }
  disconnectPeer() {}
  async dispose() { return { requiresReload: false } }
}

class FailingTransport implements PartyTransportClient {
  readonly dispose = vi.fn(async () => ({ requiresReload: this.requiresReload }))
  constructor(private readonly requiresReload = false) {}
  async start(): Promise<void> { throw new Error('rendezvous startup failed') }
  async send() {}
  peerIds() { return [] }
  disconnectPeer() {}
}

function route(overrides: Partial<{
  rendezvousCapability: string
  admissionCapability: string
  hostFingerprint: string
}> = {}) {
  return {
    kind: 'guest-invite' as const,
    partyId: 'party-a',
    rendezvousCapability: 'rendezvous-a',
    admissionCapability: 'admission-new',
    hostFingerprint: 'sha256:host-a',
    ...overrides,
  }
}

function factory(guestStore: GuestPartyStore) {
  return createBrowserPartySessionFactory({
    guestStore,
    transportFactory: (_options: TrysteroNostrTransportOptions) => new NoopTransport(),
    requestPersistentStorage: async () => undefined,
  })
}

function lockLease(release = vi.fn()): HostPartyLockLease {
  return {
    name: 'coolgamesplus:party-host:test',
    release,
    released: Promise.resolve(),
  }
}

describe('createBrowserPartySessionFactory guest invite behavior', () => {
  it('reuses an existing pinned member record instead of minting fresh credentials from an invite', async () => {
    const durable = {
      ...createInitialGuestPartyRecord({
        partyId: 'party-a',
        rendezvousCapability: 'rendezvous-a',
        hostFingerprint: 'sha256:host-a',
        credentialId: 'credential-existing',
        credentialSecret: 'secret-existing',
      }),
      incarnationId: 'incarnation-a',
      memberId: 'member-existing',
      label: 'Guest 1',
      nextRequestSequence: 4,
    }
    const store = new MemoryGuestStore(durable)

    const started = await factory(store).joinGuestInvite(route())

    expect(started.session.getSnapshot()).toMatchObject({
      role: 'guest',
      partyId: 'party-a',
      localMemberId: 'member-existing',
      localLabel: 'Guest 1',
    })
    expect(store.value).toMatchObject({
      credentialId: 'credential-existing',
      credentialSecret: 'secret-existing',
      memberId: 'member-existing',
    })
  })

  it('fails closed when an invite conflicts with the durable host pin or rendezvous capability', async () => {
    const durable = {
      ...createInitialGuestPartyRecord({
        partyId: 'party-a',
        rendezvousCapability: 'rendezvous-a',
        hostFingerprint: 'sha256:host-a',
        credentialId: 'credential-existing',
        credentialSecret: 'secret-existing',
      }),
      incarnationId: 'incarnation-a',
      memberId: 'member-existing',
      label: 'Guest 1',
    }
    const store = new MemoryGuestStore(durable)
    const sessionFactory = factory(store)

    await expect(sessionFactory.joinGuestInvite(route({ hostFingerprint: 'sha256:other-host' })))
      .rejects.toThrow(/different host/i)
    await expect(sessionFactory.joinGuestInvite(route({ rendezvousCapability: 'other-rendezvous' })))
      .rejects.toThrow(/rendezvous/i)
  })
})

describe('createBrowserPartySessionFactory startup cleanup', () => {
  it('disposes a guest transport generation when rendezvous startup fails', async () => {
    const transport = new FailingTransport()
    const sessionFactory = createBrowserPartySessionFactory({
      guestStore: new MemoryGuestStore(null),
      transportFactory: () => transport,
      requestPersistentStorage: async () => undefined,
    })

    await expect(sessionFactory.joinGuestInvite(route())).rejects.toThrow(/rendezvous startup failed/i)
    expect(transport.dispose).toHaveBeenCalledTimes(1)
  })

  it('closes host authority and releases the writer lock after a clean failed-start teardown', async () => {
    const transport = new FailingTransport(false)
    const release = vi.fn()
    const sessionFactory = createBrowserPartySessionFactory({
      hostStore: new MemoryHostStore(),
      acquireLock: async () => lockLease(release),
      transportFactory: () => transport,
      requestPersistentStorage: async () => undefined,
    })

    await expect(sessionFactory.startHost()).rejects.toThrow(/rendezvous startup failed/i)
    expect(transport.dispose).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('retains the host writer lock when failed startup cannot tear down safely', async () => {
    const transport = new FailingTransport(true)
    const release = vi.fn()
    const sessionFactory = createBrowserPartySessionFactory({
      hostStore: new MemoryHostStore(),
      acquireLock: async () => lockLease(release),
      transportFactory: () => transport,
      requestPersistentStorage: async () => undefined,
    })

    await expect(sessionFactory.startHost()).rejects.toThrow(/reload/i)
    expect(transport.dispose).toHaveBeenCalledTimes(1)
    expect(release).not.toHaveBeenCalled()
  })
})
