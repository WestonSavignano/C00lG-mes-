import { describe, expect, it } from 'vitest'
import {
  HostAuthoritySession,
  type HostAuthorityStore,
} from './hostAuthoritySession'
import { createInitialHostAuthorityState, type HostAuthorityState } from './hostAuthorityModel'

const PARTY_ID = '11111111-1111-4111-8111-111111111111'
const INCARNATION_ID = '22222222-2222-4222-8222-222222222222'
const HOST_ID = '33333333-3333-4333-8333-333333333333'
const CREDENTIAL_ID = '44444444-4444-4444-8444-444444444444'
const MEMBER_ID = '55555555-5555-4555-8555-555555555555'
const VERIFIER = 'sha256:test-credential'

class MemoryStore implements HostAuthorityStore {
  value: HostAuthorityState | null = null
  failSaves = false

  async load(partyId: string) {
    return this.value?.partyId === partyId ? structuredClone(this.value) : null
  }

  async save(state: HostAuthorityState) {
    if (this.failSaves) {
      throw new Error('storage unavailable')
    }
    this.value = structuredClone(state)
  }
}

function state() {
  return createInitialHostAuthorityState({
    partyId: PARTY_ID,
    incarnationId: INCARNATION_ID,
    hostAppIdentity: HOST_ID,
  })
}

describe('HostAuthoritySession', () => {
  it('persists a new party and restores the same canonical state', async () => {
    const store = new MemoryStore()
    const created = await HostAuthoritySession.create(store, state())
    const admitted = await created.authenticate({
      credentialId: CREDENTIAL_ID,
      credentialVerifier: VERIFIER,
    }, () => MEMBER_ID)
    expect(admitted.accepted).toBe(true)

    const restored = await HostAuthoritySession.restore(store, PARTY_ID)
    expect(restored.state.partyId).toBe(PARTY_ID)
    expect(restored.state.incarnationId).toBe(INCARNATION_ID)
    expect(restored.state.canonicalSequence).toBe(1)
    expect(restored.state.members).toHaveLength(1)
  })

  it('does not advance in-memory authority or emit a commit when persistence fails', async () => {
    const store = new MemoryStore()
    const session = await HostAuthoritySession.create(store, state())
    store.failSaves = true

    await expect(session.authenticate({
      credentialId: CREDENTIAL_ID,
      credentialVerifier: VERIFIER,
    }, () => MEMBER_ID)).rejects.toThrow('storage unavailable')

    expect(session.state.canonicalSequence).toBe(0)
    expect(session.state.members).toHaveLength(0)
  })

  it('fails closed when durable state is missing or corrupt', async () => {
    const missing = new MemoryStore()
    await expect(HostAuthoritySession.restore(missing, PARTY_ID)).rejects.toThrow('No durable host state')

    const corrupt = new MemoryStore()
    corrupt.value = { ...state(), canonicalSequence: -1 } as HostAuthorityState
    await expect(HostAuthoritySession.restore(corrupt, PARTY_ID)).rejects.toThrow('Durable host state is invalid')
  })

  it('rebinds the same canonical member to a new transient transport id', async () => {
    const store = new MemoryStore()
    const session = await HostAuthoritySession.create(store, state())
    const admitted = await session.authenticate({
      credentialId: CREDENTIAL_ID,
      credentialVerifier: VERIFIER,
    }, () => MEMBER_ID)
    if (!admitted.accepted) {
      throw new Error('Expected admission')
    }

    expect(session.bindTransport(MEMBER_ID, 'trystero-peer-old')).toEqual({ replacedPeerId: null })
    expect(session.bindTransport(MEMBER_ID, 'trystero-peer-new')).toEqual({ replacedPeerId: 'trystero-peer-old' })
    expect(session.memberForTransport('trystero-peer-new')).toBe(MEMBER_ID)
    expect(session.memberForTransport('trystero-peer-old')).toBeNull()
  })
})
