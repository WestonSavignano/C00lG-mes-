import {
  MAX_CHAT_HISTORY,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_SERIALIZED_CHAT_MESSAGE_LENGTH,
} from '../../chat/chatProtocol'
import { ChatRateLimiter } from '../../chat/chatRateLimiter'
import {
  deriveAdmissionVerifier,
  deriveCredentialVerifier,
  generateCapability,
  secureVerifierEquals,
} from './partyCrypto'
import type { PartyCanonicalWireEvent } from './partyProtocol'
import type { PartyChatMessage, PartyMemberView } from './partyTypes'
import {
  isValidHostPartyRecord,
  type HostPartyMemberRecord,
  type HostPartyRecord,
  type HostPartyStore,
} from './hostPartyStore'

const HOST_MEMBER_ID = 'host'
const HOST_LABEL = 'Host'
const MAX_MEMBER_RECORDS = 256
const encoder = new TextEncoder()

type AuthorityOptions = {
  rateLimiter?: ChatRateLimiter
  moderate?: (text: string) => string
}

type TransportBinding = {
  peerId: string
  transportAttemptId: string
}

type AdmissionResult =
  | { accepted: true; member: HostPartyMemberRecord; event: PartyCanonicalWireEvent }
  | { accepted: false; reason: string }

type ResumeResult =
  | { accepted: true; member: HostPartyMemberRecord }
  | { accepted: false; reason: string }

type MutationResult =
  | { accepted: true; event: PartyCanonicalWireEvent }
  | { accepted: false; reason: string }

export type PartySyncResult =
  | {
      kind: 'delta'
      fromCanonicalSequence: number
      toCanonicalSequence: number
      events: PartyCanonicalWireEvent[]
    }
  | {
      kind: 'snapshot'
      canonicalSequence: number
      locked: boolean
      members: PartyMemberView[]
      messages: PartyChatMessage[]
    }

function memberView(member: HostPartyMemberRecord): PartyMemberView {
  return {
    memberId: member.memberId,
    label: member.label,
    removed: member.removed,
  }
}

function appendEvent(record: HostPartyRecord, event: PartyCanonicalWireEvent) {
  return [...record.history, event].slice(-MAX_CHAT_HISTORY)
}

function appendMessage(record: HostPartyRecord, message: PartyChatMessage) {
  return [...record.messages, message].slice(-MAX_CHAT_HISTORY)
}

function isValidChatInput(input: { clientMessageId: string; sentAt: number; text: string }) {
  return input.clientMessageId.length > 0
    && input.clientMessageId.length <= 128
    && Number.isFinite(input.sentAt)
    && input.sentAt >= 0
    && input.text.trim().length > 0
    && input.text.length <= MAX_CHAT_MESSAGE_LENGTH
}

function isBoundedCanonicalMessage(message: PartyChatMessage) {
  return encoder.encode(JSON.stringify(message)).byteLength <= MAX_SERIALIZED_CHAT_MESSAGE_LENGTH
}

export class HostPartyAuthority {
  private record: HostPartyRecord
  private mutationQueue: Promise<void> = Promise.resolve()
  private closed = false
  private readonly rateLimiter: ChatRateLimiter
  private readonly moderate: (text: string) => string
  private readonly transportByMember = new Map<string, TransportBinding>()
  private readonly memberByPeer = new Map<string, { memberId: string; transportAttemptId: string }>()

  private constructor(
    private readonly store: HostPartyStore,
    record: HostPartyRecord,
    options: AuthorityOptions = {},
  ) {
    this.record = record
    this.rateLimiter = options.rateLimiter ?? new ChatRateLimiter()
    this.moderate = options.moderate ?? ((text) => text)
  }

  static async create(store: HostPartyStore, record: HostPartyRecord, options: AuthorityOptions = {}) {
    if (!isValidHostPartyRecord(record)) {
      throw new Error('Initial host party authority is invalid')
    }
    await store.save(record)
    return new HostPartyAuthority(store, record, options)
  }

  static async restore(store: HostPartyStore, partyId: string, options: AuthorityOptions = {}) {
    const record = await store.load(partyId)
    if (!record) {
      throw new Error('No durable host state exists for this party')
    }
    if (!isValidHostPartyRecord(record)) {
      throw new Error('Durable host state is invalid or incompatible')
    }
    return new HostPartyAuthority(store, record, options)
  }

  get state() {
    return this.record
  }

  async close() {
    if (this.closed) {
      await this.mutationQueue
      return
    }
    this.closed = true
    await this.mutationQueue
    this.transportByMember.clear()
    this.memberByPeer.clear()
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed) {
      return Promise.reject(new Error('Host party authority is closed'))
    }
    const run = this.mutationQueue.then(operation, operation)
    this.mutationQueue = run.then(() => undefined, () => undefined)
    return run
  }

  private async persist(candidate: HostPartyRecord) {
    if (!isValidHostPartyRecord(candidate)) {
      throw new Error('Refusing to advance invalid host party authority')
    }
    await this.store.save(candidate)
    this.record = candidate
  }

  authenticateNew(input: {
    admissionCapability: string
    credentialId: string
    credentialSecret: string
  }): Promise<AdmissionResult> {
    return this.enqueue(async () => {
      if (this.record.locked) {
        return { accepted: false, reason: 'party-locked' }
      }
      if (!this.record.admissionCapability || !this.record.admissionVerifier) {
        return { accepted: false, reason: 'admission-unavailable' }
      }
      const admissionVerifier = await deriveAdmissionVerifier(input.admissionCapability)
      if (!secureVerifierEquals(admissionVerifier, this.record.admissionVerifier)) {
        return { accepted: false, reason: 'invalid-admission' }
      }
      if (!input.credentialId || !input.credentialSecret) {
        return { accepted: false, reason: 'invalid-credential' }
      }
      if (this.record.members.some((member) => member.credentialId === input.credentialId)) {
        return { accepted: false, reason: 'credential-exists' }
      }
      const activeMembers = this.record.members.filter((member) => !member.removed)
      if (activeMembers.length >= 7 || this.record.members.length >= MAX_MEMBER_RECORDS) {
        return { accepted: false, reason: 'party-full' }
      }

      const nextSequence = this.record.canonicalSequence + 1
      const member: HostPartyMemberRecord = {
        memberId: `member_${generateCapability()}`,
        label: `Guest ${this.record.nextMemberNumber}`,
        credentialId: input.credentialId,
        credentialVerifier: await deriveCredentialVerifier(input.credentialSecret),
        removed: false,
        lastAcceptedRequestSequence: 0,
      }
      const event: PartyCanonicalWireEvent = {
        kind: 'member-joined',
        canonicalSequence: nextSequence,
        member: memberView(member),
      }
      const candidate: HostPartyRecord = {
        ...this.record,
        canonicalSequence: nextSequence,
        nextMemberNumber: this.record.nextMemberNumber + 1,
        members: [...this.record.members, member],
        history: appendEvent(this.record, event),
      }
      await this.persist(candidate)
      return { accepted: true, member, event }
    })
  }

  authenticateResume(input: { credentialId: string; credentialSecret: string }): Promise<ResumeResult> {
    return this.enqueue(async () => {
      const member = this.record.members.find((candidate) => candidate.credentialId === input.credentialId)
      if (!member) {
        return { accepted: false, reason: 'invalid-credential' }
      }
      const verifier = await deriveCredentialVerifier(input.credentialSecret)
      if (!secureVerifierEquals(verifier, member.credentialVerifier)) {
        return { accepted: false, reason: 'invalid-credential' }
      }
      if (member.removed) {
        return { accepted: false, reason: 'member-removed' }
      }
      return { accepted: true, member }
    })
  }

  bindTransport(memberId: string, peerId: string, transportAttemptId: string) {
    if (this.closed) {
      throw new Error('Host party authority is closed')
    }
    const member = this.record.members.find((candidate) => candidate.memberId === memberId && !candidate.removed)
    if (!member) {
      throw new Error('Cannot bind transport for unknown or removed member')
    }

    const previous = this.transportByMember.get(memberId) ?? null
    if (previous) {
      this.memberByPeer.delete(previous.peerId)
    }

    const previousPeerOwner = this.memberByPeer.get(peerId)
    if (previousPeerOwner) {
      this.transportByMember.delete(previousPeerOwner.memberId)
    }

    const binding = { peerId, transportAttemptId }
    this.transportByMember.set(memberId, binding)
    this.memberByPeer.set(peerId, { memberId, transportAttemptId })
    return { replaced: previous }
  }

  unbindTransport(peerId: string, transportAttemptId?: string) {
    const current = this.memberByPeer.get(peerId)
    if (!current || (transportAttemptId && current.transportAttemptId !== transportAttemptId)) {
      return
    }
    this.memberByPeer.delete(peerId)
    const memberBinding = this.transportByMember.get(current.memberId)
    if (memberBinding?.peerId === peerId && memberBinding.transportAttemptId === current.transportAttemptId) {
      this.transportByMember.delete(current.memberId)
    }
  }

  memberForTransport(peerId: string, transportAttemptId: string) {
    const current = this.memberByPeer.get(peerId)
    return current?.transportAttemptId === transportAttemptId ? current.memberId : null
  }

  setAdmissionLocked(locked: boolean) {
    return this.enqueue(async () => {
      if (this.record.locked === locked) {
        return { admissionCapability: this.record.admissionCapability, event: null }
      }

      const nextSequence = this.record.canonicalSequence + 1
      const event: PartyCanonicalWireEvent = locked
        ? { kind: 'admission-locked', canonicalSequence: nextSequence }
        : { kind: 'admission-unlocked', canonicalSequence: nextSequence }
      const admissionCapability = locked ? null : generateCapability()
      const admissionVerifier = admissionCapability ? await deriveAdmissionVerifier(admissionCapability) : null
      const candidate: HostPartyRecord = {
        ...this.record,
        locked,
        admissionCapability,
        admissionVerifier,
        canonicalSequence: nextSequence,
        history: appendEvent(this.record, event),
      }
      await this.persist(candidate)
      return { admissionCapability, event }
    })
  }

  removeMember(memberId: string): Promise<MutationResult> {
    return this.enqueue(async () => {
      const index = this.record.members.findIndex((member) => member.memberId === memberId)
      if (index < 0) {
        return { accepted: false, reason: 'unknown-member' }
      }
      if (this.record.members[index]?.removed) {
        return { accepted: false, reason: 'member-removed' }
      }

      const nextSequence = this.record.canonicalSequence + 1
      const members = this.record.members.map((member, memberIndex) =>
        memberIndex === index ? { ...member, removed: true } : member)
      const event: PartyCanonicalWireEvent = {
        kind: 'member-removed',
        canonicalSequence: nextSequence,
        memberId,
      }
      const candidate: HostPartyRecord = {
        ...this.record,
        canonicalSequence: nextSequence,
        members,
        history: appendEvent(this.record, event),
      }
      await this.persist(candidate)

      const binding = this.transportByMember.get(memberId)
      if (binding) {
        this.memberByPeer.delete(binding.peerId)
        this.transportByMember.delete(memberId)
      }
      this.rateLimiter.clear(memberId)
      return { accepted: true, event }
    })
  }

  submitChat(input: {
    memberId: string
    peerId: string
    transportAttemptId: string
    requestSequence: number
    clientMessageId: string
    sentAt: number
    text: string
  }): Promise<MutationResult> {
    return this.enqueue(async () => {
      if (this.memberForTransport(input.peerId, input.transportAttemptId) !== input.memberId) {
        return { accepted: false, reason: 'stale-transport' }
      }
      const memberIndex = this.record.members.findIndex((member) => member.memberId === input.memberId)
      const member = this.record.members[memberIndex]
      if (!member || member.removed) {
        return { accepted: false, reason: member?.removed ? 'member-removed' : 'unknown-member' }
      }
      if (!Number.isSafeInteger(input.requestSequence) || input.requestSequence <= member.lastAcceptedRequestSequence) {
        return { accepted: false, reason: 'duplicate-or-replay' }
      }
      if (input.requestSequence !== member.lastAcceptedRequestSequence + 1) {
        return { accepted: false, reason: 'request-gap' }
      }
      if (!isValidChatInput(input)) {
        return { accepted: false, reason: 'invalid-chat' }
      }
      if (!this.rateLimiter.tryConsume(member.memberId)) {
        return { accepted: false, reason: 'rate-limited' }
      }

      const moderated = this.moderate(input.text.trim())
      if (!moderated.trim() || moderated.length > MAX_CHAT_MESSAGE_LENGTH) {
        return { accepted: false, reason: 'invalid-chat' }
      }
      const message: PartyChatMessage = {
        id: input.clientMessageId,
        sentAt: input.sentAt,
        sender: { memberId: member.memberId, label: member.label },
        text: moderated,
      }
      if (!isBoundedCanonicalMessage(message)) {
        return { accepted: false, reason: 'message-too-large' }
      }

      const nextSequence = this.record.canonicalSequence + 1
      const event: PartyCanonicalWireEvent = {
        kind: 'chat',
        canonicalSequence: nextSequence,
        message,
      }
      const members = this.record.members.map((candidate, index) =>
        index === memberIndex
          ? { ...candidate, lastAcceptedRequestSequence: input.requestSequence }
          : candidate)
      const candidate: HostPartyRecord = {
        ...this.record,
        canonicalSequence: nextSequence,
        members,
        history: appendEvent(this.record, event),
        messages: appendMessage(this.record, message),
      }
      await this.persist(candidate)
      return { accepted: true, event }
    })
  }

  commitHostChat(input: { clientMessageId: string; sentAt: number; text: string }): Promise<MutationResult> {
    return this.enqueue(async () => {
      if (!isValidChatInput(input)) {
        return { accepted: false, reason: 'invalid-chat' }
      }
      const moderated = this.moderate(input.text.trim())
      const message: PartyChatMessage = {
        id: input.clientMessageId,
        sentAt: input.sentAt,
        sender: { memberId: HOST_MEMBER_ID, label: HOST_LABEL },
        text: moderated,
      }
      if (!moderated.trim() || moderated.length > MAX_CHAT_MESSAGE_LENGTH || !isBoundedCanonicalMessage(message)) {
        return { accepted: false, reason: 'invalid-chat' }
      }
      const nextSequence = this.record.canonicalSequence + 1
      const event: PartyCanonicalWireEvent = {
        kind: 'chat',
        canonicalSequence: nextSequence,
        message,
      }
      const candidate: HostPartyRecord = {
        ...this.record,
        canonicalSequence: nextSequence,
        history: appendEvent(this.record, event),
        messages: appendMessage(this.record, message),
      }
      await this.persist(candidate)
      return { accepted: true, event }
    })
  }

  buildSync(afterCanonicalSequence: number): PartySyncResult {
    if (!Number.isSafeInteger(afterCanonicalSequence)
      || afterCanonicalSequence < 0
      || afterCanonicalSequence > this.record.canonicalSequence) {
      return this.snapshot()
    }

    const earliestRetained = this.record.history[0]?.canonicalSequence
    if (earliestRetained !== undefined && afterCanonicalSequence < earliestRetained - 1) {
      return this.snapshot()
    }

    const events = this.record.history.filter((event) => event.canonicalSequence > afterCanonicalSequence)
    return {
      kind: 'delta',
      fromCanonicalSequence: events[0]?.canonicalSequence ?? this.record.canonicalSequence,
      toCanonicalSequence: events.at(-1)?.canonicalSequence ?? this.record.canonicalSequence,
      events,
    }
  }

  private snapshot(): PartySyncResult {
    return {
      kind: 'snapshot',
      canonicalSequence: this.record.canonicalSequence,
      locked: this.record.locked,
      members: this.record.members.filter((member) => !member.removed).map(memberView),
      messages: this.record.messages,
    }
  }
}
