import { MAX_CHAT_HISTORY, MAX_CHAT_MESSAGE_LENGTH } from '../../chat/chatProtocol'
import {
  deriveAdmissionVerifier,
  exportHostPublicKey,
  fingerprintHostPublicKey,
  generateCapability,
  generateHostKeyPair,
  generateIncarnationId,
  generatePartyId,
} from './partyCrypto'
import type { PartyCanonicalWireEvent } from './partyProtocol'
import {
  HOST_PARTY_STORAGE_SCHEMA_VERSION,
  MAX_PARTY_GUESTS,
  PARTY_PROTOCOL_GENERATION,
  type PartyChatMessage,
} from './partyTypes'
import {
  HOST_PARTY_STORE_NAME,
  openPartyStorageDb,
  readPartyRecord,
  writePartyRecord,
} from './partyStorageDb'

const MAX_MEMBER_RECORDS = 256

export type HostPartyMemberRecord = {
  memberId: string
  label: string
  credentialId: string
  credentialVerifier: string
  removed: boolean
  lastAcceptedRequestSequence: number
}

export type HostPartyRecord = {
  storageSchemaVersion: 1
  protocolGeneration: 2
  partyId: string
  incarnationId: string
  hostPrivateKey: CryptoKey
  hostPublicKey: string
  hostFingerprint: string
  rendezvousCapability: string
  admissionCapability: string | null
  admissionVerifier: string | null
  locked: boolean
  canonicalSequence: number
  nextMemberNumber: number
  members: HostPartyMemberRecord[]
  history: PartyCanonicalWireEvent[]
  messages: PartyChatMessage[]
}

export interface HostPartyStore {
  load(partyId: string): Promise<HostPartyRecord | null>
  save(record: HostPartyRecord): Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown, max = 8_192): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isPrivateHostKey(value: unknown): value is CryptoKey {
  if (!isRecord(value)) {
    return false
  }
  const algorithm = value.algorithm
  return value.type === 'private'
    && value.extractable === false
    && Array.isArray(value.usages)
    && value.usages.includes('sign')
    && isRecord(algorithm)
    && algorithm.name === 'ECDSA'
    && algorithm.namedCurve === 'P-256'
}

function isMember(value: unknown): value is HostPartyMemberRecord {
  return isRecord(value)
    && isNonEmptyString(value.memberId, 256)
    && isNonEmptyString(value.label, 64)
    && isNonEmptyString(value.credentialId, 256)
    && isNonEmptyString(value.credentialVerifier, 256)
    && typeof value.removed === 'boolean'
    && isNonNegativeInteger(value.lastAcceptedRequestSequence)
}

function isMessage(value: unknown): value is PartyChatMessage {
  return isRecord(value)
    && isNonEmptyString(value.id, 128)
    && typeof value.sentAt === 'number'
    && Number.isFinite(value.sentAt)
    && value.sentAt >= 0
    && isRecord(value.sender)
    && isNonEmptyString(value.sender.memberId, 256)
    && isNonEmptyString(value.sender.label, 64)
    && typeof value.text === 'string'
    && value.text.trim().length > 0
    && value.text.length <= MAX_CHAT_MESSAGE_LENGTH
}

function isCanonicalEvent(value: unknown): value is PartyCanonicalWireEvent {
  if (!isRecord(value) || !isNonNegativeInteger(value.canonicalSequence) || !isNonEmptyString(value.kind, 64)) {
    return false
  }
  switch (value.kind) {
    case 'chat':
      return isMessage(value.message)
    case 'member-joined':
      return isRecord(value.member)
        && isNonEmptyString(value.member.memberId, 256)
        && isNonEmptyString(value.member.label, 64)
        && typeof value.member.removed === 'boolean'
    case 'admission-locked':
    case 'admission-unlocked':
      return true
    case 'member-removed':
      return isNonEmptyString(value.memberId, 256)
    default:
      return false
  }
}

export function isValidHostPartyRecord(value: unknown): value is HostPartyRecord {
  if (!isRecord(value)
    || value.storageSchemaVersion !== HOST_PARTY_STORAGE_SCHEMA_VERSION
    || value.protocolGeneration !== PARTY_PROTOCOL_GENERATION
    || !isNonEmptyString(value.partyId, 256)
    || !isNonEmptyString(value.incarnationId, 256)
    || !isPrivateHostKey(value.hostPrivateKey)
    || !isNonEmptyString(value.hostPublicKey)
    || !isNonEmptyString(value.hostFingerprint, 256)
    || !isNonEmptyString(value.rendezvousCapability, 256)
    || typeof value.locked !== 'boolean'
    || !isNonNegativeInteger(value.canonicalSequence)
    || !isNonNegativeInteger(value.nextMemberNumber)
    || value.nextMemberNumber < 1
    || !Array.isArray(value.members)
    || value.members.length > MAX_MEMBER_RECORDS
    || !value.members.every(isMember)
    || !Array.isArray(value.history)
    || value.history.length > MAX_CHAT_HISTORY
    || !value.history.every(isCanonicalEvent)
    || !Array.isArray(value.messages)
    || value.messages.length > MAX_CHAT_HISTORY
    || !value.messages.every(isMessage)) {
    return false
  }

  if (value.locked) {
    if (value.admissionCapability !== null || value.admissionVerifier !== null) {
      return false
    }
  } else if (!isNonEmptyString(value.admissionCapability, 256) || !isNonEmptyString(value.admissionVerifier, 256)) {
    return false
  }

  const activeMembers = value.members.filter((member) => !member.removed)
  if (activeMembers.length > MAX_PARTY_GUESTS) {
    return false
  }

  if (value.history.some((event) => event.canonicalSequence > value.canonicalSequence)) {
    return false
  }

  return true
}

export async function createInitialHostPartyRecord(input: { partyId?: string } = {}): Promise<HostPartyRecord> {
  const keyPair = await generateHostKeyPair()
  const hostPublicKey = await exportHostPublicKey(keyPair.publicKey)
  const admissionCapability = generateCapability()
  const record: HostPartyRecord = {
    storageSchemaVersion: HOST_PARTY_STORAGE_SCHEMA_VERSION,
    protocolGeneration: PARTY_PROTOCOL_GENERATION,
    partyId: input.partyId ?? generatePartyId(),
    incarnationId: generateIncarnationId(),
    hostPrivateKey: keyPair.privateKey,
    hostPublicKey,
    hostFingerprint: await fingerprintHostPublicKey(keyPair.publicKey),
    rendezvousCapability: generateCapability(),
    admissionCapability,
    admissionVerifier: await deriveAdmissionVerifier(admissionCapability),
    locked: false,
    canonicalSequence: 0,
    nextMemberNumber: 1,
    members: [],
    history: [],
    messages: [],
  }
  if (!isValidHostPartyRecord(record)) {
    throw new Error('Failed to create valid host party authority')
  }
  return record
}

export class IndexedDbHostPartyStore implements HostPartyStore {
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB) {}

  async load(partyId: string) {
    const db = await openPartyStorageDb(this.factory)
    try {
      const record = await readPartyRecord<unknown>(db, HOST_PARTY_STORE_NAME, partyId)
      if (record === null) {
        return null
      }
      if (!isValidHostPartyRecord(record)) {
        throw new Error('Durable host state is invalid or incompatible')
      }
      return record
    } finally {
      db.close()
    }
  }

  async save(record: HostPartyRecord) {
    if (!isValidHostPartyRecord(record)) {
      throw new Error('Refusing to persist invalid host party authority')
    }
    const db = await openPartyStorageDb(this.factory)
    try {
      await writePartyRecord(db, HOST_PARTY_STORE_NAME, record)
    } finally {
      db.close()
    }
  }
}
