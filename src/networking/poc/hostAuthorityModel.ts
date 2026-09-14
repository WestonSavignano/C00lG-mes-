import { MAX_GUESTS, isPocIdentity } from './trysteroPocModel'

export const POC_AUTHORITY_VERSION = 1 as const
export const POC_HISTORY_LIMIT = 24
export const POC_MAX_CHAT_LENGTH = 1_000

export type CanonicalMemberView = {
  memberId: string
  label: string
  removed: boolean
}

export type HostAuthorityMember = CanonicalMemberView & {
  credentialId: string
  credentialVerifier: string
  lastClientSequence: number
}

export type MemberAdmittedEvent = {
  sequence: number
  type: 'member.admitted'
  member: CanonicalMemberView
}

export type MemberRemovedEvent = {
  sequence: number
  type: 'member.removed'
  memberId: string
}

export type PartyLockedEvent = {
  sequence: number
  type: 'party.locked'
  locked: boolean
}

export type CanonicalChatEvent = {
  sequence: number
  type: 'chat.message'
  sender: { memberId: string; label: string }
  text: string
  clientSequence: number
}

export type CanonicalAuthorityEvent =
  | MemberAdmittedEvent
  | MemberRemovedEvent
  | PartyLockedEvent
  | CanonicalChatEvent

export type HostAuthorityState = {
  version: typeof POC_AUTHORITY_VERSION
  partyId: string
  incarnationId: string
  hostAppIdentity: string
  locked: boolean
  canonicalSequence: number
  members: HostAuthorityMember[]
  events: CanonicalAuthorityEvent[]
}

export type GuestChatIntent = {
  version: typeof POC_AUTHORITY_VERSION
  type: 'chat.intent'
  clientSequence: number
  text: string
  claimedSender?: string
}

export type AuthRequest = {
  version: typeof POC_AUTHORITY_VERSION
  type: 'auth.request'
  credentialId: string
  credentialSecret: string
  lastCanonicalSequence: number
}

export type SyncRequest = {
  version: typeof POC_AUTHORITY_VERSION
  type: 'sync.request'
  lastCanonicalSequence: number
}

export type GuestAuthorityRequest = AuthRequest | SyncRequest | GuestChatIntent

export type AuthoritySnapshot = {
  partyId: string
  incarnationId: string
  hostAppIdentity: string
  sequence: number
  locked: boolean
  members: CanonicalMemberView[]
  messages: CanonicalChatEvent[]
}

export type AuthoritySyncResponse = {
  version: typeof POC_AUTHORITY_VERSION
  type: 'sync.response'
  mode: 'delta' | 'snapshot'
  sequence: number
  retainedFromSequence: number
  acceptedClientSequence: number
  events: CanonicalAuthorityEvent[]
  snapshot: AuthoritySnapshot | null
}

export type GuestReplica = {
  partyId: string
  incarnationId: string
  hostAppIdentity: string
  memberId: string
  lastCanonicalSequence: number
  locked: boolean
  members: CanonicalMemberView[]
  messages: CanonicalChatEvent[]
}

export type AuthenticationResult =
  | {
      accepted: true
      resumed: boolean
      state: HostAuthorityState
      member: HostAuthorityMember
      event: MemberAdmittedEvent | null
    }
  | {
      accepted: false
      reason: 'invalid-credential' | 'member-removed' | 'party-locked' | 'party-full'
      state: HostAuthorityState
    }

export type ChatCommitResult =
  | {
      accepted: true
      state: HostAuthorityState
      event: CanonicalChatEvent
    }
  | {
      accepted: false
      reason: 'unknown-member' | 'member-removed' | 'invalid-intent' | 'duplicate-or-replay' | 'sequence-gap'
      state: HostAuthorityState
    }

export type AuthorityMutationResult<TEvent extends CanonicalAuthorityEvent> = {
  state: HostAuthorityState
  event: TEvent | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isCredentialVerifier(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 256
}

function normalizeChatText(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= POC_MAX_CHAT_LENGTH ? trimmed : null
}

function publicMember(member: HostAuthorityMember): CanonicalMemberView {
  return {
    memberId: member.memberId,
    label: member.label,
    removed: member.removed,
  }
}

function appendEvent(state: HostAuthorityState, event: CanonicalAuthorityEvent): HostAuthorityState {
  return {
    ...state,
    canonicalSequence: event.sequence,
    events: [...state.events, event].slice(-POC_HISTORY_LIMIT),
  }
}

function nextSequence(state: HostAuthorityState) {
  return state.canonicalSequence + 1
}

export function createInitialHostAuthorityState({
  partyId,
  incarnationId,
  hostAppIdentity,
}: {
  partyId: string
  incarnationId: string
  hostAppIdentity: string
}): HostAuthorityState {
  if (!isPocIdentity(partyId) || !isPocIdentity(incarnationId) || !isPocIdentity(hostAppIdentity)) {
    throw new Error('Host authority identities must be UUID v4 values')
  }
  return {
    version: POC_AUTHORITY_VERSION,
    partyId,
    incarnationId,
    hostAppIdentity,
    locked: false,
    canonicalSequence: 0,
    members: [],
    events: [],
  }
}

export function authenticateMember(
  state: HostAuthorityState,
  credential: { credentialId: string; credentialVerifier: string },
  createMemberId: () => string = () => crypto.randomUUID(),
): AuthenticationResult {
  if (!isPocIdentity(credential.credentialId) || !isCredentialVerifier(credential.credentialVerifier)) {
    return { accepted: false, reason: 'invalid-credential', state }
  }

  const existing = state.members.find((member) => member.credentialId === credential.credentialId)
  if (existing) {
    if (existing.credentialVerifier !== credential.credentialVerifier) {
      return { accepted: false, reason: 'invalid-credential', state }
    }
    if (existing.removed) {
      return { accepted: false, reason: 'member-removed', state }
    }
    return { accepted: true, resumed: true, state, member: existing, event: null }
  }

  if (state.locked) {
    return { accepted: false, reason: 'party-locked', state }
  }
  if (state.members.filter((member) => !member.removed).length >= MAX_GUESTS) {
    return { accepted: false, reason: 'party-full', state }
  }

  const memberId = createMemberId()
  if (!isPocIdentity(memberId)) {
    throw new Error('Member identity factory returned an invalid identity')
  }
  const member: HostAuthorityMember = {
    memberId,
    credentialId: credential.credentialId,
    credentialVerifier: credential.credentialVerifier,
    label: `Guest ${state.members.length + 1}`,
    removed: false,
    lastClientSequence: 0,
  }
  const event: MemberAdmittedEvent = {
    sequence: nextSequence(state),
    type: 'member.admitted',
    member: publicMember(member),
  }
  const next = appendEvent({ ...state, members: [...state.members, member] }, event)
  return { accepted: true, resumed: false, state: next, member, event }
}

export function commitGuestChatIntent(
  state: HostAuthorityState,
  memberId: string,
  intent: GuestChatIntent,
): ChatCommitResult {
  const memberIndex = state.members.findIndex((candidate) => candidate.memberId === memberId)
  if (memberIndex < 0) {
    return { accepted: false, reason: 'unknown-member', state }
  }
  const member = state.members[memberIndex]!
  if (member.removed) {
    return { accepted: false, reason: 'member-removed', state }
  }

  const text = normalizeChatText(intent.text)
  if (intent.version !== POC_AUTHORITY_VERSION || intent.type !== 'chat.intent' || !isPositiveInteger(intent.clientSequence) || !text) {
    return { accepted: false, reason: 'invalid-intent', state }
  }
  if (intent.clientSequence <= member.lastClientSequence) {
    return { accepted: false, reason: 'duplicate-or-replay', state }
  }
  if (intent.clientSequence !== member.lastClientSequence + 1) {
    return { accepted: false, reason: 'sequence-gap', state }
  }

  const updatedMember: HostAuthorityMember = {
    ...member,
    lastClientSequence: intent.clientSequence,
  }
  const members = [...state.members]
  members[memberIndex] = updatedMember
  const event: CanonicalChatEvent = {
    sequence: nextSequence(state),
    type: 'chat.message',
    sender: { memberId: member.memberId, label: member.label },
    text,
    clientSequence: intent.clientSequence,
  }
  return {
    accepted: true,
    state: appendEvent({ ...state, members }, event),
    event,
  }
}

export function setPartyLocked(
  state: HostAuthorityState,
  locked: boolean,
): AuthorityMutationResult<PartyLockedEvent> {
  if (state.locked === locked) {
    return { state, event: null }
  }
  const event: PartyLockedEvent = {
    sequence: nextSequence(state),
    type: 'party.locked',
    locked,
  }
  return {
    state: appendEvent({ ...state, locked }, event),
    event,
  }
}

export function removeMember(
  state: HostAuthorityState,
  memberId: string,
): AuthorityMutationResult<MemberRemovedEvent> {
  const index = state.members.findIndex((member) => member.memberId === memberId)
  if (index < 0 || state.members[index]!.removed) {
    return { state, event: null }
  }
  const members = [...state.members]
  members[index] = { ...members[index]!, removed: true }
  const event: MemberRemovedEvent = {
    sequence: nextSequence(state),
    type: 'member.removed',
    memberId,
  }
  return {
    state: appendEvent({ ...state, members }, event),
    event,
  }
}

function snapshotFor(state: HostAuthorityState): AuthoritySnapshot {
  return {
    partyId: state.partyId,
    incarnationId: state.incarnationId,
    hostAppIdentity: state.hostAppIdentity,
    sequence: state.canonicalSequence,
    locked: state.locked,
    members: state.members.map(publicMember),
    messages: state.events.filter((event): event is CanonicalChatEvent => event.type === 'chat.message'),
  }
}

export function buildSyncResponse(
  state: HostAuthorityState,
  memberId: string,
  lastCanonicalSequence: number,
  options: { allowRemoved?: boolean } = {},
): AuthoritySyncResponse {
  const member = state.members.find((candidate) => candidate.memberId === memberId)
  if (!member || (member.removed && !options.allowRemoved)) {
    throw new Error('Member is not authorized to sync')
  }
  if (!isNonNegativeInteger(lastCanonicalSequence)) {
    throw new Error('Invalid canonical sequence')
  }

  const retainedFromSequence = state.events[0]?.sequence ?? state.canonicalSequence + 1
  const canDelta = lastCanonicalSequence <= state.canonicalSequence
    && lastCanonicalSequence >= retainedFromSequence - 1
  if (canDelta) {
    return {
      version: POC_AUTHORITY_VERSION,
      type: 'sync.response',
      mode: 'delta',
      sequence: state.canonicalSequence,
      retainedFromSequence,
      acceptedClientSequence: member.lastClientSequence,
      events: state.events.filter((event) => event.sequence > lastCanonicalSequence),
      snapshot: null,
    }
  }

  return {
    version: POC_AUTHORITY_VERSION,
    type: 'sync.response',
    mode: 'snapshot',
    sequence: state.canonicalSequence,
    retainedFromSequence,
    acceptedClientSequence: member.lastClientSequence,
    events: [],
    snapshot: snapshotFor(state),
  }
}

export function createGuestReplica({
  partyId,
  hostAppIdentity,
  incarnationId,
  memberId,
}: {
  partyId: string
  hostAppIdentity: string
  incarnationId: string
  memberId: string
}): GuestReplica {
  return {
    partyId,
    hostAppIdentity,
    incarnationId,
    memberId,
    lastCanonicalSequence: 0,
    locked: false,
    members: [],
    messages: [],
  }
}

function applyEvent(replica: GuestReplica, event: CanonicalAuthorityEvent): GuestReplica {
  if (event.sequence <= replica.lastCanonicalSequence) {
    return replica
  }
  if (event.sequence !== replica.lastCanonicalSequence + 1) {
    throw new Error('Canonical event gap requires snapshot recovery')
  }

  if (event.type === 'member.admitted') {
    const without = replica.members.filter((member) => member.memberId !== event.member.memberId)
    return {
      ...replica,
      lastCanonicalSequence: event.sequence,
      members: [...without, event.member],
    }
  }
  if (event.type === 'member.removed') {
    return {
      ...replica,
      lastCanonicalSequence: event.sequence,
      members: replica.members.map((member) => (
        member.memberId === event.memberId ? { ...member, removed: true } : member
      )),
    }
  }
  if (event.type === 'party.locked') {
    return { ...replica, lastCanonicalSequence: event.sequence, locked: event.locked }
  }
  return {
    ...replica,
    lastCanonicalSequence: event.sequence,
    messages: [...replica.messages, event].slice(-POC_HISTORY_LIMIT),
  }
}

export function applySyncToGuestReplica(
  replica: GuestReplica,
  response: AuthoritySyncResponse,
): GuestReplica {
  if (response.mode === 'snapshot') {
    const snapshot = response.snapshot
    if (!snapshot || snapshot.partyId !== replica.partyId || snapshot.hostAppIdentity !== replica.hostAppIdentity) {
      throw new Error('Invalid authority snapshot')
    }
    return {
      ...replica,
      incarnationId: snapshot.incarnationId,
      lastCanonicalSequence: snapshot.sequence,
      locked: snapshot.locked,
      members: snapshot.members,
      messages: snapshot.messages,
    }
  }

  let next = replica
  for (const event of response.events) {
    next = applyEvent(next, event)
  }
  if (next.lastCanonicalSequence !== response.sequence) {
    throw new Error('Incomplete authority delta')
  }
  return next
}

export function parseAuthorityWireMessage(value: unknown): GuestAuthorityRequest | null {
  if (!isRecord(value) || value.version !== POC_AUTHORITY_VERSION || typeof value.type !== 'string') {
    return null
  }
  if (value.type === 'auth.request') {
    if (!isPocIdentity(value.credentialId) || !isPocIdentity(value.credentialSecret) || !isNonNegativeInteger(value.lastCanonicalSequence)) {
      return null
    }
    return {
      version: POC_AUTHORITY_VERSION,
      type: 'auth.request',
      credentialId: value.credentialId,
      credentialSecret: value.credentialSecret,
      lastCanonicalSequence: value.lastCanonicalSequence,
    }
  }
  if (value.type === 'sync.request') {
    if (!isNonNegativeInteger(value.lastCanonicalSequence)) {
      return null
    }
    return {
      version: POC_AUTHORITY_VERSION,
      type: 'sync.request',
      lastCanonicalSequence: value.lastCanonicalSequence,
    }
  }
  if (value.type === 'chat.intent') {
    const text = normalizeChatText(value.text)
    if (!isPositiveInteger(value.clientSequence) || !text) {
      return null
    }
    return {
      version: POC_AUTHORITY_VERSION,
      type: 'chat.intent',
      clientSequence: value.clientSequence,
      text,
      ...(typeof value.claimedSender === 'string' ? { claimedSender: value.claimedSender } : {}),
    }
  }
  return null
}

function isCanonicalMember(value: unknown): value is CanonicalMemberView {
  return isRecord(value)
    && isPocIdentity(value.memberId)
    && typeof value.label === 'string'
    && value.label.length > 0
    && value.label.length <= 64
    && typeof value.removed === 'boolean'
}

function isHostMember(value: unknown): value is HostAuthorityMember {
  return isCanonicalMember(value)
    && isPocIdentity(value.credentialId)
    && isCredentialVerifier(value.credentialVerifier)
    && isNonNegativeInteger(value.lastClientSequence)
}

function isCanonicalEvent(value: unknown): value is CanonicalAuthorityEvent {
  if (!isRecord(value) || !isPositiveInteger(value.sequence) || typeof value.type !== 'string') {
    return false
  }
  if (value.type === 'member.admitted') {
    return isCanonicalMember(value.member)
  }
  if (value.type === 'member.removed') {
    return isPocIdentity(value.memberId)
  }
  if (value.type === 'party.locked') {
    return typeof value.locked === 'boolean'
  }
  if (value.type === 'chat.message') {
    return isRecord(value.sender)
      && isPocIdentity(value.sender.memberId)
      && typeof value.sender.label === 'string'
      && Boolean(normalizeChatText(value.text))
      && isPositiveInteger(value.clientSequence)
  }
  return false
}

export function isHostAuthorityState(value: unknown): value is HostAuthorityState {
  if (!isRecord(value)
    || value.version !== POC_AUTHORITY_VERSION
    || !isPocIdentity(value.partyId)
    || !isPocIdentity(value.incarnationId)
    || !isPocIdentity(value.hostAppIdentity)
    || typeof value.locked !== 'boolean'
    || !isNonNegativeInteger(value.canonicalSequence)
    || !Array.isArray(value.members)
    || !value.members.every(isHostMember)
    || !Array.isArray(value.events)
    || value.events.length > POC_HISTORY_LIMIT
    || !value.events.every(isCanonicalEvent)) {
    return false
  }

  const events = value.events as CanonicalAuthorityEvent[]
  if (events.length === 0) {
    return value.canonicalSequence === 0
  }
  for (let index = 1; index < events.length; index += 1) {
    if (events[index]!.sequence !== events[index - 1]!.sequence + 1) {
      return false
    }
  }
  return events.at(-1)!.sequence === value.canonicalSequence
}
