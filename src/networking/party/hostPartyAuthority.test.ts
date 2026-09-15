import { describe, expect, it } from 'vitest'
import { ChatRateLimiter } from '../../chat/chatRateLimiter'
import { HostPartyAuthority } from './hostPartyAuthority'
import {
  createInitialHostPartyRecord,
  type HostPartyRecord,
  type HostPartyStore,
} from './hostPartyStore'

class MemoryHostPartyStore implements HostPartyStore {
  value: HostPartyRecord | null = null
  failSaves = false

  async load(partyId: string) {
    return this.value?.partyId === partyId ? this.value : null
  }

  async save(record: HostPartyRecord) {
    if (this.failSaves) {
      throw new Error('storage unavailable')
    }
    await Promise.resolve()
    this.value = record
  }
}

async function setup(options?: { rateLimiter?: ChatRateLimiter; moderate?: (text: string) => string }) {
  const store = new MemoryHostPartyStore()
  const record = await createInitialHostPartyRecord({ partyId: 'party-a' })
  const authority = await HostPartyAuthority.create(store, record, options)
  return { store, record, authority }
}

async function admit(authority: HostPartyAuthority, record: HostPartyRecord, suffix = 'a') {
  const result = await authority.authenticateNew({
    admissionCapability: record.admissionCapability ?? '',
    credentialId: `credential-${suffix}`,
    credentialSecret: `secret-${suffix}`,
  })
  if (!result.accepted) {
    throw new Error(`Expected admission, got ${result.reason}`)
  }
  return result.member
}

describe('HostPartyAuthority', () => {
  it('persists a party before use and restores the same incarnation and host identity', async () => {
    const { store, authority } = await setup()

    const restored = await HostPartyAuthority.restore(store, 'party-a')

    expect(restored.state.partyId).toBe('party-a')
    expect(restored.state.incarnationId).toBe(authority.state.incarnationId)
    expect(restored.state.hostFingerprint).toBe(authority.state.hostFingerprint)
    expect(restored.state.hostPrivateKey).toBe(authority.state.hostPrivateKey)
  })

  it('separates admission from resume, persists lock before acknowledgement, and rotates only admission on unlock', async () => {
    const { authority, record } = await setup()
    const originalAdmission = record.admissionCapability ?? ''
    const originalRendezvous = record.rendezvousCapability
    const member = await admit(authority, record)

    await authority.setAdmissionLocked(true)
    expect(authority.state.locked).toBe(true)
    expect(authority.state.admissionCapability).toBeNull()

    expect(await authority.authenticateNew({
      admissionCapability: originalAdmission,
      credentialId: 'credential-new',
      credentialSecret: 'secret-new',
    })).toMatchObject({ accepted: false, reason: 'party-locked' })

    expect(await authority.authenticateResume({
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    })).toMatchObject({ accepted: true, member: { memberId: member.memberId } })

    const unlocked = await authority.setAdmissionLocked(false)
    expect(unlocked.admissionCapability).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(unlocked.admissionCapability).not.toBe(originalAdmission)
    expect(authority.state.rendezvousCapability).toBe(originalRendezvous)

    expect(await authority.authenticateNew({
      admissionCapability: originalAdmission,
      credentialId: 'credential-old-invite',
      credentialSecret: 'secret-old-invite',
    })).toMatchObject({ accepted: false, reason: 'invalid-admission' })
  })

  it('keeps canonical member identity stable while replacing transient transports and rejects stale attempts', async () => {
    const { authority, record } = await setup()
    const member = await admit(authority, record)

    expect(authority.bindTransport(member.memberId, 'peer-old', 'attempt-old')).toEqual({ replaced: null })
    expect(authority.bindTransport(member.memberId, 'peer-new', 'attempt-new')).toEqual({
      replaced: { peerId: 'peer-old', transportAttemptId: 'attempt-old' },
    })
    expect(authority.memberForTransport('peer-old', 'attempt-old')).toBeNull()
    expect(authority.memberForTransport('peer-new', 'attempt-new')).toBe(member.memberId)

    expect(await authority.submitChat({
      memberId: member.memberId,
      peerId: 'peer-old',
      transportAttemptId: 'attempt-old',
      requestSequence: 1,
      clientMessageId: 'client-old',
      sentAt: 10,
      text: 'stale',
    })).toMatchObject({ accepted: false, reason: 'stale-transport' })
  })

  it('assigns canonical sender identity at the host and enforces duplicate/gap request sequencing', async () => {
    const { authority, record } = await setup({ moderate: (text) => text.replace('bad', '***') })
    const member = await admit(authority, record)
    authority.bindTransport(member.memberId, 'peer-a', 'attempt-a')

    const first = await authority.submitChat({
      memberId: member.memberId,
      peerId: 'peer-a',
      transportAttemptId: 'attempt-a',
      requestSequence: 1,
      clientMessageId: 'client-a',
      sentAt: 10,
      text: 'bad hello',
    })

    expect(first).toMatchObject({
      accepted: true,
      event: {
        canonicalSequence: 2,
        message: {
          sender: { memberId: member.memberId, label: member.label },
          text: '*** hello',
        },
      },
    })
    expect(authority.state.members[0]?.lastAcceptedRequestSequence).toBe(1)

    const sequenceAfterFirst = authority.state.canonicalSequence
    expect(await authority.submitChat({
      memberId: member.memberId,
      peerId: 'peer-a',
      transportAttemptId: 'attempt-a',
      requestSequence: 1,
      clientMessageId: 'client-duplicate',
      sentAt: 11,
      text: 'duplicate',
    })).toMatchObject({ accepted: false, reason: 'duplicate-or-replay' })
    expect(authority.state.canonicalSequence).toBe(sequenceAfterFirst)

    expect(await authority.submitChat({
      memberId: member.memberId,
      peerId: 'peer-a',
      transportAttemptId: 'attempt-a',
      requestSequence: 3,
      clientMessageId: 'client-gap',
      sentAt: 12,
      text: 'gap',
    })).toMatchObject({ accepted: false, reason: 'request-gap' })
  })

  it('does not advance authority when persistence fails', async () => {
    const { store, authority } = await setup()
    const before = authority.state
    store.failSaves = true

    await expect(authority.setAdmissionLocked(true)).rejects.toThrow('storage unavailable')

    expect(authority.state).toBe(before)
    expect(authority.state.locked).toBe(false)
    expect(authority.state.canonicalSequence).toBe(0)
  })

  it('persists removal tombstones across restore and denies removed credentials', async () => {
    const { store, authority, record } = await setup()
    const member = await admit(authority, record)

    await authority.removeMember(member.memberId)
    const restored = await HostPartyAuthority.restore(store, 'party-a')

    expect(restored.state.members.find((candidate) => candidate.memberId === member.memberId)?.removed).toBe(true)
    expect(await restored.authenticateResume({
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    })).toMatchObject({ accepted: false, reason: 'member-removed' })
  })

  it('retains only 200 canonical events/messages and falls back to a snapshot for stale cursors', async () => {
    const { authority } = await setup()

    for (let sequence = 1; sequence <= 205; sequence += 1) {
      await authority.commitHostChat({
        clientMessageId: `host-${sequence}`,
        sentAt: sequence,
        text: `message ${sequence}`,
      })
    }

    expect(authority.state.history).toHaveLength(200)
    expect(authority.state.messages).toHaveLength(200)
    expect(authority.buildSync(0).kind).toBe('snapshot')
    expect(authority.buildSync(204)).toMatchObject({
      kind: 'delta',
      fromCanonicalSequence: 205,
      toCanonicalSequence: 205,
      events: [{ canonicalSequence: 205 }],
    })
  })

  it('rate-limits one member without removing it or consuming its next request sequence', async () => {
    const limiter = new ChatRateLimiter({ capacity: 1, refillPerSecond: 0, now: () => 1_000 })
    const { authority, record } = await setup({ rateLimiter: limiter })
    const member = await admit(authority, record)
    authority.bindTransport(member.memberId, 'peer-a', 'attempt-a')

    expect((await authority.submitChat({
      memberId: member.memberId,
      peerId: 'peer-a',
      transportAttemptId: 'attempt-a',
      requestSequence: 1,
      clientMessageId: 'first',
      sentAt: 1,
      text: 'first',
    })).accepted).toBe(true)

    expect(await authority.submitChat({
      memberId: member.memberId,
      peerId: 'peer-a',
      transportAttemptId: 'attempt-a',
      requestSequence: 2,
      clientMessageId: 'second',
      sentAt: 2,
      text: 'second',
    })).toMatchObject({ accepted: false, reason: 'rate-limited' })

    expect(authority.state.members[0]).toMatchObject({
      memberId: member.memberId,
      removed: false,
      lastAcceptedRequestSequence: 1,
    })
  })
})
