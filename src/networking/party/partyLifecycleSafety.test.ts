import { describe, expect, it, vi } from 'vitest'
import { HostPartyAuthority } from './hostPartyAuthority'
import {
  createInitialHostPartyRecord,
  type HostPartyRecord,
  type HostPartyStore,
} from './hostPartyStore'
import { HostPartySession, type PartyTransportClient } from './PartySession'
import type { HostPartyLockLease } from './hostPartyLock'

class MemoryHostStore implements HostPartyStore {
  value: HostPartyRecord | null = null
  async load(partyId: string) { return this.value?.partyId === partyId ? this.value : null }
  async save(record: HostPartyRecord) { this.value = record }
}

class DisposalTransport implements PartyTransportClient {
  constructor(private readonly requiresReload: boolean) {}
  async start() {}
  async send() {}
  peerIds() { return [] }
  disconnectPeer() {}
  async dispose() { return { requiresReload: this.requiresReload } }
}

async function setup(requiresReload: boolean) {
  const store = new MemoryHostStore()
  const record = await createInitialHostPartyRecord({ partyId: 'party-a' })
  const authority = await HostPartyAuthority.create(store, record)
  const release = vi.fn()
  const lock: HostPartyLockLease = {
    name: 'coolgamesplus:party-host:party-a',
    release,
    released: Promise.resolve(),
  }
  const session = new HostPartySession({
    authority,
    transport: new DisposalTransport(requiresReload),
    lock,
    origin: 'https://coolgamesplus.com',
  })
  return { authority, release, session }
}

describe('host party teardown safety', () => {
  it('closes host authority before teardown and keeps the writer lock when Trystero requires a page reload', async () => {
    const { authority, release, session } = await setup(true)

    await expect(session.dispose()).resolves.toEqual({ requiresReload: true })

    expect(release).not.toHaveBeenCalled()
    await expect(authority.setAdmissionLocked(true)).rejects.toThrow(/closed|disposed/i)
  })

  it('releases the writer lock after a clean transport teardown', async () => {
    const { authority, release, session } = await setup(false)

    await expect(session.dispose()).resolves.toEqual({ requiresReload: false })

    expect(release).toHaveBeenCalledTimes(1)
    await expect(authority.setAdmissionLocked(true)).rejects.toThrow(/closed|disposed/i)
  })
})
