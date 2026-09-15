import { describe, expect, it } from 'vitest'
import {
  createInitialGuestPartyRecord,
  isValidGuestPartyRecord,
  sanitizeGuestPartyRecord,
} from './guestPartyStore'

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

  it('keeps valid authentication material while discarding a corrupt non-authoritative replica cache', () => {
    const record = createInitialGuestPartyRecord({
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      hostFingerprint: 'sha256:host-a',
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    })
    const corrupted = {
      ...record,
      incarnationId: 'inc-a',
      memberId: 'member-a',
      label: 'Guest 1',
      canonicalSequence: -99,
      nextRequestSequence: -3,
      locked: true,
      members: [{ memberId: 'member-a', label: 'Guest 1', removed: false }],
      messages: [{ nope: true }],
    }

    expect(sanitizeGuestPartyRecord(corrupted)).toEqual({
      ...record,
      incarnationId: 'inc-a',
      memberId: 'member-a',
      label: 'Guest 1',
      canonicalSequence: 0,
      nextRequestSequence: 1,
      locked: false,
      members: [],
      messages: [],
    })
  })

  it('fails closed when durable guest authentication material is missing or malformed', () => {
    const record = createInitialGuestPartyRecord({
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      hostFingerprint: 'sha256:host-a',
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    })

    expect(sanitizeGuestPartyRecord({ ...record, credentialSecret: '' })).toBeNull()
    expect(sanitizeGuestPartyRecord({ ...record, hostFingerprint: '' })).toBeNull()
    expect(sanitizeGuestPartyRecord({ ...record, rendezvousCapability: '' })).toBeNull()
  })
})
