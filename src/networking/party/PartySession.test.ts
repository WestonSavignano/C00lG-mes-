import { describe, expect, it, vi } from 'vitest'
import { ChatRateLimiter } from '../../chat/chatRateLimiter'
import { HostPartyAuthority } from './hostPartyAuthority'
import {
  createInitialHostPartyRecord,
  type HostPartyRecord,
  type HostPartyStore,
} from './hostPartyStore'
import {
  createInitialGuestPartyRecord,
  type GuestPartyRecord,
  type GuestPartyStore,
} from './guestPartyStore'
import { GuestPartyReplica } from './guestPartyReplica'
import {
  GuestPartySession,
  HostPartySession,
  type PartyTransportClient,
} from './PartySession'
import { parsePartyMessage, serializePartyMessage } from './partyProtocol'
import type { HostPartyLockLease } from './hostPartyLock'

class MemoryHostStore implements HostPartyStore {
  value: HostPartyRecord | null = null
  async load(partyId: string) { return this.value?.partyId === partyId ? this.value : null }
  async save(record: HostPartyRecord) { this.value = record }
}

class MemoryGuestStore implements GuestPartyStore {
  value: GuestPartyRecord | null = null
  async load(partyId: string) { return this.value?.partyId === partyId ? this.value : null }
  async save(record: GuestPartyRecord) { this.value = record }
  async delete() { this.value = null }
}

class FakeTransport implements PartyTransportClient {
  sends: Array<{ data: string; target?: string | string[] | null }> = []
  disconnected: string[] = []
  peers: string[] = []
  async start() {}
  async send(data: string, target?: string | string[] | null) { this.sends.push({ data, target }) }
  peerIds() { return this.peers }
  disconnectPeer(peerId: string) { this.disconnected.push(peerId) }
  async dispose() { return { requiresReload: false } }
}

function fakeLease(): HostPartyLockLease {
  return { name: 'lock', release: vi.fn(), released: Promise.resolve() }
}

async function hostSetup() {
  const store = new MemoryHostStore()
  const record = await createInitialHostPartyRecord({ partyId: 'party-a' })
  const authority = await HostPartyAuthority.create(store, record, {
    rateLimiter: new ChatRateLimiter({ capacity: 100, refillPerSecond: 100 }),
  })
  const transport = new FakeTransport()
  const session = new HostPartySession({
    authority,
    transport,
    lock: fakeLease(),
    origin: 'https://coolgamesplus.com',
  })
  return { store, record, authority, transport, session }
}

describe('HostPartySession', () => {
  it('publishes only persisted canonical host Chat events and exposes a guest-only invite', async () => {
    const { authority, transport, session } = await hostSetup()
    transport.peers = ['peer-a']
    session.handlePeerJoin('peer-a')

    const beforeSequence = authority.state.canonicalSequence
    await session.sendMessage('hello')

    expect(authority.state.canonicalSequence).toBe(beforeSequence + 1)
    expect(session.getSnapshot().messages.at(-1)).toMatchObject({
      sender: { memberId: 'host', label: 'Host' },
      text: 'hello',
    })
    expect(session.getSnapshot().inviteUrl).toContain('/chat#v=2&party=party-a')
    expect(session.getSnapshot().inviteUrl).not.toContain('credential')
    expect(transport.sends.map((send) => parsePartyMessage(send.data)?.type)).toContain('sync-delta')
  })

  it('persists lock before removing the invite and unlocks with a newly minted admission capability', async () => {
    const { authority, record, session } = await hostSetup()
    const originalAdmission = record.admissionCapability

    await session.setLocked(true)
    expect(authority.state.locked).toBe(true)
    expect(session.getSnapshot().inviteUrl).toBeNull()

    await session.setLocked(false)
    expect(authority.state.admissionCapability).not.toBe(originalAdmission)
    expect(session.getSnapshot().inviteUrl).toContain(authority.state.admissionCapability ?? 'missing')
  })

  it('persists removal, notifies/disconnects the removed transport, and broadcasts the tombstone to remaining guests', async () => {
    const { authority, record, transport, session } = await hostSetup()
    const first = await authority.authenticateNew({
      admissionCapability: record.admissionCapability ?? '',
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    })
    const second = await authority.authenticateNew({
      admissionCapability: record.admissionCapability ?? '',
      credentialId: 'credential-b',
      credentialSecret: 'secret-b',
    })
    if (!first.accepted || !second.accepted) throw new Error('expected admission')

    const firstBinding = authority.bindTransport(first.member.memberId, 'peer-a', 'attempt-a')
    session.handleAuthenticated({
      peerId: 'peer-a',
      transportAttemptId: 'attempt-a',
      member: first.member,
      isNewMember: true,
      event: first.event,
      replaced: firstBinding.replaced,
    })
    const secondBinding = authority.bindTransport(second.member.memberId, 'peer-b', 'attempt-b')
    session.handleAuthenticated({
      peerId: 'peer-b',
      transportAttemptId: 'attempt-b',
      member: second.member,
      isNewMember: true,
      event: second.event,
      replaced: secondBinding.replaced,
    })
    transport.peers = ['peer-a', 'peer-b']

    await session.removeMember(first.member.memberId)

    expect(authority.state.members.find((member) => member.memberId === first.member.memberId)?.removed).toBe(true)
    expect(transport.disconnected).toEqual(['peer-a'])
    expect(transport.sends.some((send) => send.target === 'peer-a' && parsePartyMessage(send.data)?.type === 'removed')).toBe(true)
    expect(transport.sends.some((send) => send.target === 'peer-b' && parsePartyMessage(send.data)?.type === 'sync-delta')).toBe(true)
  })
})

describe('GuestPartySession', () => {
  function setup() {
    const store = new MemoryGuestStore()
    const replica = new GuestPartyReplica({
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
      canonicalSequence: 2,
    })
    const transport = new FakeTransport()
    const session = new GuestPartySession({ replica, store, transport })
    session.handleAuthenticated({
      hostPeerId: 'host-peer',
      transportAttemptId: 'attempt-a',
      memberId: 'member-a',
      label: 'Guest 1',
      hostCanonicalSequence: 4,
      nextRequestSequence: 3,
    })
    return { store, replica, transport, session }
  }

  it('requests host recovery from its durable canonical cursor after the authenticated host becomes active', async () => {
    const { transport, session } = setup()

    await session.handlePeerJoin('host-peer')

    expect(parsePartyMessage(transport.sends.at(-1)?.data ?? '')).toEqual({
      version: 2,
      type: 'sync-request',
      partyId: 'party-a',
      transportAttemptId: 'attempt-a',
      afterCanonicalSequence: 2,
    })
    expect(session.getSnapshot().status).toBe('connected')
  })

  it('accepts application traffic only from the cryptographically authenticated host peer', async () => {
    const { store, replica, session } = setup()
    const delta = serializePartyMessage({
      version: 2,
      type: 'sync-delta',
      partyId: 'party-a',
      incarnationId: 'inc-a',
      fromCanonicalSequence: 3,
      toCanonicalSequence: 3,
      events: [{ kind: 'admission-locked', canonicalSequence: 3 }],
    })

    await session.handleMessage(delta, 'rogue-peer')
    expect(replica.state.canonicalSequence).toBe(2)

    await session.handleMessage(delta, 'host-peer')
    expect(replica.state).toMatchObject({ canonicalSequence: 3, locked: true })
    expect(store.value?.canonicalSequence).toBe(3)
  })

  it('requests recovery instead of applying a gapped delta', async () => {
    const { transport, replica, session } = setup()
    transport.sends = []
    await session.handleMessage(serializePartyMessage({
      version: 2,
      type: 'sync-delta',
      partyId: 'party-a',
      incarnationId: 'inc-a',
      fromCanonicalSequence: 5,
      toCanonicalSequence: 5,
      events: [{ kind: 'admission-locked', canonicalSequence: 5 }],
    }), 'host-peer')

    expect(replica.state.canonicalSequence).toBe(2)
    expect(parsePartyMessage(transport.sends.at(-1)?.data ?? '')).toMatchObject({
      type: 'sync-request',
      afterCanonicalSequence: 2,
    })
  })

  it('marks a superseded or removed guest clearly without treating it as canonical authority', async () => {
    const { session } = setup()

    await session.handleMessage(serializePartyMessage({
      version: 2,
      type: 'superseded',
      partyId: 'party-a',
      memberId: 'member-a',
    }), 'host-peer')
    expect(session.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringContaining('replaced') })

    const { session: removedSession } = setup()
    await removedSession.handleMessage(serializePartyMessage({
      version: 2,
      type: 'removed',
      partyId: 'party-a',
      memberId: 'member-a',
    }), 'host-peer')
    expect(removedSession.getSnapshot().status).toBe('removed')
  })
})
