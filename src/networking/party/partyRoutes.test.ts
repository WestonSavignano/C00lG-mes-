import { describe, expect, it } from 'vitest'
import {
  buildGuestInviteHash,
  buildHostPartyHash,
  buildSanitizedGuestHash,
  parsePartyHash,
} from './partyRoutes'

describe('party routes', () => {
  const partyId = 'party_7pYH5W7oCk9F'
  const rendezvousCapability = 'rendezvous_0123456789abcdefghijklmnopqrstuvwxyz'
  const admissionCapability = 'admission_0123456789abcdefghijklmnopqrstuvwxyz'
  const hostFingerprint = 'sha256:host-fingerprint-0123456789'

  it('builds a durable host route without bearer capabilities', () => {
    const hash = buildHostPartyHash(partyId)

    expect(hash).toBe(`#v=2&party=${partyId}&role=host`)
    expect(hash).not.toContain(rendezvousCapability)
    expect(hash).not.toContain(admissionCapability)
  })

  it('round-trips a guest invite with separate rendezvous, admission, and host-pin fields', () => {
    const hash = buildGuestInviteHash({
      partyId,
      rendezvousCapability,
      admissionCapability,
      hostFingerprint,
    })

    expect(parsePartyHash(hash)).toEqual({
      kind: 'guest-invite',
      partyId,
      rendezvousCapability,
      admissionCapability,
      hostFingerprint,
    })
  })

  it('builds a sanitized durable guest route with no bearer material', () => {
    const hash = buildSanitizedGuestHash(partyId)

    expect(hash).toBe(`#v=2&party=${partyId}&role=guest`)
    expect(parsePartyHash(hash)).toEqual({ kind: 'guest', partyId })
  })

  it('rejects incomplete or unsupported party fragments', () => {
    expect(parsePartyHash('#v=1&party=abc&role=host').kind).toBe('invalid')
    expect(parsePartyHash('#v=2&party=abc&r=rv&host=pin').kind).toBe('invalid')
    expect(parsePartyHash('#v=2&party=abc&a=admit&host=pin').kind).toBe('invalid')
    expect(parsePartyHash('#v=2&party=abc&r=rv&a=admit').kind).toBe('invalid')
  })

  it('treats an empty fragment as no party route', () => {
    expect(parsePartyHash('')).toEqual({ kind: 'none' })
    expect(parsePartyHash('#')).toEqual({ kind: 'none' })
  })
})
