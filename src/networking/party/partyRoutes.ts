import type { PartyRoute } from './partyTypes'

const PARTY_ROUTE_VERSION = '2'
const MAX_FRAGMENT_VALUE_LENGTH = 512

function value(params: URLSearchParams, key: string) {
  const result = params.get(key)
  return result && result.length <= MAX_FRAGMENT_VALUE_LENGTH ? result : null
}

function hash(params: URLSearchParams) {
  return `#${params.toString()}`
}

export function buildHostPartyHash(partyId: string) {
  const params = new URLSearchParams({ v: PARTY_ROUTE_VERSION, party: partyId, role: 'host' })
  return hash(params)
}

export function buildSanitizedGuestHash(partyId: string) {
  const params = new URLSearchParams({ v: PARTY_ROUTE_VERSION, party: partyId, role: 'guest' })
  return hash(params)
}

export function buildGuestInviteHash(input: {
  partyId: string
  rendezvousCapability: string
  admissionCapability: string
  hostFingerprint: string
}) {
  const params = new URLSearchParams({
    v: PARTY_ROUTE_VERSION,
    party: input.partyId,
    r: input.rendezvousCapability,
    a: input.admissionCapability,
    host: input.hostFingerprint,
  })
  return hash(params)
}

export function buildGuestInviteUrl(origin: string, input: Parameters<typeof buildGuestInviteHash>[0]) {
  return `${origin.replace(/\/$/, '')}/chat${buildGuestInviteHash(input)}`
}

export function parsePartyHash(fragment: string): PartyRoute {
  const source = fragment.startsWith('#') ? fragment.slice(1) : fragment
  if (!source) {
    return { kind: 'none' }
  }

  let params: URLSearchParams
  try {
    params = new URLSearchParams(source)
  } catch {
    return { kind: 'invalid', reason: 'invalid-fragment' }
  }

  if (value(params, 'v') !== PARTY_ROUTE_VERSION) {
    return { kind: 'invalid', reason: 'unsupported-version' }
  }

  const partyId = value(params, 'party')
  if (!partyId) {
    return { kind: 'invalid', reason: 'missing-party' }
  }

  const role = value(params, 'role')
  const rendezvousCapability = value(params, 'r')
  const admissionCapability = value(params, 'a')
  const hostFingerprint = value(params, 'host')

  if (role === 'host') {
    if (rendezvousCapability || admissionCapability || hostFingerprint) {
      return { kind: 'invalid', reason: 'host-route-contains-bearer-material' }
    }
    return { kind: 'host', partyId }
  }

  if (role === 'guest') {
    if (rendezvousCapability || admissionCapability || hostFingerprint) {
      return { kind: 'invalid', reason: 'durable-guest-route-contains-bearer-material' }
    }
    return { kind: 'guest', partyId }
  }

  if (role) {
    return { kind: 'invalid', reason: 'invalid-role' }
  }

  if (!rendezvousCapability || !admissionCapability || !hostFingerprint) {
    return { kind: 'invalid', reason: 'incomplete-invite' }
  }

  return {
    kind: 'guest-invite',
    partyId,
    rendezvousCapability,
    admissionCapability,
    hostFingerprint,
  }
}
