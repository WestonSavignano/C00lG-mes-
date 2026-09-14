import { MAX_CHAT_HISTORY, MAX_CHAT_MESSAGE_LENGTH } from '../../chat/chatProtocol'
import {
  GUEST_PARTY_STORAGE_SCHEMA_VERSION,
  MAX_PARTY_GUESTS,
  PARTY_PROTOCOL_GENERATION,
  type PartyChatMessage,
  type PartyMemberView,
} from './partyTypes'
import {
  GUEST_PARTY_STORE_NAME,
  openPartyStorageDb,
  readPartyRecord,
  writePartyRecord,
} from './partyStorageDb'

export type GuestPartyRecord = {
  storageSchemaVersion: 1
  protocolGeneration: 2
  partyId: string
  incarnationId: string | null
  rendezvousCapability: string
  hostFingerprint: string
  credentialId: string
  credentialSecret: string
  memberId: string | null
  label: string | null
  canonicalSequence: number
  nextRequestSequence: number
  locked: boolean
  members: PartyMemberView[]
  messages: PartyChatMessage[]
}

export interface GuestPartyStore {
  load(partyId: string): Promise<GuestPartyRecord | null>
  save(record: GuestPartyRecord): Promise<void>
  delete(partyId: string): Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown, max = 8_192): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function isSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isMember(value: unknown): value is PartyMemberView {
  return isRecord(value)
    && isString(value.memberId, 256)
    && isString(value.label, 64)
    && typeof value.removed === 'boolean'
}

function isMessage(value: unknown): value is PartyChatMessage {
  return isRecord(value)
    && isString(value.id, 128)
    && typeof value.sentAt === 'number'
    && Number.isFinite(value.sentAt)
    && value.sentAt >= 0
    && isRecord(value.sender)
    && isString(value.sender.memberId, 256)
    && isString(value.sender.label, 64)
    && typeof value.text === 'string'
    && value.text.trim().length > 0
    && value.text.length <= MAX_CHAT_MESSAGE_LENGTH
}

export function createInitialGuestPartyRecord(input: {
  partyId: string
  rendezvousCapability: string
  hostFingerprint: string
  credentialId: string
  credentialSecret: string
}): GuestPartyRecord {
  return {
    storageSchemaVersion: GUEST_PARTY_STORAGE_SCHEMA_VERSION,
    protocolGeneration: PARTY_PROTOCOL_GENERATION,
    partyId: input.partyId,
    incarnationId: null,
    rendezvousCapability: input.rendezvousCapability,
    hostFingerprint: input.hostFingerprint,
    credentialId: input.credentialId,
    credentialSecret: input.credentialSecret,
    memberId: null,
    label: null,
    canonicalSequence: 0,
    nextRequestSequence: 1,
    locked: false,
    members: [],
    messages: [],
  }
}

export function isValidGuestPartyRecord(value: unknown): value is GuestPartyRecord {
  if (!isRecord(value)
    || value.storageSchemaVersion !== GUEST_PARTY_STORAGE_SCHEMA_VERSION
    || value.protocolGeneration !== PARTY_PROTOCOL_GENERATION
    || !isString(value.partyId, 256)
    || (value.incarnationId !== null && !isString(value.incarnationId, 256))
    || !isString(value.rendezvousCapability, 256)
    || !isString(value.hostFingerprint, 256)
    || !isString(value.credentialId, 256)
    || !isString(value.credentialSecret, 256)
    || (value.memberId !== null && !isString(value.memberId, 256))
    || (value.label !== null && !isString(value.label, 64))
    || !isSequence(value.canonicalSequence)
    || !isSequence(value.nextRequestSequence)
    || value.nextRequestSequence < 1
    || typeof value.locked !== 'boolean'
    || !Array.isArray(value.members)
    || value.members.length > MAX_PARTY_GUESTS
    || !value.members.every(isMember)
    || !Array.isArray(value.messages)
    || value.messages.length > MAX_CHAT_HISTORY
    || !value.messages.every(isMessage)) {
    return false
  }

  const admittedFields = [value.incarnationId, value.memberId, value.label]
  const admittedFieldCount = admittedFields.filter((field) => field !== null).length
  return admittedFieldCount === 0 || admittedFieldCount === admittedFields.length
}

export function sanitizeGuestPartyRecord(value: unknown): GuestPartyRecord | null {
  if (!isRecord(value)
    || value.storageSchemaVersion !== GUEST_PARTY_STORAGE_SCHEMA_VERSION
    || value.protocolGeneration !== PARTY_PROTOCOL_GENERATION
    || !isString(value.partyId, 256)
    || !isString(value.rendezvousCapability, 256)
    || !isString(value.hostFingerprint, 256)
    || !isString(value.credentialId, 256)
    || !isString(value.credentialSecret, 256)) {
    return null
  }

  if (isValidGuestPartyRecord(value)) {
    return value
  }

  const hasAdmittedIdentity = value.incarnationId !== null
    || value.memberId !== null
    || value.label !== null
  let incarnationId: string | null = null
  let memberId: string | null = null
  let label: string | null = null

  if (hasAdmittedIdentity) {
    if (!isString(value.incarnationId, 256)
      || !isString(value.memberId, 256)
      || !isString(value.label, 64)) {
      return null
    }
    incarnationId = value.incarnationId
    memberId = value.memberId
    label = value.label
  }

  const reset = createInitialGuestPartyRecord({
    partyId: value.partyId,
    rendezvousCapability: value.rendezvousCapability,
    hostFingerprint: value.hostFingerprint,
    credentialId: value.credentialId,
    credentialSecret: value.credentialSecret,
  })
  return {
    ...reset,
    incarnationId,
    memberId,
    label,
  }
}

export class IndexedDbGuestPartyStore implements GuestPartyStore {
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB) {}

  async load(partyId: string) {
    const db = await openPartyStorageDb(this.factory)
    try {
      const record = await readPartyRecord<unknown>(db, GUEST_PARTY_STORE_NAME, partyId)
      if (record === null) {
        return null
      }
      return sanitizeGuestPartyRecord(record)
    } finally {
      db.close()
    }
  }

  async save(record: GuestPartyRecord) {
    if (!isValidGuestPartyRecord(record)) {
      throw new Error('Refusing to persist invalid guest party state')
    }
    const db = await openPartyStorageDb(this.factory)
    try {
      await writePartyRecord(db, GUEST_PARTY_STORE_NAME, record)
    } finally {
      db.close()
    }
  }

  async delete(partyId: string) {
    const db = await openPartyStorageDb(this.factory)
    try {
      const transaction = db.transaction(GUEST_PARTY_STORE_NAME, 'readwrite')
      const completion = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
      })
      transaction.objectStore(GUEST_PARTY_STORE_NAME).delete(partyId)
      await completion
    } finally {
      db.close()
    }
  }
}
