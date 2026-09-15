export const MAX_GUESTS = 7
export const TRYSTERO_POC_APP_ID = 'coolgamesplus-trystero-poc-v1'

export type PocRole = 'host' | 'guest'

export type PocPartyRoute =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | {
      kind: 'party'
      role: PocRole
      partyId: string
      secret: string
      hostId: string
    }

export type PocHandshake = {
  version: 1
  partyId: string
  role: PocRole
  appIdentity: string
}

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type GuestAdmission =
  | { accepted: true; reconnecting: boolean }
  | { accepted: false; reconnecting: false; reason: 'invalid-identity' | 'party-full' }

export type HandshakeValidation =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'invalid-handshake'
        | 'wrong-party'
        | 'unexpected-role'
        | 'unexpected-host'
    }

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export function isPocIdentity(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value)
}

export function buildPartyUrl({
  origin,
  pathname,
  role,
  partyId,
  secret,
  hostId,
}: {
  origin: string
  pathname: string
  role: PocRole
  partyId: string
  secret: string
  hostId: string
}) {
  const url = new URL(pathname, origin)
  url.hash = new URLSearchParams({
    role,
    party: partyId,
    secret,
    host: hostId,
  }).toString()
  return url
}

export function parsePartyHash(hash: string): PocPartyRoute {
  const raw = hash.replace(/^#/u, '')
  if (!raw) {
    return { kind: 'none' }
  }

  const params = new URLSearchParams(raw)
  const role = params.get('role')
  const partyId = params.get('party')
  const secret = params.get('secret')
  const hostId = params.get('host')

  if (
    (role !== 'host' && role !== 'guest')
    || !isPocIdentity(partyId)
    || !isPocIdentity(secret)
    || !isPocIdentity(hostId)
  ) {
    return { kind: 'invalid' }
  }

  return {
    kind: 'party',
    role,
    partyId,
    secret,
    hostId,
  }
}

export function parsePocHandshake(value: unknown): PocHandshake | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Partial<Record<keyof PocHandshake, unknown>>
  if (
    candidate.version !== 1
    || !isPocIdentity(candidate.partyId)
    || (candidate.role !== 'host' && candidate.role !== 'guest')
    || !isPocIdentity(candidate.appIdentity)
  ) {
    return null
  }

  return {
    version: 1,
    partyId: candidate.partyId,
    role: candidate.role,
    appIdentity: candidate.appIdentity,
  }
}

export function loadOrCreateIdentity(
  storage: StorageLike,
  storageKey: string,
  createIdentity: () => string = () => crypto.randomUUID(),
) {
  const stored = storage.getItem(storageKey)
  if (isPocIdentity(stored)) {
    return stored
  }

  if (stored !== null) {
    storage.removeItem(storageKey)
  }

  const identity = createIdentity()
  if (!isPocIdentity(identity)) {
    throw new Error('Identity factory returned an invalid identity')
  }

  storage.setItem(storageKey, identity)
  return identity
}

export function buildTrysteroConfig(role: PocRole, secret: string) {
  return {
    appId: TRYSTERO_POC_APP_ID,
    password: secret,
    passive: role === 'guest',
  }
}

export function evaluateGuestAdmission(
  activeGuestIdentities: ReadonlySet<string>,
  incomingIdentity: string,
): GuestAdmission {
  if (!isPocIdentity(incomingIdentity)) {
    return {
      accepted: false,
      reconnecting: false,
      reason: 'invalid-identity',
    }
  }

  if (activeGuestIdentities.has(incomingIdentity)) {
    return { accepted: true, reconnecting: true }
  }

  if (activeGuestIdentities.size >= MAX_GUESTS) {
    return {
      accepted: false,
      reconnecting: false,
      reason: 'party-full',
    }
  }

  return { accepted: true, reconnecting: false }
}

export function validateRemoteHandshake({
  localRole,
  partyId,
  expectedHostId,
  handshake,
}: {
  localRole: PocRole
  partyId: string
  expectedHostId: string
  handshake: PocHandshake
}): HandshakeValidation {
  if (
    handshake.version !== 1
    || !isPocIdentity(handshake.partyId)
    || !isPocIdentity(handshake.appIdentity)
    || (handshake.role !== 'host' && handshake.role !== 'guest')
  ) {
    return { ok: false, reason: 'invalid-handshake' }
  }

  if (handshake.partyId !== partyId) {
    return { ok: false, reason: 'wrong-party' }
  }

  const expectedRole: PocRole = localRole === 'host' ? 'guest' : 'host'
  if (handshake.role !== expectedRole) {
    return { ok: false, reason: 'unexpected-role' }
  }

  if (localRole === 'guest' && handshake.appIdentity !== expectedHostId) {
    return { ok: false, reason: 'unexpected-host' }
  }

  return { ok: true }
}
