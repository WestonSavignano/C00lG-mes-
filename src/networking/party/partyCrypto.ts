import { PARTY_PROTOCOL_GENERATION } from './partyTypes'

const encoder = new TextEncoder()
const ECDSA_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const
const ECDSA_SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' } as const

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function sha256(bytes: BufferSource) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
}

export function generateCapability() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export function generatePartyId() {
  return `party_${generateCapability()}`
}

export function generateIncarnationId() {
  return `inc_${generateCapability()}`
}

export function generateTransportAttemptId() {
  return `attempt_${generateCapability()}`
}

export function generateCredentialId() {
  return `credential_${generateCapability()}`
}

export async function generateHostKeyPair() {
  return crypto.subtle.generateKey(ECDSA_ALGORITHM, false, ['sign', 'verify']) as Promise<CryptoKeyPair>
}

export async function exportHostPublicKey(publicKey: CryptoKey) {
  const exported = await crypto.subtle.exportKey('spki', publicKey)
  return toBase64Url(new Uint8Array(exported))
}

export async function importHostPublicKey(exported: string) {
  return crypto.subtle.importKey(
    'spki',
    fromBase64Url(exported),
    ECDSA_ALGORITHM,
    true,
    ['verify'],
  )
}

export async function fingerprintHostPublicKey(publicKey: CryptoKey) {
  const exported = await crypto.subtle.exportKey('spki', publicKey)
  return `sha256:${toBase64Url(await sha256(exported))}`
}

export type HostProofChallengeInput = {
  partyId: string
  incarnationId: string
  guestNonce: string
  hostNonce: string
  transportAttemptId: string
}

export function createHostProofChallenge(input: HostProofChallengeInput) {
  return encoder.encode(JSON.stringify({
    protocol: PARTY_PROTOCOL_GENERATION,
    partyId: input.partyId,
    incarnationId: input.incarnationId,
    guestNonce: input.guestNonce,
    hostNonce: input.hostNonce,
    transportAttemptId: input.transportAttemptId,
  }))
}

export async function signHostProof(privateKey: CryptoKey, challenge: Uint8Array) {
  const signature = await crypto.subtle.sign(ECDSA_SIGN_ALGORITHM, privateKey, challenge)
  return toBase64Url(new Uint8Array(signature))
}

export async function verifyHostProof(publicKey: CryptoKey, challenge: Uint8Array, signature: string) {
  try {
    return await crypto.subtle.verify(
      ECDSA_SIGN_ALGORITHM,
      publicKey,
      fromBase64Url(signature),
      challenge,
    )
  } catch {
    return false
  }
}

async function deriveVerifier(namespace: string, secret: string) {
  const digest = await sha256(encoder.encode(`${namespace}\u0000${secret}`))
  return `sha256:${toBase64Url(digest)}`
}

export function deriveCredentialVerifier(secret: string) {
  return deriveVerifier('coolgamesplus-member-v1', secret)
}

export function deriveAdmissionVerifier(secret: string) {
  return deriveVerifier('coolgamesplus-admission-v1', secret)
}

export function secureVerifierEquals(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}
