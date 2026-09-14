import { describe, expect, it } from 'vitest'
import { createInitialGuestPartyRecord, isValidGuestPartyRecord } from './guestPartyStore'

describe('guest party durable state', () => {
  it('stores only guest-local credentials, host pin, rendezvous capability, and a non-authoritative cursor/cache', () => {
    const record = createInitialGuestPartyRecord({
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      hostFingerprint: 'sha256:host-a',
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    })

    expect(record).toMatchObject({
      partyId: 'party-a',
      incarnationId: null,
      rendezvousCapability: 'rendezvous-a',
      hostFingerprint: 'sha256:host-a',
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
      memberId: null,
      canonicalSequence: 0,
      nextRequestSequence: 1,
      messages: [],
    })
    expect(isValidGuestPartyRecord(record)).toBe(true)
  })

  it('rejects corrupt cursors, missing credentials, and oversized caches', () => {
    const record = createInitialGuestPartyRecord({
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      hostFingerprint: 'sha256:host-a',
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    })

    expect(isValidGuestPartyRecord({ ...record, canonicalSequence: -1 })).toBe(false)
    expect(isValidGuestPartyRecord({ ...record, credentialSecret: '' })).toBe(false)
    expect(isValidGuestPartyRecord({ ...record, messages: Array.from({ length: 201 }, () => ({
      id: 'id',
      sentAt: 1,
      sender: { memberId: 'host', label: 'Host' },
      text: 'hello',
    })) })).toBe(false)
  })
})
