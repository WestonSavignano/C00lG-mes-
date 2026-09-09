import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  MAX_ROOM_MEMBERS,
  ROOM_PROTOCOL_VERSION,
  isGeneration,
  isMemberId,
  isRoomId,
  isSecret,
  isSignalDescription,
  type ConnectionSignal,
  type CreateRoomResult,
  type GuestAuth,
  type HostAuth,
  type JoinRoomResult,
  type RoomAuth,
  type RoomMemberView,
  type RoomState,
} from '../../src/networking/room/roomProtocol'
import type {
  RoomStore,
  SignalKey,
  StoredRoom,
  StoredRoomMember,
} from './roomStore'

export const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1_000
export const SIGNAL_TTL_SECONDS = 120
export const PRESENCE_TIMEOUT_MS = 15_000

const MAX_MUTATION_ATTEMPTS = 3

type RoomServiceErrorCode =
  | 'room_not_found'
  | 'invalid_credentials'
  | 'room_locked'
  | 'room_full'
  | 'member_removed'
  | 'member_not_found'
  | 'stale_generation'
  | 'invalid_request'
  | 'conflict'

export class RoomServiceError extends Error {
  readonly code: RoomServiceErrorCode

  constructor(code: RoomServiceErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'RoomServiceError'
  }
}

export type JoinInput = {
  roomId: string
  inviteSecret?: string
  member?: {
    memberId: string
    memberSecret: string
  }
}

function newToken(bytes: number) {
  return randomBytes(bytes).toString('base64url')
}

function hashSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex')
}

function hashesEqual(left: string, right: string) {
  if (left.length !== right.length || left.length === 0 || left.length % 2 !== 0) {
    return false
  }

  const a = Buffer.from(left, 'hex')
  const b = Buffer.from(right, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function assertRoomId(roomId: string) {
  if (!isRoomId(roomId)) {
    throw new RoomServiceError('invalid_request', 'Invalid room identifier.')
  }
}

function memberView(member: StoredRoomMember, now: number): RoomMemberView {
  return {
    memberId: member.memberId,
    label: member.label,
    present: !member.removed && now - member.lastSeenAt <= PRESENCE_TIMEOUT_MS,
    removed: member.removed,
    connectionGeneration: member.removed ? null : member.connectionGeneration,
  }
}

export class RoomService {
  private readonly store: RoomStore
  private readonly clock: () => number

  constructor(store: RoomStore, clock: () => number = Date.now) {
    this.store = store
    this.clock = clock
  }

  async createRoom(): Promise<CreateRoomResult> {
    for (let attempt = 0; attempt < MAX_MUTATION_ATTEMPTS; attempt += 1) {
      const now = this.clock()
      const roomId = newToken(18)
      const hostSecret = newToken(24)
      const inviteSecret = newToken(24)
      const record: StoredRoom = {
        roomId,
        hostSecretHash: hashSecret(hostSecret),
        inviteSecretHash: hashSecret(inviteSecret),
        locked: false,
        members: {},
        revision: 1,
        createdAt: now,
        lastActivityAt: now,
        nextGuestNumber: 1,
      }

      if (await this.store.createRoom(record)) {
        return {
          version: ROOM_PROTOCOL_VERSION,
          roomId,
          hostSecret,
          inviteSecret,
        }
      }
    }

    throw new RoomServiceError('conflict', 'Could not allocate a unique room.')
  }

  async join(input: JoinInput): Promise<JoinRoomResult> {
    assertRoomId(input.roomId)

    if (input.member) {
      if (!isMemberId(input.member.memberId) || !isSecret(input.member.memberSecret)) {
        throw new RoomServiceError('invalid_credentials', 'Invalid member credentials.')
      }

      return this.mutateRoom(input.roomId, (room, now) => {
        const member = room.members[input.member!.memberId]
        if (!member || !hashesEqual(member.memberSecretHash, hashSecret(input.member!.memberSecret))) {
          throw new RoomServiceError('invalid_credentials', 'Invalid member credentials.')
        }
        if (member.removed) {
          throw new RoomServiceError('member_removed', 'This member was removed from the room.')
        }

        member.lastSeenAt = now
        room.lastActivityAt = now
        return {
          value: {
            version: ROOM_PROTOCOL_VERSION,
            roomId: room.roomId,
            memberId: member.memberId,
            memberSecret: input.member!.memberSecret,
            label: member.label,
            resumed: true,
          },
          changed: true,
        }
      })
    }

    if (!input.inviteSecret || !isSecret(input.inviteSecret)) {
      throw new RoomServiceError('invalid_credentials', 'A valid invite is required.')
    }

    return this.mutateRoom(input.roomId, (room, now) => {
      if (!hashesEqual(room.inviteSecretHash, hashSecret(input.inviteSecret!))) {
        throw new RoomServiceError('invalid_credentials', 'Invalid invite credentials.')
      }
      if (room.locked) {
        throw new RoomServiceError('room_locked', 'This room is locked.')
      }

      const activeGuestCount = Object.values(room.members).filter((member) => !member.removed).length
      if (activeGuestCount >= MAX_ROOM_MEMBERS - 1) {
        throw new RoomServiceError('room_full', 'This room is full.')
      }

      const memberId = newToken(16)
      const memberSecret = newToken(24)
      const label = `Guest ${room.nextGuestNumber}`
      room.nextGuestNumber += 1
      room.members[memberId] = {
        memberId,
        memberSecretHash: hashSecret(memberSecret),
        label,
        removed: false,
        lastSeenAt: now,
        connectionGeneration: null,
      }
      room.lastActivityAt = now

      return {
        value: {
          version: ROOM_PROTOCOL_VERSION,
          roomId: room.roomId,
          memberId,
          memberSecret,
          label,
          resumed: false,
        },
        changed: true,
      }
    })
  }

  async getState(auth: RoomAuth): Promise<RoomState> {
    this.assertAuthShape(auth)
    return this.mutateRoom(auth.roomId, (room, now) => {
      if (auth.role === 'host') {
        this.requireHost(room, auth)
      } else {
        const member = this.requireGuest(room, auth)
        member.lastSeenAt = now
      }
      room.lastActivityAt = now
      return { value: this.toState(room, now), changed: true }
    })
  }

  async setLocked(hostAuth: HostAuth, locked: boolean): Promise<RoomState> {
    this.assertAuthShape(hostAuth)
    return this.mutateRoom(hostAuth.roomId, (room, now) => {
      this.requireHost(room, hostAuth)
      room.locked = locked
      room.lastActivityAt = now
      return { value: this.toState(room, now), changed: true }
    })
  }

  async removeMember(hostAuth: HostAuth, memberId: string): Promise<RoomState> {
    this.assertAuthShape(hostAuth)
    if (!isMemberId(memberId)) {
      throw new RoomServiceError('invalid_request', 'Invalid member identifier.')
    }

    return this.mutateRoom(hostAuth.roomId, (room, now) => {
      this.requireHost(room, hostAuth)
      const member = room.members[memberId]
      if (!member) {
        throw new RoomServiceError('member_not_found', 'Member not found.')
      }

      member.removed = true
      member.connectionGeneration = null
      member.lastSeenAt = 0
      room.lastActivityAt = now
      return { value: this.toState(room, now), changed: true }
    })
  }

  async announceGeneration(guestAuth: GuestAuth, generation: string): Promise<void> {
    this.assertAuthShape(guestAuth)
    if (!isGeneration(generation)) {
      throw new RoomServiceError('invalid_request', 'Invalid connection generation.')
    }

    await this.mutateRoom(guestAuth.roomId, (room, now) => {
      const member = this.requireGuest(room, guestAuth)
      member.connectionGeneration = generation
      member.lastSeenAt = now
      room.lastActivityAt = now
      return { value: undefined, changed: true }
    })
  }

  async publishOffer(hostAuth: HostAuth, signal: ConnectionSignal): Promise<void> {
    this.assertAuthShape(hostAuth)
    const room = await this.loadActiveRoom(hostAuth.roomId)
    this.requireHost(room, hostAuth)
    this.assertCurrentSignal(room, signal, 'offer')
    await this.putSignal(signal)
  }

  async publishAnswer(guestAuth: GuestAuth, signal: ConnectionSignal): Promise<void> {
    this.assertAuthShape(guestAuth)
    const room = await this.loadActiveRoom(guestAuth.roomId)
    const member = this.requireGuest(room, guestAuth)
    if (signal.memberId !== member.memberId) {
      throw new RoomServiceError('invalid_credentials', 'Guests may only answer for themselves.')
    }
    this.assertCurrentSignal(room, signal, 'answer')
    await this.putSignal(signal)
  }

  async readSignal(
    auth: RoomAuth,
    memberId: string,
    generation: string,
    kind: 'offer' | 'answer',
  ): Promise<ConnectionSignal | null> {
    this.assertAuthShape(auth)
    if (!isMemberId(memberId) || !isGeneration(generation)) {
      throw new RoomServiceError('invalid_request', 'Invalid signal key.')
    }

    const room = await this.loadActiveRoom(auth.roomId)
    if (auth.role === 'host') {
      this.requireHost(room, auth)
      if (kind !== 'answer') {
        throw new RoomServiceError('invalid_credentials', 'Host may only read answers.')
      }
    } else {
      const member = this.requireGuest(room, auth)
      if (kind !== 'offer' || member.memberId !== memberId) {
        throw new RoomServiceError('invalid_credentials', 'Guest may only read its offer.')
      }
    }

    const current = room.members[memberId]
    if (!current || current.removed || current.connectionGeneration !== generation) {
      throw new RoomServiceError('stale_generation', 'This connection generation is stale.')
    }

    const key: SignalKey = { roomId: room.roomId, memberId, generation, kind }
    const stored = await this.store.getSignal(key)
    if (!stored) {
      return null
    }

    return {
      version: stored.version,
      roomId: stored.roomId,
      memberId: stored.memberId,
      generation: stored.generation,
      kind: stored.kind,
      description: stored.description,
    }
  }

  private async putSignal(signal: ConnectionSignal) {
    await this.store.putSignal({
      ...signal,
      expiresAt: this.clock() + SIGNAL_TTL_SECONDS * 1_000,
    }, SIGNAL_TTL_SECONDS)
  }

  private assertCurrentSignal(room: StoredRoom, signal: ConnectionSignal, kind: 'offer' | 'answer') {
    if (
      signal.version !== ROOM_PROTOCOL_VERSION
      || signal.roomId !== room.roomId
      || signal.kind !== kind
      || !isMemberId(signal.memberId)
      || !isGeneration(signal.generation)
      || !isSignalDescription(signal.description)
      || signal.description.type !== kind
    ) {
      throw new RoomServiceError('invalid_request', 'Invalid connection signal.')
    }

    const member = room.members[signal.memberId]
    if (!member || member.removed || member.connectionGeneration !== signal.generation) {
      throw new RoomServiceError('stale_generation', 'This connection generation is stale.')
    }
  }

  private assertAuthShape(auth: RoomAuth) {
    assertRoomId(auth.roomId)
    if (auth.role === 'host') {
      if (!isSecret(auth.hostSecret)) {
        throw new RoomServiceError('invalid_credentials', 'Invalid host credentials.')
      }
    } else if (!isMemberId(auth.memberId) || !isSecret(auth.memberSecret)) {
      throw new RoomServiceError('invalid_credentials', 'Invalid member credentials.')
    }
  }

  private requireHost(room: StoredRoom, auth: HostAuth) {
    if (!hashesEqual(room.hostSecretHash, hashSecret(auth.hostSecret))) {
      throw new RoomServiceError('invalid_credentials', 'Invalid host credentials.')
    }
  }

  private requireGuest(room: StoredRoom, auth: GuestAuth) {
    const member = room.members[auth.memberId]
    if (!member || !hashesEqual(member.memberSecretHash, hashSecret(auth.memberSecret))) {
      throw new RoomServiceError('invalid_credentials', 'Invalid member credentials.')
    }
    if (member.removed) {
      throw new RoomServiceError('member_removed', 'This member was removed from the room.')
    }
    return member
  }

  private async loadActiveRoom(roomId: string) {
    assertRoomId(roomId)
    const room = await this.store.getRoom(roomId)
    if (!room || this.clock() - room.lastActivityAt >= ROOM_TTL_MS) {
      throw new RoomServiceError('room_not_found', 'Room not found or expired.')
    }
    return room
  }

  private toState(room: StoredRoom, now: number): RoomState {
    return {
      version: ROOM_PROTOCOL_VERSION,
      roomId: room.roomId,
      locked: room.locked,
      members: Object.values(room.members).map((member) => memberView(member, now)),
      revision: room.revision,
    }
  }

  private async mutateRoom<T>(
    roomId: string,
    mutate: (room: StoredRoom, now: number) => { value: T; changed: boolean },
  ): Promise<T> {
    for (let attempt = 0; attempt < MAX_MUTATION_ATTEMPTS; attempt += 1) {
      const room = await this.loadActiveRoom(roomId)
      const expectedRevision = room.revision
      const now = this.clock()
      const result = mutate(room, now)
      if (!result.changed) {
        return result.value
      }

      room.revision = expectedRevision + 1
      if (await this.store.saveRoom(room, expectedRevision)) {
        return result.value
      }
    }

    throw new RoomServiceError('conflict', 'Room changed concurrently; retry the request.')
  }
}
