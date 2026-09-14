import { MAX_CHAT_HISTORY } from '../../chat/chatProtocol'
import type { GuestPartyRecord } from './guestPartyStore'
import type { PartyCanonicalWireEvent } from './partyProtocol'
import type { PartyChatMessage, PartyMemberView } from './partyTypes'

type DeltaInput = {
  incarnationId: string
  fromCanonicalSequence: number
  toCanonicalSequence: number
  events: PartyCanonicalWireEvent[]
}

type SnapshotInput = {
  incarnationId: string
  canonicalSequence: number
  locked: boolean
  members: PartyMemberView[]
  messages: PartyChatMessage[]
}

export type ReplicaApplyResult =
  | { applied: true }
  | { applied: false; reason: 'wrong-incarnation' | 'gap' | 'invalid-delta' }

function applyEvent(
  state: GuestPartyRecord,
  event: PartyCanonicalWireEvent,
): GuestPartyRecord {
  switch (event.kind) {
    case 'chat':
      return {
        ...state,
        canonicalSequence: event.canonicalSequence,
        messages: [...state.messages, event.message].slice(-MAX_CHAT_HISTORY),
      }
    case 'member-joined': {
      const members = state.members.filter((member) => member.memberId !== event.member.memberId)
      return {
        ...state,
        canonicalSequence: event.canonicalSequence,
        members: event.member.removed ? members : [...members, event.member],
      }
    }
    case 'admission-locked':
      return { ...state, canonicalSequence: event.canonicalSequence, locked: true }
    case 'admission-unlocked':
      return { ...state, canonicalSequence: event.canonicalSequence, locked: false }
    case 'member-removed':
      return {
        ...state,
        canonicalSequence: event.canonicalSequence,
        members: state.members.filter((member) => member.memberId !== event.memberId),
      }
  }
}

export class GuestPartyReplica {
  private record: GuestPartyRecord

  constructor(record: GuestPartyRecord) {
    this.record = record
  }

  get state() {
    return this.record
  }

  replaceAuthentication(input: {
    incarnationId: string
    memberId: string
    label: string
    nextRequestSequence: number
  }) {
    this.record = {
      ...this.record,
      incarnationId: input.incarnationId,
      memberId: input.memberId,
      label: input.label,
      nextRequestSequence: input.nextRequestSequence,
    }
  }

  setNextRequestSequence(nextRequestSequence: number) {
    this.record = { ...this.record, nextRequestSequence }
  }

  applyDelta(input: DeltaInput): ReplicaApplyResult {
    if (this.record.incarnationId && input.incarnationId !== this.record.incarnationId) {
      return { applied: false, reason: 'wrong-incarnation' }
    }

    if (input.events.length === 0) {
      if (input.fromCanonicalSequence !== input.toCanonicalSequence
        || input.toCanonicalSequence !== this.record.canonicalSequence) {
        return { applied: false, reason: 'invalid-delta' }
      }
      return { applied: true }
    }

    const expectedStart = this.record.canonicalSequence + 1
    if (input.fromCanonicalSequence !== expectedStart) {
      return { applied: false, reason: 'gap' }
    }
    if (input.events[0]?.canonicalSequence !== input.fromCanonicalSequence
      || input.events.at(-1)?.canonicalSequence !== input.toCanonicalSequence) {
      return { applied: false, reason: 'invalid-delta' }
    }

    let expectedSequence = expectedStart
    let candidate = this.record.incarnationId
      ? this.record
      : { ...this.record, incarnationId: input.incarnationId }

    for (const event of input.events) {
      if (event.canonicalSequence !== expectedSequence) {
        return { applied: false, reason: 'invalid-delta' }
      }
      candidate = applyEvent(candidate, event)
      expectedSequence += 1
    }

    this.record = candidate
    return { applied: true }
  }

  applySnapshot(input: SnapshotInput): ReplicaApplyResult {
    if (this.record.incarnationId && input.incarnationId !== this.record.incarnationId) {
      return { applied: false, reason: 'wrong-incarnation' }
    }

    this.record = {
      ...this.record,
      incarnationId: input.incarnationId,
      canonicalSequence: input.canonicalSequence,
      locked: input.locked,
      members: input.members.filter((member) => !member.removed),
      messages: input.messages.slice(-MAX_CHAT_HISTORY),
    }
    return { applied: true }
  }
}
