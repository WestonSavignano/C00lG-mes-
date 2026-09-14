import { describe, expect, it } from 'vitest'
import {
  createHostProofChallenge,
  deriveCredentialVerifier,
  exportHostPublicKey,
  fingerprintHostPublicKey,
  generateCapability,
  generateHostKeyPair,
  importHostPublicKey,
  signHostProof,
  verifyHostProof,
} from './partyCrypto'

describe('party crypto', () => {
  it('creates a per-party non-extractable P-256 host private key with an exportable public key', async () => {
    const keyPair = await generateHostKeyPair()

    expect(keyPair.privateKey.algorithm).toMatchObject({ name: 'ECDSA', namedCurve: 'P-256' })
    expect(keyPair.privateKey.extractable).toBe(false)
    expect(keyPair.publicKey.extractable).toBe(true)
    await expect(crypto.subtle.exportKey('pkcs8', keyPair.privateKey)).rejects.toThrow()
  })

  it('fingerprints the canonical exported host public key deterministically', async () => {
    const keyPair = await generateHostKeyPair()
    const exported = await exportHostPublicKey(keyPair.publicKey)
    const imported = await importHostPublicKey(exported)

    expect(await fingerprintHostPublicKey(imported)).toBe(await fingerprintHostPublicKey(keyPair.publicKey))
    expect(await fingerprintHostPublicKey(keyPair.publicKey)).toMatch(/^sha256:[A-Za-z0-9_-]+$/)
  })

  it('binds host proof to party, incarnation, nonces, and the transport attempt', async () => {
    const keyPair = await generateHostKeyPair()
    const challenge = createHostProofChallenge({
      partyId: 'party-a',
      incarnationId: 'incarnation-a',
      guestNonce: 'guest-nonce-a',
      hostNonce: 'host-nonce-a',
      transportAttemptId: 'attempt-a',
    })
    const signature = await signHostProof(keyPair.privateKey, challenge)

    expect(await verifyHostProof(keyPair.publicKey, challenge, signature)).toBe(true)
    expect(await verifyHostProof(
      keyPair.publicKey,
      createHostProofChallenge({
        partyId: 'party-a',
        incarnationId: 'incarnation-a',
        guestNonce: 'guest-nonce-a',
        hostNonce: 'host-nonce-a',
        transportAttemptId: 'attempt-b',
      }),
      signature,
    )).toBe(false)
  })

  it('generates independent 256-bit bearer capabilities and stable credential verifiers', async () => {
    const first = generateCapability()
    const second = generateCapability()

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first).not.toBe(second)
    expect(await deriveCredentialVerifier(first)).toBe(await deriveCredentialVerifier(first))
    expect(await deriveCredentialVerifier(first)).not.toBe(await deriveCredentialVerifier(second))
  })
})
