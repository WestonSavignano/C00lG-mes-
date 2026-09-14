import { describe, expect, it } from 'vitest'
import {
  HOST_PARTY_STORAGE_SCHEMA_VERSION,
  PARTY_PROTOCOL_GENERATION,
} from './partyTypes'
import {
  createInitialHostPartyRecord,
  isValidHostPartyRecord,
  validateHostPartyCryptography,
} from './hostPartyStore'
import { deriveAdmissionVerifier } from './partyCrypto'

describe('host party durable state', () => {
  it('creates complete per-party canonical authority with a non-extractable host key', async () => {
    const record = await createInitialHostPartyRecord({ partyId: 'party-a' })

    expect(record.storageSchemaVersion).toBe(HOST_PARTY_STORAGE_SCHEMA_VERSION)
    expect(record.protocolGeneration).toBe(PARTY_PROTOCOL_GENERATION)
    expect(record.partyId).toBe('party-a')
    expect(record.incarnationId).toMatch(/^inc_/)
    expect(record.hostPrivateKey.extractable).toBe(false)
    expect(record.hostPublicKey).not.toBe('')
    expect(record.hostFingerprint).toMatch(/^sha256:/)
    expect(record.rendezvousCapability).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(record.admissionCapability).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(record.admissionVerifier).toBe(await deriveAdmissionVerifier(record.admissionCapability ?? ''))
    expect(record.locked).toBe(false)
    expect(record.canonicalSequence).toBe(0)
    expect(record.members).toEqual([])
    expect(record.history).toEqual([])
    expect(isValidHostPartyRecord(record)).toBe(true)
    expect(await validateHostPartyCryptography(record)).toBe(true)
  })

  it('fails structural validation for corrupt, incompatible, or incomplete canonical authority', async () => {
    const record = await createInitialHostPartyRecord({ partyId: 'party-a' })

    expect(isValidHostPartyRecord({ ...record, canonicalSequence: -1 })).toBe(false)
    expect(isValidHostPartyRecord({ ...record, protocolGeneration: 99 })).toBe(false)
    expect(isValidHostPartyRecord({ ...record, hostPrivateKey: 'copied-url-is-not-authority' })).toBe(false)
    expect(isValidHostPartyRecord({ ...record, locked: true, admissionCapability: record.admissionCapability })).toBe(false)
  })

  it('cryptographically rejects a mismatched host pin, public key, private key, or admission verifier', async () => {
    const record = await createInitialHostPartyRecord({ partyId: 'party-a' })
    const other = await createInitialHostPartyRecord({ partyId: 'party-b' })

    expect(await validateHostPartyCryptography({ ...record, hostFingerprint: other.hostFingerprint })).toBe(false)
    expect(await validateHostPartyCryptography({ ...record, hostPublicKey: other.hostPublicKey })).toBe(false)
    expect(await validateHostPartyCryptography({ ...record, hostPrivateKey: other.hostPrivateKey })).toBe(false)
    expect(await validateHostPartyCryptography({ ...record, admissionVerifier: other.admissionVerifier })).toBe(false)
  })
})
