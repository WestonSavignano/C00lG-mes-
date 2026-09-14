import { describe, expect, it } from 'vitest'
import {
  POC_HISTORY_LIMIT,
  applySyncToGuestReplica,
  authenticateMember,
  buildSyncResponse,
  commitGuestChatIntent,
  createGuestReplica,
  createInitialHostAuthorityState,
  parseAuthorityWireMessage,
  removeMember,
  setPartyLocked,
} from './hostAuthorityModel'

const PARTY_ID = '11111111-1111-4111-8111-111111111111'
const INCARNATION_ID = '22222222-2222-4222-8222-222222222222'
const HOST_ID = '33333333-3333-4333-8333-333333333333'
const CREDENTIAL_ID = '44444444-4444-4444-8444-444444444444'
const MEMBER_ID = '55555555-5555-4555-8555-555555555555'
const CREDENTIAL_VERIFIER = 'sha256:test-credential'

function initialState() {
  return createInitialHostAuthorityState({
    partyId: PARTY_ID,
    incarnationId: INCARNATION_ID,
    hostAppIdentity: HOST_ID,
  })
}

function admittedState() {
  const result = authenticateMember(initialState(), {
    credentialId: CREDENTIAL_ID,
    credentialVerifier: CREDENTIAL_VERIFIER,
  }, () => MEMBER_ID)
  if (!result.accepted) {
    throw new Error('Expected member admission')
  }
  return result
}

describe('host-authoritative POC model', () => {
  it('admits a new credential only while open and assigns canonical member identity', () => {
    const result = admittedState()

    expect(result.member.memberId).toBe(MEMBER_ID)
    expect(result.member.credentialId).toBe(CREDENTIAL_ID)
    expect(result.state.canonicalSequence).toBe(1)
    expect(result.state.events.at(-1)).toMatchObject({
      sequence: 1,
      type: 'member.admitted',
      member: { memberId: MEMBER_ID, label: 'Guest 1' },
    })

    const locked = setPartyLocked(initialState(), true)
    const denied = authenticateMember(locked.state, {
      credentialId: CREDENTIAL_ID,
      credentialVerifier: CREDENTIAL_VERIFIER,
    }, () => MEMBER_ID)
    expect(denied).toMatchObject({ accepted: false, reason: 'party-locked' })
  })

  it('authenticates a returning member without trusting a transient peer id', () => {
    const first = admittedState()
    const returning = authenticateMember(first.state, {
      credentialId: CREDENTIAL_ID,
      credentialVerifier: CREDENTIAL_VERIFIER,
    }, () => '66666666-6666-4666-8666-666666666666')

    expect(returning).toMatchObject({
      accepted: true,
      resumed: true,
      member: { memberId: MEMBER_ID },
    })
    if (returning.accepted) {
      expect(returning.state).toBe(first.state)
      expect(returning.state.canonicalSequence).toBe(1)
    }
  })

  it('rejects a forged credential for an existing identity', () => {
    const first = admittedState()
    const forged = authenticateMember(first.state, {
      credentialId: CREDENTIAL_ID,
      credentialVerifier: 'sha256:wrong',
    }, () => MEMBER_ID)

    expect(forged).toMatchObject({ accepted: false, reason: 'invalid-credential' })
  })

  it('assigns canonical sender and sequence instead of trusting guest claims', () => {
    const first = admittedState()
    const result = commitGuestChatIntent(first.state, MEMBER_ID, {
      version: 1,
      type: 'chat.intent',
      clientSequence: 1,
      text: ' hello authority ',
      claimedSender: HOST_ID,
    })

    expect(result).toMatchObject({ accepted: true })
    if (!result.accepted) {
      return
    }
    expect(result.event).toMatchObject({
      sequence: 2,
      type: 'chat.message',
      sender: { memberId: MEMBER_ID, label: 'Guest 1' },
      text: 'hello authority',
      clientSequence: 1,
    })
    expect(result.event.sender.memberId).not.toBe(HOST_ID)
  })

  it('rejects duplicate, replayed, and skipped guest intent sequences', () => {
    const first = admittedState()
    const committed = commitGuestChatIntent(first.state, MEMBER_ID, {
      version: 1,
      type: 'chat.intent',
      clientSequence: 1,
      text: 'once',
    })
    if (!committed.accepted) {
      throw new Error('Expected first intent to commit')
    }

    expect(commitGuestChatIntent(committed.state, MEMBER_ID, {
      version: 1,
      type: 'chat.intent',
      clientSequence: 1,
      text: 'replay',
    })).toMatchObject({ accepted: false, reason: 'duplicate-or-replay' })

    expect(commitGuestChatIntent(committed.state, MEMBER_ID, {
      version: 1,
      type: 'chat.intent',
      clientSequence: 3,
      text: 'gap',
    })).toMatchObject({ accepted: false, reason: 'sequence-gap' })
  })

  it('returns deltas inside retained history and a snapshot when the guest is too stale', () => {
    let state = admittedState().state
    for (let clientSequence = 1; clientSequence <= POC_HISTORY_LIMIT + 3; clientSequence += 1) {
      const committed = commitGuestChatIntent(state, MEMBER_ID, {
        version: 1,
        type: 'chat.intent',
        clientSequence,
        text: `message ${clientSequence}`,
      })
      if (!committed.accepted) {
        throw new Error(`Intent ${clientSequence} should commit`)
      }
      state = committed.state
    }

    const delta = buildSyncResponse(state, MEMBER_ID, state.canonicalSequence - 2)
    expect(delta.mode).toBe('delta')
    expect(delta.events).toHaveLength(2)

    const snapshot = buildSyncResponse(state, MEMBER_ID, 0)
    expect(snapshot.mode).toBe('snapshot')
    expect(snapshot.sequence).toBe(state.canonicalSequence)
    expect(snapshot.snapshot?.messages.at(-1)?.text).toBe(`message ${POC_HISTORY_LIMIT + 3}`)
  })

  it('keeps removal and lock state authoritative across stale guest replicas', () => {
    const first = admittedState()
    const locked = setPartyLocked(first.state, true)
    const removed = removeMember(locked.state, MEMBER_ID)

    const denied = authenticateMember(removed.state, {
      credentialId: CREDENTIAL_ID,
      credentialVerifier: CREDENTIAL_VERIFIER,
    }, () => MEMBER_ID)
    expect(denied).toMatchObject({ accepted: false, reason: 'member-removed' })

    const staleReplica = createGuestReplica({
      partyId: PARTY_ID,
      hostAppIdentity: HOST_ID,
      incarnationId: INCARNATION_ID,
      memberId: MEMBER_ID,
    })
    const converged = applySyncToGuestReplica(
      { ...staleReplica, locked: false, members: [{ memberId: MEMBER_ID, label: 'Guest 1', removed: false }] },
      buildSyncResponse(removed.state, MEMBER_ID, 0, { allowRemoved: true }),
    )
    expect(converged.locked).toBe(true)
    expect(converged.members.find((member) => member.memberId === MEMBER_ID)?.removed).toBe(true)
  })

  it('rejects malformed protocol messages before authority code handles them', () => {
    expect(parseAuthorityWireMessage(null)).toBeNull()
    expect(parseAuthorityWireMessage({ version: 2, type: 'sync.request', lastCanonicalSequence: 0 })).toBeNull()
    expect(parseAuthorityWireMessage({ version: 1, type: 'chat.intent', clientSequence: 0, text: 'bad' })).toBeNull()
    expect(parseAuthorityWireMessage({ version: 1, type: 'sync.request', lastCanonicalSequence: -1 })).toBeNull()
  })
})
