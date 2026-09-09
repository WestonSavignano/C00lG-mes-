import type { ConnectionSignal } from '../../src/networking/room/roomProtocol'

export type StoredRoomMember = {
  memberId: string
  memberSecretHash: string
  label: string
  removed: boolean
  lastSeenAt: number
  connectionGeneration: string | null
}

export type StoredRoom = {
  roomId: string
  hostSecretHash: string
  inviteSecretHash: string
  locked: boolean
  members: Record<string, StoredRoomMember>
  revision: number
  createdAt: number
  lastActivityAt: number
  nextGuestNumber: number
}

export type SignalKey = {
  roomId: string
  memberId: string
  generation: string
  kind: 'offer' | 'answer'
}

export type StoredSignal = ConnectionSignal & {
  expiresAt: number
}

export interface RoomStore {
  createRoom(record: StoredRoom): Promise<boolean>
  getRoom(roomId: string): Promise<StoredRoom | null>
  saveRoom(room: StoredRoom, expectedRevision: number): Promise<boolean>
  putSignal(signal: StoredSignal, ttlSeconds: number): Promise<void>
  getSignal(key: SignalKey): Promise<StoredSignal | null>
  deleteSignal(key: SignalKey): Promise<void>
}
