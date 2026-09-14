import {
  POC_AUTHORITY_VERSION,
  POC_HISTORY_LIMIT,
  POC_MAX_CHAT_LENGTH,
  type AuthoritySnapshot,
  type AuthoritySyncResponse,
  type CanonicalAuthorityEvent,
} from './hostAuthorityModel'
import { isPocIdentity } from './trysteroPocModel'

export type AuthDeniedReason = 'invalid-credential' | 'member-removed' | 'party-locked' | 'party-full' | 'identity-mismatch'
export type IntentRejectedReason = 'unknown-member' | 'member-removed' | 'invalid-intent' | 'duplicate-or-replay' | 'sequence-gap' | 'not-authenticated'

export type AuthorityServerMessage =
  | {
      version: typeof POC_AUTHORITY_VERSION
      type: 'auth.accepted'
      memberId: string
      label: string
      sync: AuthoritySyncResponse
    }
  | {
      version: typeof POC_AUTHORITY_VERSION
      type: 'auth.denied'
      reason: AuthDeniedReason
    }
  | {
      version: typeof POC_AUTHORITY_VERSION
      type: 'canonical.event'
      event: CanonicalAuthorityEvent
    }
  | {
      version: typeof POC_AUTHORITY_VERSION
      type: 'intent.rejected'
      reason: IntentRejectedReason
      sync: AuthoritySyncResponse | null
    }

const AUTH_DENIED_REASONS = new Set<AuthDeniedReason>([
  'invalid-credential',
  'member-removed',
  'party-locked',
  'party-full',
  'identity-mismatch',
])

const INTENT_REJECTED_REASONS = new Set<IntentRejectedReason>([
  'unknown-member',
  'member-removed',
  'invalid-intent',
  'duplicate-or-replay',
  'sequence-gap',
  'not-authenticated',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isLabel(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= POC_MAX_CHAT_LENGTH
}

function parseMember(value: unknown) {
  if (!isRecord(value) || !isPocIdentity(value.memberId) || !isLabel(value.label) || typeof value.removed !== 'boolean') {
    return null
  }
  return {
    memberId: value.memberId,
    label: value.label,
    removed: value.removed,
  }
}

function parseEvent(value: unknown): CanonicalAuthorityEvent | null {
  if (!isRecord(value) || !isPositiveInteger(value.sequence) || typeof value.type !== 'string') {
    return null
  }
  if (value.type === 'member.admitted') {
    const member = parseMember(value.member)
    return member ? { sequence: value.sequence, type: 'member.admitted', member } : null
  }
  if (value.type === 'member.removed') {
    return isPocIdentity(value.memberId)
      ? { sequence: value.sequence, type: 'member.removed', memberId: value.memberId }
      : null
  }
  if (value.type === 'party.locked') {
    return typeof value.locked === 'boolean'
      ? { sequence: value.sequence, type: 'party.locked', locked: value.locked }
      : null
  }
  if (value.type === 'chat.message') {
    if (!isRecord(value.sender) || !isPocIdentity(value.sender.memberId) || !isLabel(value.sender.label) || !isText(value.text) || !isPositiveInteger(value.clientSequence)) {
      return null
    }
    return {
      sequence: value.sequence,
      type: 'chat.message',
      sender: { memberId: value.sender.memberId, label: value.sender.label },
      text: value.text.trim(),
      clientSequence: value.clientSequence,
    }
  }
  return null
}

function parseSnapshot(value: unknown): AuthoritySnapshot | null {
  if (!isRecord(value)
    || !isPocIdentity(value.partyId)
    || !isPocIdentity(value.incarnationId)
    || !isPocIdentity(value.hostAppIdentity)
    || !isNonNegativeInteger(value.sequence)
    || typeof value.locked !== 'boolean'
    || !Array.isArray(value.members)
    || !Array.isArray(value.messages)
    || value.messages.length > POC_HISTORY_LIMIT) {
    return null
  }
  const members = value.members.map(parseMember)
  const messages = value.messages.map(parseEvent)
  if (members.some((member) => !member) || messages.some((event) => !event || event.type !== 'chat.message')) {
    return null
  }
  return {
    partyId: value.partyId,
    incarnationId: value.incarnationId,
    hostAppIdentity: value.hostAppIdentity,
    sequence: value.sequence,
    locked: value.locked,
    members: members as AuthoritySnapshot['members'],
    messages: messages as AuthoritySnapshot['messages'],
  }
}

function parseSync(value: unknown): AuthoritySyncResponse | null {
  if (!isRecord(value)
    || value.version !== POC_AUTHORITY_VERSION
    || value.type !== 'sync.response'
    || (value.mode !== 'delta' && value.mode !== 'snapshot')
    || !isNonNegativeInteger(value.sequence)
    || !isPositiveInteger(value.retainedFromSequence)
    || !isNonNegativeInteger(value.acceptedClientSequence)
    || !Array.isArray(value.events)
    || value.events.length > POC_HISTORY_LIMIT) {
    return null
  }
  const events = value.events.map(parseEvent)
  if (events.some((event) => !event)) {
    return null
  }
  if (value.mode === 'delta') {
    if (value.snapshot !== null) {
      return null
    }
    return {
      version: POC_AUTHORITY_VERSION,
      type: 'sync.response',
      mode: 'delta',
      sequence: value.sequence,
      retainedFromSequence: value.retainedFromSequence,
      acceptedClientSequence: value.acceptedClientSequence,
      events: events as CanonicalAuthorityEvent[],
      snapshot: null,
    }
  }
  const snapshot = parseSnapshot(value.snapshot)
  if (!snapshot || value.events.length !== 0 || snapshot.sequence !== value.sequence) {
    return null
  }
  return {
    version: POC_AUTHORITY_VERSION,
    type: 'sync.response',
    mode: 'snapshot',
    sequence: value.sequence,
    retainedFromSequence: value.retainedFromSequence,
    acceptedClientSequence: value.acceptedClientSequence,
    events: [],
    snapshot,
  }
}

export function parseAuthorityServerMessage(value: unknown): AuthorityServerMessage | null {
  if (!isRecord(value) || value.version !== POC_AUTHORITY_VERSION || typeof value.type !== 'string') {
    return null
  }
  if (value.type === 'auth.accepted') {
    const sync = parseSync(value.sync)
    if (!isPocIdentity(value.memberId) || !isLabel(value.label) || !sync) {
      return null
    }
    return {
      version: POC_AUTHORITY_VERSION,
      type: 'auth.accepted',
      memberId: value.memberId,
      label: value.label,
      sync,
    }
  }
  if (value.type === 'auth.denied') {
    return typeof value.reason === 'string' && AUTH_DENIED_REASONS.has(value.reason as AuthDeniedReason)
      ? { version: POC_AUTHORITY_VERSION, type: 'auth.denied', reason: value.reason as AuthDeniedReason }
      : null
  }
  if (value.type === 'canonical.event') {
    const event = parseEvent(value.event)
    return event ? { version: POC_AUTHORITY_VERSION, type: 'canonical.event', event } : null
  }
  if (value.type === 'intent.rejected') {
    const reason = typeof value.reason === 'string' && INTENT_REJECTED_REASONS.has(value.reason as IntentRejectedReason)
      ? value.reason as IntentRejectedReason
      : null
    const sync = value.sync === null ? null : parseSync(value.sync)
    return reason && (value.sync === null || sync)
      ? { version: POC_AUTHORITY_VERSION, type: 'intent.rejected', reason, sync }
      : null
  }
  return null
}
