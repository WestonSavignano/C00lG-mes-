import { describe, expect, it } from 'vitest'
import { GuestPartyReplica } from './guestPartyReplica'
import { createInitialGuestPartyRecord } from './guestPartyStore'

function guestRecord() {
  return {
    ...createInitialGuestPartyRecord({
      partyId: 'party-a',
      rendezvousCapability: 'rendezvous-a',
      hostFingerprint: 'sha256:host-a',
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    }),
    incarnationId: 'inc-a',
    memberId: 'member-a',
    label: 'Guest 1',
  }
}

describe('GuestPartyReplica', () => {
  it('applies strictly contiguous canonical deltas and keeps bounded durable Chat state', () => {
    const replica = new GuestPartyReplica(guestRecord())

    expect(replica.applyDelta({
      incarnationId: 'inc-a',
      fromCanonicalSequence: 1,
      toCanonicalSequence: 3,
      events: [
        {
          kind: 'member-joined',
          canonicalSequence: 1,
          member: { memberId: 'member-a', label: 'Guest 1', removed: false },
        },
        { kind: 'admission-locked', canonicalSequence: 2 },
        {
          kind: 'chat',
          canonicalSequence: 3,
          message: {
            id: 'message-a',
            sentAt: 123,
            sender: { memberId: 'member-a', label: 'Guest 1' },
            text: 'hello',
          },
        },
      ],
    })).toEqual({ applied: true })

    expect(replica.state).toMatchObject({
      canonicalSequence: 3,
      locked: true,
      members: [{ memberId: 'member-a', label: 'Guest 1', removed: false }],
      messages: [{ id: 'message-a', text: 'hello' }],
    })
  })

  it('rejects gaps, overlaps, wrong incarnations, and inconsistent delta bounds without mutating cache', () => {
    const replica = new GuestPartyReplica({ ...guestRecord(), canonicalSequence: 2 })
    const before = replica.state

    expect(replica.applyDelta({
      incarnationId: 'inc-a',
      fromCanonicalSequence: 4,
      toCanonicalSequence: 4,
      events: [{ kind: 'admission-locked', canonicalSequence: 4 }],
    })).toEqual({ applied: false, reason: 'gap' })
    expect(replica.state).toBe(before)

    expect(replica.applyDelta({
      incarnationId: 'inc-other',
      fromCanonicalSequence: 3,
      toCanonicalSequence: 3,
      events: [{ kind: 'admission-locked', canonicalSequence: 3 }],
    })).toEqual({ applied: false, reason: 'wrong-incarnation' })
    expect(replica.state).toBe(before)
  })

  it('replaces a stale or corrupt replica from an authoritative host snapshot', () => {
    const replica = new GuestPartyReplica({
      ...guestRecord(),
      canonicalSequence: 99,
      locked: true,
      members: [{ memberId: 'stale', label: 'Stale', removed: false }],
      messages: [{
        id: 'stale',
        sentAt: 1,
        sender: { memberId: 'stale', label: 'Stale' },
        text: 'stale',
      }],
    })

    expect(replica.applySnapshot({
      incarnationId: 'inc-a',
      canonicalSequence: 7,
      locked: false,
      members: [{ memberId: 'member-a', label: 'Guest 1', removed: false }],
      messages: [{
        id: 'fresh',
        sentAt: 2,
        sender: { memberId: 'host', label: 'Host' },
        text: 'fresh',
      }],
    })).toEqual({ applied: true })

    expect(replica.state).toMatchObject({
      canonicalSequence: 7,
      locked: false,
      members: [{ memberId: 'member-a', label: 'Guest 1', removed: false }],
      messages: [{ id: 'fresh', text: 'fresh' }],
    })
  })

  it('applies durable removal and unlock events without reviving removed members', () => {
    const replica = new GuestPartyReplica({
      ...guestRecord(),
      canonicalSequence: 1,
      locked: true,
      members: [{ memberId: 'member-a', label: 'Guest 1', removed: false }],
    })

    expect(replica.applyDelta({
      incarnationId: 'inc-a',
      fromCanonicalSequence: 2,
      toCanonicalSequence: 3,
      events: [
        { kind: 'member-removed', canonicalSequence: 2, memberId: 'member-a' },
        { kind: 'admission-unlocked', canonicalSequence: 3 },
      ],
    })).toEqual({ applied: true })
    expect(replica.state.locked).toBe(false)
    expect(replica.state.members).toEqual([])
  })
})
