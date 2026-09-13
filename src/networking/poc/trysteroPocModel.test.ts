import { describe, expect, it } from 'vitest'
import {
  MAX_GUESTS,
  buildPartyUrl,
  buildTrysteroConfig,
  evaluateGuestAdmission,
  loadOrCreateIdentity,
  parsePartyHash,
  validateRemoteHandshake,
  type PocHandshake,
  type StorageLike,
} from './trysteroPocModel'

const PARTY_ID = '11111111-1111-4111-8111-111111111111'
const SECRET = '22222222-2222-4222-8222-222222222222'
const HOST_ID = '33333333-3333-4333-8333-333333333333'
const GUEST_ID = '44444444-4444-4444-8444-444444444444'

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

describe('Trystero POC invite model', () => {
  it('keeps party capability data in the URL fragment', () => {
    const url = buildPartyUrl({
      origin: 'https://preview.example',
      pathname: '/networking-poc/trystero',
      role: 'guest',
      partyId: PARTY_ID,
      secret: SECRET,
      hostId: HOST_ID,
    })

    expect(url.search).toBe('')
    expect(url.hash).toContain(`party=${PARTY_ID}`)
    expect(url.hash).toContain(`secret=${SECRET}`)
    expect(url.hash).toContain(`host=${HOST_ID}`)
    expect(url.hash).toContain('role=guest')
  })

  it('parses valid host and guest routes and rejects incomplete routes', () => {
    expect(parsePartyHash(`#role=host&party=${PARTY_ID}&secret=${SECRET}&host=${HOST_ID}`)).toEqual({
      kind: 'party',
      role: 'host',
      partyId: PARTY_ID,
      secret: SECRET,
      hostId: HOST_ID,
    })

    expect(parsePartyHash(`#role=guest&party=${PARTY_ID}&secret=${SECRET}&host=${HOST_ID}`)).toEqual({
      kind: 'party',
      role: 'guest',
      partyId: PARTY_ID,
      secret: SECRET,
      hostId: HOST_ID,
    })

    expect(parsePartyHash(`#role=guest&party=${PARTY_ID}`)).toEqual({ kind: 'invalid' })
    expect(parsePartyHash('')).toEqual({ kind: 'none' })
  })
})

describe('Trystero POC local identity', () => {
  it('restores a valid persisted identity instead of creating a new one', () => {
    const storage = new MemoryStorage()
    const factoryValues = [GUEST_ID, '55555555-5555-4555-8555-555555555555']
    const factory = () => factoryValues.shift()!

    expect(loadOrCreateIdentity(storage, 'guest-key', factory)).toBe(GUEST_ID)
    expect(loadOrCreateIdentity(storage, 'guest-key', factory)).toBe(GUEST_ID)
  })

  it('replaces malformed persisted identity safely', () => {
    const storage = new MemoryStorage()
    storage.setItem('guest-key', 'not-an-id')

    expect(loadOrCreateIdentity(storage, 'guest-key', () => GUEST_ID)).toBe(GUEST_ID)
    expect(storage.getItem('guest-key')).toBe(GUEST_ID)
  })
})

describe('Trystero POC topology and admission', () => {
  it('configures the host active and guests passive with the shared party secret', () => {
    expect(buildTrysteroConfig('host', SECRET)).toMatchObject({
      password: SECRET,
      passive: false,
    })
    expect(buildTrysteroConfig('guest', SECRET)).toMatchObject({
      password: SECRET,
      passive: true,
    })
  })

  it('caps the party at seven unique guests while allowing the same guest identity to reconnect', () => {
    const active = new Set(Array.from({ length: MAX_GUESTS }, (_, index) => (
      `0000000${index}-0000-4000-8000-00000000000${index}`
    )))

    expect(evaluateGuestAdmission(active, [...active][0]!)).toEqual({
      accepted: true,
      reconnecting: true,
    })
    expect(evaluateGuestAdmission(active, GUEST_ID)).toEqual({
      accepted: false,
      reconnecting: false,
      reason: 'party-full',
    })
  })
})

describe('Trystero POC application handshake', () => {
  const hostHandshake: PocHandshake = {
    version: 1,
    partyId: PARTY_ID,
    role: 'host',
    appIdentity: HOST_ID,
  }

  const guestHandshake: PocHandshake = {
    version: 1,
    partyId: PARTY_ID,
    role: 'guest',
    appIdentity: GUEST_ID,
  }

  it('lets a guest pin the expected logical host independently from the transport peer id', () => {
    expect(validateRemoteHandshake({
      localRole: 'guest',
      partyId: PARTY_ID,
      expectedHostId: HOST_ID,
      handshake: hostHandshake,
    })).toEqual({ ok: true })
  })

  it('rejects a forged host identity or wrong remote role', () => {
    expect(validateRemoteHandshake({
      localRole: 'guest',
      partyId: PARTY_ID,
      expectedHostId: HOST_ID,
      handshake: { ...hostHandshake, appIdentity: GUEST_ID },
    })).toEqual({ ok: false, reason: 'unexpected-host' })

    expect(validateRemoteHandshake({
      localRole: 'host',
      partyId: PARTY_ID,
      expectedHostId: HOST_ID,
      handshake: hostHandshake,
    })).toEqual({ ok: false, reason: 'unexpected-role' })
  })

  it('accepts a valid guest handshake for host-side admission', () => {
    expect(validateRemoteHandshake({
      localRole: 'host',
      partyId: PARTY_ID,
      expectedHostId: HOST_ID,
      handshake: guestHandshake,
    })).toEqual({ ok: true })
  })
})
