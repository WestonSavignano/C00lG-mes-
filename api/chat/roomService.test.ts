import { beforeEach, describe, expect, it } from 'vitest'
import { ROOM_PROTOCOL_VERSION, type GuestAuth, type HostAuth } from '../../src/networking/room/roomProtocol'
import { InMemoryRoomStore } from './inMemoryRoomStore'
import {
  ROOM_TTL_MS,
  SIGNAL_TTL_SECONDS,
  RoomService,
  RoomServiceError,
} from './roomService'

async function expectRejectCode(promise: Promise<unknown>, code: string) {
  try {
    await promise
    throw new Error(`Expected ${code} rejection`)
  } catch (error) {
    expect(error).toBeInstanceOf(RoomServiceError)
    expect((error as RoomServiceError).code).toBe(code)
  }
}

describe('RoomService', () => {
  let now: number
  let store: InMemoryRoomStore
  let service: RoomService

  beforeEach(() => {
    now = Date.UTC(2026, 8, 8, 20, 0, 0)
    store = new InMemoryRoomStore(() => now)
    service = new RoomService(store, () => now)
  })

  it('creates a room without storing raw credentials', async () => {
    const created = await service.createRoom()
    const stored = await store.getRoom(created.roomId)

    expect(created.version).toBe(ROOM_PROTOCOL_VERSION)
    expect(stored).not.toBeNull()
    expect(stored?.hostSecretHash).not.toBe(created.hostSecret)
    expect(stored?.inviteSecretHash).not.toBe(created.inviteSecret)
    expect(JSON.stringify(stored)).not.toContain(created.hostSecret)
    expect(JSON.stringify(stored)).not.toContain(created.inviteSecret)
  })

  it('allows an existing member to resume while the room is locked', async () => {
    const created = await service.createRoom()
    const first = await service.join({ roomId: created.roomId, inviteSecret: created.inviteSecret })
    const host: HostAuth = { role: 'host', roomId: created.roomId, hostSecret: created.hostSecret }
    await service.setLocked(host, true)

    const resumed = await service.join({
      roomId: created.roomId,
      member: { memberId: first.memberId, memberSecret: first.memberSecret },
    })

    expect(resumed.resumed).toBe(true)
    expect(resumed.memberId).toBe(first.memberId)
    await expectRejectCode(
      service.join({ roomId: created.roomId, inviteSecret: created.inviteSecret }),
      'room_locked',
    )
  })

  it('does not convert removed credentials into a new invite join', async () => {
    const created = await service.createRoom()
    const joined = await service.join({ roomId: created.roomId, inviteSecret: created.inviteSecret })
    const host: HostAuth = { role: 'host', roomId: created.roomId, hostSecret: created.hostSecret }
    await service.removeMember(host, joined.memberId)

    await expectRejectCode(service.join({
      roomId: created.roomId,
      inviteSecret: created.inviteSecret,
      member: { memberId: joined.memberId, memberSecret: joined.memberSecret },
    }), 'member_removed')
  })

  it('enforces the eight-total-member cap including the host', async () => {
    const created = await service.createRoom()
    for (let index = 0; index < 7; index += 1) {
      await service.join({ roomId: created.roomId, inviteSecret: created.inviteSecret })
    }

    await expectRejectCode(
      service.join({ roomId: created.roomId, inviteSecret: created.inviteSecret }),
      'room_full',
    )
  })

  it('rejects invalid host and member credentials', async () => {
    const created = await service.createRoom()
    const joined = await service.join({ roomId: created.roomId, inviteSecret: created.inviteSecret })

    await expectRejectCode(service.getState({
      role: 'host',
      roomId: created.roomId,
      hostSecret: `${created.hostSecret}x`,
    }), 'invalid_credentials')

    await expectRejectCode(service.getState({
      role: 'guest',
      roomId: created.roomId,
      memberId: joined.memberId,
      memberSecret: `${joined.memberSecret}x`,
    }), 'invalid_credentials')
  })

  it('expires inactive rooms after seven days', async () => {
    const created = await service.createRoom()
    now += ROOM_TTL_MS

    await expectRejectCode(service.getState({
      role: 'host',
      roomId: created.roomId,
      hostSecret: created.hostSecret,
    }), 'room_not_found')
  })

  it('stores only current-generation offers and answers with a short TTL', async () => {
    const created = await service.createRoom()
    const joined = await service.join({ roomId: created.roomId, inviteSecret: created.inviteSecret })
    const host: HostAuth = { role: 'host', roomId: created.roomId, hostSecret: created.hostSecret }
    const guest: GuestAuth = {
      role: 'guest',
      roomId: created.roomId,
      memberId: joined.memberId,
      memberSecret: joined.memberSecret,
    }

    const generation = 'generation_123456789'
    await service.announceGeneration(guest, generation)
    const offer = {
      version: ROOM_PROTOCOL_VERSION,
      roomId: created.roomId,
      memberId: joined.memberId,
      generation,
      kind: 'offer' as const,
      description: { type: 'offer' as const, sdp: 'v=0\r\n' },
    }
    await service.publishOffer(host, offer)
    expect(await service.readSignal(guest, joined.memberId, generation, 'offer')).toEqual(offer)

    const answer = {
      ...offer,
      kind: 'answer' as const,
      description: { type: 'answer' as const, sdp: 'v=0\r\n' },
    }
    await service.publishAnswer(guest, answer)
    expect(await service.readSignal(host, joined.memberId, generation, 'answer')).toEqual(answer)

    now += SIGNAL_TTL_SECONDS * 1_000 + 1
    expect(await service.readSignal(host, joined.memberId, generation, 'answer')).toBeNull()
  })

  it('rejects signaling from a stale connection generation', async () => {
    const created = await service.createRoom()
    const joined = await service.join({ roomId: created.roomId, inviteSecret: created.inviteSecret })
    const host: HostAuth = { role: 'host', roomId: created.roomId, hostSecret: created.hostSecret }
    const guest: GuestAuth = {
      role: 'guest',
      roomId: created.roomId,
      memberId: joined.memberId,
      memberSecret: joined.memberSecret,
    }

    await service.announceGeneration(guest, 'generation_111111111')
    await service.announceGeneration(guest, 'generation_222222222')

    await expectRejectCode(service.publishOffer(host, {
      version: ROOM_PROTOCOL_VERSION,
      roomId: created.roomId,
      memberId: joined.memberId,
      generation: 'generation_111111111',
      kind: 'offer',
      description: { type: 'offer', sdp: 'v=0\r\n' },
    }), 'stale_generation')
  })
})
