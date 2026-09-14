import { MAX_CHAT_HISTORY, MAX_CHAT_MESSAGE_LENGTH, MAX_SERIALIZED_CHAT_MESSAGE_LENGTH } from '../../chat/chatProtocol'
import { MAX_PARTY_GUESTS, PARTY_PROTOCOL_GENERATION, type PartyChatMessage, type PartyMemberView } from './partyTypes'

export { PARTY_PROTOCOL_GENERATION } from './partyTypes'

export const MAX_PARTY_WIRE_MESSAGE_BYTES = 512 * 1024
const MAX_ID_LENGTH = 256
const MAX_CRYPTO_VALUE_LENGTH = 8_192

export type PartyWireMessage =
  | {
      version: 2
      type: 'hello'
      partyId: string
      role: 'guest'
      transportAttemptId: string
      guestNonce: string
    }
  | {
      version: 2
      type: 'host-proof'
      partyId: string
      incarnationId: string
      transportAttemptId: string
      hostPublicKey: string
      hostNonce: string
      signature: string
    }
  | {
      version: 2
      type: 'authenticate-new'
      partyId: string
      transportAttemptId: string
      admissionCapability: string
      credentialId: string
      credentialSecret: string
    }
  | {
      version: 2
      type: 'authenticate-resume'
      partyId: string
      transportAttemptId: string
      credentialId: string
      credentialSecret: string
    }
  | {
      version: 2
      type: 'authenticated'
      partyId: string
      incarnationId: string
      transportAttemptId: string
      memberId: string
      label: string
      canonicalSequence: number
    }
  | {
      version: 2
      type: 'chat-intent'
      partyId: string
      transportAttemptId: string
      requestSequence: number
      clientMessageId: string
      sentAt: number
      text: string
    }
  | {
      version: 2
      type: 'canonical-chat'
      partyId: string
      incarnationId: string
      canonicalSequence: number
      message: PartyChatMessage
    }
  | {
      version: 2
      type: 'sync-request'
      partyId: string
      transportAttemptId: string
      afterCanonicalSequence: number
    }
  | {
      version: 2
      type: 'sync-delta'
      partyId: string
      incarnationId: string
      fromCanonicalSequence: number
      toCanonicalSequence: number
      events: PartyCanonicalWireEvent[]
    }
  | {
      version: 2
      type: 'sync-snapshot'
      partyId: string
      incarnationId: string
      canonicalSequence: number
      locked: boolean
      members: PartyMemberView[]
      messages: PartyChatMessage[]
    }
  | {
      version: 2
      type: 'rejected'
      partyId: string
      code: string
    }
  | {
      version: 2
      type: 'superseded'
      partyId: string
      memberId: string
    }
  | {
      version: 2
      type: 'removed'
      partyId: string
      memberId: string
    }

export type PartyCanonicalWireEvent =
  | {
      kind: 'chat'
      canonicalSequence: number
      message: PartyChatMessage
    }
  | {
      kind: 'member-joined'
      canonicalSequence: number
      member: PartyMemberView
    }
  | {
      kind: 'admission-locked'
      canonicalSequence: number
    }
  | {
      kind: 'admission-unlocked'
      canonicalSequence: number
    }
  | {
      kind: 'member-removed'
      canonicalSequence: number
      memberId: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown, max = MAX_ID_LENGTH): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function isSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isMember(value: unknown): value is PartyMemberView {
  return isRecord(value)
    && isString(value.memberId)
    && isString(value.label, 64)
    && typeof value.removed === 'boolean'
}

function isChatMessage(value: unknown): value is PartyChatMessage {
  if (!isRecord(value)
    || !isString(value.id, 128)
    || typeof value.sentAt !== 'number'
    || !Number.isFinite(value.sentAt)
    || value.sentAt < 0
    || !isRecord(value.sender)
    || !isString(value.sender.memberId)
    || !isString(value.sender.label, 64)
    || typeof value.text !== 'string'
    || value.text.trim().length === 0
    || value.text.length > MAX_CHAT_MESSAGE_LENGTH) {
    return false
  }
  return JSON.stringify(value).length <= MAX_SERIALIZED_CHAT_MESSAGE_LENGTH
}

function isCanonicalEvent(value: unknown): value is PartyCanonicalWireEvent {
  if (!isRecord(value) || !isSequence(value.canonicalSequence) || !isString(value.kind, 64)) {
    return false
  }
  switch (value.kind) {
    case 'chat':
      return isChatMessage(value.message)
    case 'member-joined':
      return isMember(value.member)
    case 'admission-locked':
    case 'admission-unlocked':
      return true
    case 'member-removed':
      return isString(value.memberId)
    default:
      return false
  }
}

function validatePartyMessage(value: unknown): value is PartyWireMessage {
  if (!isRecord(value) || value.version !== PARTY_PROTOCOL_GENERATION || !isString(value.type, 64) || !isString(value.partyId)) {
    return false
  }

  switch (value.type) {
    case 'hello':
      return value.role === 'guest'
        && isString(value.transportAttemptId)
        && isString(value.guestNonce, MAX_CRYPTO_VALUE_LENGTH)
    case 'host-proof':
      return isString(value.incarnationId)
        && isString(value.transportAttemptId)
        && isString(value.hostPublicKey, MAX_CRYPTO_VALUE_LENGTH)
        && isString(value.hostNonce, MAX_CRYPTO_VALUE_LENGTH)
        && isString(value.signature, MAX_CRYPTO_VALUE_LENGTH)
    case 'authenticate-new':
      return isString(value.transportAttemptId)
        && isString(value.admissionCapability, MAX_CRYPTO_VALUE_LENGTH)
        && isString(value.credentialId)
        && isString(value.credentialSecret, MAX_CRYPTO_VALUE_LENGTH)
    case 'authenticate-resume':
      return isString(value.transportAttemptId)
        && isString(value.credentialId)
        && isString(value.credentialSecret, MAX_CRYPTO_VALUE_LENGTH)
    case 'authenticated':
      return isString(value.incarnationId)
        && isString(value.transportAttemptId)
        && isString(value.memberId)
        && isString(value.label, 64)
        && isSequence(value.canonicalSequence)
    case 'chat-intent':
      return isString(value.transportAttemptId)
        && isSequence(value.requestSequence)
        && value.requestSequence > 0
        && isString(value.clientMessageId, 128)
        && typeof value.sentAt === 'number'
        && Number.isFinite(value.sentAt)
        && value.sentAt >= 0
        && typeof value.text === 'string'
        && value.text.trim().length > 0
        && value.text.length <= MAX_CHAT_MESSAGE_LENGTH
        && JSON.stringify(value).length <= MAX_SERIALIZED_CHAT_MESSAGE_LENGTH
    case 'canonical-chat':
      return isString(value.incarnationId)
        && isSequence(value.canonicalSequence)
        && value.canonicalSequence > 0
        && isChatMessage(value.message)
    case 'sync-request':
      return isString(value.transportAttemptId) && isSequence(value.afterCanonicalSequence)
    case 'sync-delta':
      return isString(value.incarnationId)
        && isSequence(value.fromCanonicalSequence)
        && isSequence(value.toCanonicalSequence)
        && value.toCanonicalSequence >= value.fromCanonicalSequence
        && Array.isArray(value.events)
        && value.events.length <= MAX_CHAT_HISTORY
        && value.events.every(isCanonicalEvent)
    case 'sync-snapshot':
      return isString(value.incarnationId)
        && isSequence(value.canonicalSequence)
        && typeof value.locked === 'boolean'
        && Array.isArray(value.members)
        && value.members.length <= MAX_PARTY_GUESTS
        && value.members.every(isMember)
        && Array.isArray(value.messages)
        && value.messages.length <= MAX_CHAT_HISTORY
        && value.messages.every(isChatMessage)
    case 'rejected':
      return isString(value.code, 128)
    case 'superseded':
    case 'removed':
      return isString(value.memberId)
    default:
      return false
  }
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}

export function serializePartyMessage(message: PartyWireMessage) {
  if (!validatePartyMessage(message)) {
    throw new Error('Invalid party protocol message')
  }
  const serialized = JSON.stringify(message)
  if (byteLength(serialized) > MAX_PARTY_WIRE_MESSAGE_BYTES) {
    throw new Error('Party protocol message is too large')
  }
  return serialized
}

export function parsePartyMessage(serialized: string): PartyWireMessage | null {
  if (byteLength(serialized) > MAX_PARTY_WIRE_MESSAGE_BYTES) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(serialized)
    return validatePartyMessage(parsed) ? parsed : null
  } catch {
    return null
  }
}
