import { describe, expect, it, vi } from 'vitest'
import {
  createGuestPartyHandshake,
  createHostPartyHandshake,
} from './partyHandshake'
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
import { generateCredentialId, generateCapability } from './partyCrypto'
import { parsePartyMessage } from './partyProtocol'

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

function duplex() {
  const queues: [string[], string[]] = [[], []]
  const waiters: [Array<(value: { data: string }) => void>, Array<(value: { data: string }) => void>] = [[], []]
  const traces: Array<{ side: 'host' | 'guest'; data: string }> = []

  function endpoint(index: 0 | 1, side: 'host' | 'guest') {
    const other = index === 0 ? 1 : 0
    return {
      send: async (data: string) => {
        traces.push({ side, data })
        const waiter = waiters[other].shift()
        if (waiter) waiter({ data })
        else queues[other].push(data)
      },
      receive: async () => {
        const queued = queues[index].shift()
        if (queued !== undefined) return { data: queued }
        return new Promise<{ data: string }>((resolve) => waiters[index].push(resolve))
      },
    }
  }

  return { host: endpoint(0, 'host'), guest: endpoint(1, 'guest'), traces }
}

async function setup() {
  const hostStore = new MemoryHostStore()
  const hostRecord = await createInitialHostPartyRecord({ partyId: 'party-a' })
  const authority = await HostPartyAuthority.create(hostStore, hostRecord)
  const credentialId = generateCredentialId()
  const credentialSecret = generateCapability()
  const guestStore = new MemoryGuestStore()
  const guestRecord = createInitialGuestPartyRecord({
    partyId: hostRecord.partyId,
    rendezvousCapability: hostRecord.rendezvousCapability,
    hostFingerprint: hostRecord.hostFingerprint,
    credentialId,
    credentialSecret,
  })
  return { authority, hostRecord, guestStore, guestRecord, credentialId, credentialSecret }
}

describe('party handshake', () => {
  it('proves the pinned host before sending a new-member admission capability or credential', async () => {
    const { authority, hostRecord, guestStore, guestRecord } = await setup()
    const replica = new GuestPartyReplica(guestRecord)
    const link = duplex()
    const hostAuthenticated = vi.fn()
    const guestAuthenticated = vi.fn()

    const hostHandshake = createHostPartyHandshake({ authority, onAuthenticated: hostAuthenticated })
    const guestHandshake = createGuestPartyHandshake({
      replica,
      store: guestStore,
      admissionCapability: hostRecord.admissionCapability ?? undefined,
      onAuthenticated: guestAuthenticated,
    })

    await Promise.all([
      hostHandshake('guest-peer', link.host.send, link.host.receive, true),
      guestHandshake('host-peer', link.guest.send, link.guest.receive, false),
    ])

    const guestMessages = link.traces
      .filter((entry) => entry.side === 'guest')
      .map((entry) => parsePartyMessage(entry.data))
    expect(guestMessages.map((message) => message?.type)).toEqual(['hello', 'authenticate-new'])
    expect(link.traces.findIndex((entry) => parsePartyMessage(entry.data)?.type === 'host-proof'))
      .toBeLessThan(link.traces.findIndex((entry) => parsePartyMessage(entry.data)?.type === 'authenticate-new'))

    expect(hostAuthenticated).toHaveBeenCalledWith(expect.objectContaining({
      peerId: 'guest-peer',
      transportAttemptId: expect.stringMatching(/^attempt_/),
      member: expect.objectContaining({ label: 'Guest 1' }),
      isNewMember: true,
    }))
    expect(guestAuthenticated).toHaveBeenCalledWith(expect.objectContaining({ hostPeerId: 'host-peer' }))
    expect(guestStore.value).toMatchObject({
      partyId: 'party-a',
      incarnationId: hostRecord.incarnationId,
      memberId: expect.stringMatching(/^member_/),
      label: 'Guest 1',
      nextRequestSequence: 1,
    })
  })

  it('rejects an unexpected host key before any admission or member secret is sent', async () => {
    const { authority, hostRecord, guestStore, guestRecord } = await setup()
    const replica = new GuestPartyReplica({ ...guestRecord, hostFingerprint: 'sha256:not-the-host' })
    const link = duplex()
    const hostHandshake = createHostPartyHandshake({ authority })
    const guestHandshake = createGuestPartyHandshake({
      replica,
      store: guestStore,
      admissionCapability: hostRecord.admissionCapability ?? undefined,
    })

    const guestResult = guestHandshake('host-peer', link.guest.send, link.guest.receive, false)
    const hostResult = hostHandshake('guest-peer', link.host.send, link.host.receive, true)

    await expect(guestResult).rejects.toThrow('host identity')
    const guestTypes = link.traces
      .filter((entry) => entry.side === 'guest')
      .map((entry) => parsePartyMessage(entry.data)?.type)
    expect(guestTypes).toEqual(['hello'])
    void hostResult.catch(() => undefined)
  })

  it('resumes an existing member while admission is locked and preserves canonical identity', async () => {
    const { authority, hostRecord, guestStore, guestRecord, credentialId, credentialSecret } = await setup()
    const admitted = await authority.authenticateNew({
      admissionCapability: hostRecord.admissionCapability ?? '',
      credentialId,
      credentialSecret,
    })
    if (!admitted.accepted) throw new Error('expected admission')
    await authority.setAdmissionLocked(true)

    const replica = new GuestPartyReplica({
      ...guestRecord,
      incarnationId: hostRecord.incarnationId,
      memberId: admitted.member.memberId,
      label: admitted.member.label,
    })
    const link = duplex()
    const hostAuthenticated = vi.fn()
    const hostHandshake = createHostPartyHandshake({ authority, onAuthenticated: hostAuthenticated })
    const guestHandshake = createGuestPartyHandshake({ replica, store: guestStore })

    await Promise.all([
      hostHandshake('guest-peer-new', link.host.send, link.host.receive, true),
      guestHandshake('host-peer', link.guest.send, link.guest.receive, false),
    ])

    expect(link.traces.filter((entry) => entry.side === 'guest').map((entry) => parsePartyMessage(entry.data)?.type))
      .toEqual(['hello', 'authenticate-resume'])
    expect(hostAuthenticated).toHaveBeenCalledWith(expect.objectContaining({
      member: expect.objectContaining({ memberId: admitted.member.memberId }),
      isNewMember: false,
    }))
    expect(guestStore.value?.memberId).toBe(admitted.member.memberId)
  })

  it('supersedes the prior transient transport without changing the member identity', async () => {
    const { authority, hostRecord, credentialId, credentialSecret } = await setup()
    const admitted = await authority.authenticateNew({
      admissionCapability: hostRecord.admissionCapability ?? '',
      credentialId,
      credentialSecret,
    })
    if (!admitted.accepted) throw new Error('expected admission')
    authority.bindTransport(admitted.member.memberId, 'peer-old', 'attempt-old')

    const onAuthenticated = vi.fn()
    const handler = createHostPartyHandshake({ authority, onAuthenticated })
    const sends: string[] = []
    let receiveIndex = 0
    const helloAttempt = 'attempt-new'
    const incoming = [
      JSON.stringify({
        version: 2,
        type: 'hello',
        partyId: 'party-a',
        role: 'guest',
        transportAttemptId: helloAttempt,
        guestNonce: 'guest-nonce',
      }),
      JSON.stringify({
        version: 2,
        type: 'authenticate-resume',
        partyId: 'party-a',
        transportAttemptId: helloAttempt,
        credentialId,
        credentialSecret,
      }),
    ]

    await handler(
      'peer-new',
      async (data) => { sends.push(data) },
      async () => ({ data: incoming[receiveIndex++] }),
      true,
    )

    expect(onAuthenticated).toHaveBeenCalledWith(expect.objectContaining({
      peerId: 'peer-new',
      member: expect.objectContaining({ memberId: admitted.member.memberId }),
      replaced: { peerId: 'peer-old', transportAttemptId: 'attempt-old' },
    }))
    expect(parsePartyMessage(sends.at(-1) ?? '')).toMatchObject({
      type: 'authenticated',
      memberId: admitted.member.memberId,
      nextRequestSequence: 1,
    })
  })
})
