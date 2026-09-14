import { isPocIdentity, type StorageLike } from './trysteroPocModel'
import type { GuestReplica } from './hostAuthorityModel'

export type GuestAuthorityCredentials = {
  version: 1
  partyId: string
  hostAppIdentity: string
  credentialId: string
  credentialSecret: string
  memberId: string | null
  lastCanonicalSequence: number
  nextClientSequence: number
  cachedReplica: GuestReplica | null
}

function storageKey(partyId: string) {
  return `c00lgames.poc.authority.guest.${partyId}`
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function parseStored(value: unknown): GuestAuthorityCredentials | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Partial<GuestAuthorityCredentials>
  if (
    candidate.version !== 1
    || !isPocIdentity(candidate.partyId)
    || !isPocIdentity(candidate.hostAppIdentity)
    || !isPocIdentity(candidate.credentialId)
    || !isPocIdentity(candidate.credentialSecret)
    || (candidate.memberId !== null && !isPocIdentity(candidate.memberId))
    || !isNonNegativeInteger(candidate.lastCanonicalSequence)
    || !isPositiveInteger(candidate.nextClientSequence)
  ) {
    return null
  }
  return {
    version: 1,
    partyId: candidate.partyId,
    hostAppIdentity: candidate.hostAppIdentity,
    credentialId: candidate.credentialId,
    credentialSecret: candidate.credentialSecret,
    memberId: candidate.memberId ?? null,
    lastCanonicalSequence: candidate.lastCanonicalSequence,
    nextClientSequence: candidate.nextClientSequence,
    cachedReplica: candidate.cachedReplica ?? null,
  }
}

export function loadOrCreateGuestAuthority(
  storage: StorageLike,
  partyId: string,
  hostAppIdentity: string,
  createCredentialId: () => string = () => crypto.randomUUID(),
  createCredentialSecret: () => string = () => crypto.randomUUID(),
): GuestAuthorityCredentials {
  if (!isPocIdentity(partyId) || !isPocIdentity(hostAppIdentity)) {
    throw new Error('Guest authority route is invalid')
  }

  const key = storageKey(partyId)
  try {
    const raw = storage.getItem(key)
    if (raw) {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        storage.removeItem(key)
        parsed = null
      }
      const stored = parseStored(parsed)
      if (stored) {
        if (stored.hostAppIdentity !== hostAppIdentity) {
          throw new Error('Guest cache is pinned to a different host')
        }
        return stored
      }
      if (parsed !== null) {
        storage.removeItem(key)
      }
    }

    const credentialId = createCredentialId()
    const credentialSecret = createCredentialSecret()
    if (!isPocIdentity(credentialId) || !isPocIdentity(credentialSecret)) {
      throw new Error('Guest credential factory returned an invalid identity')
    }
    const created: GuestAuthorityCredentials = {
      version: 1,
      partyId,
      hostAppIdentity,
      credentialId,
      credentialSecret,
      memberId: null,
      lastCanonicalSequence: 0,
      nextClientSequence: 1,
      cachedReplica: null,
    }
    storage.setItem(key, JSON.stringify(created))
    return created
  } catch (error) {
    if (error instanceof Error && (
      error.message === 'Guest cache is pinned to a different host'
      || error.message === 'Guest credential factory returned an invalid identity'
    )) {
      throw error
    }
    throw new Error('Guest durable storage unavailable', { cause: error })
  }
}

export function saveGuestAuthority(storage: StorageLike, credentials: GuestAuthorityCredentials) {
  const parsed = parseStored(credentials)
  if (!parsed) {
    throw new Error('Guest authority state is invalid')
  }
  try {
    storage.setItem(storageKey(credentials.partyId), JSON.stringify(credentials))
  } catch (error) {
    throw new Error('Guest durable storage unavailable', { cause: error })
  }
}
