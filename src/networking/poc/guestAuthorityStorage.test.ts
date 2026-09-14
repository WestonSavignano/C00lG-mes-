import { describe, expect, it } from 'vitest'
import {
  loadOrCreateGuestAuthority,
  saveGuestAuthority,
  type GuestAuthorityCredentials,
} from './guestAuthorityStorage'
import type { StorageLike } from './trysteroPocModel'

const PARTY_ID = '11111111-1111-4111-8111-111111111111'
const HOST_ID = '33333333-3333-4333-8333-333333333333'
const CREDENTIAL_ID = '44444444-4444-4444-8444-444444444444'
const CREDENTIAL_SECRET = '55555555-5555-4555-8555-555555555555'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('guest authority persistence', () => {
  it('restores the same durable credential and last canonical sequence', () => {
    const storage = new MemoryStorage()
    const created = loadOrCreateGuestAuthority(storage, PARTY_ID, HOST_ID, () => CREDENTIAL_ID, () => CREDENTIAL_SECRET)
    const saved: GuestAuthorityCredentials = {
      ...created,
      memberId: '66666666-6666-4666-8666-666666666666',
      lastCanonicalSequence: 42,
      nextClientSequence: 8,
    }
    saveGuestAuthority(storage, saved)

    expect(loadOrCreateGuestAuthority(storage, PARTY_ID, HOST_ID, () => '77777777-7777-4777-8777-777777777777', () => '88888888-8888-4888-8888-888888888888')).toEqual(saved)
  })

  it('rejects a cache pinned to a different host instead of merging it', () => {
    const storage = new MemoryStorage()
    const created = loadOrCreateGuestAuthority(storage, PARTY_ID, HOST_ID, () => CREDENTIAL_ID, () => CREDENTIAL_SECRET)
    saveGuestAuthority(storage, created)

    expect(() => loadOrCreateGuestAuthority(
      storage,
      PARTY_ID,
      '99999999-9999-4999-8999-999999999999',
      () => CREDENTIAL_ID,
      () => CREDENTIAL_SECRET,
    )).toThrow('pinned to a different host')
  })

  it('replaces malformed cached data with a fresh durable identity', () => {
    const storage = new MemoryStorage()
    storage.setItem(`c00lgames.poc.authority.guest.${PARTY_ID}`, '{broken')

    const restored = loadOrCreateGuestAuthority(storage, PARTY_ID, HOST_ID, () => CREDENTIAL_ID, () => CREDENTIAL_SECRET)
    expect(restored).toMatchObject({
      partyId: PARTY_ID,
      hostAppIdentity: HOST_ID,
      credentialId: CREDENTIAL_ID,
      credentialSecret: CREDENTIAL_SECRET,
      memberId: null,
      lastCanonicalSequence: 0,
      nextClientSequence: 1,
    })
  })

  it('throws when local storage is unavailable instead of inventing transient authority', () => {
    const storage: StorageLike = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
      removeItem() { throw new Error('blocked') },
    }

    expect(() => loadOrCreateGuestAuthority(storage, PARTY_ID, HOST_ID, () => CREDENTIAL_ID, () => CREDENTIAL_SECRET)).toThrow('Guest durable storage unavailable')
  })
})
