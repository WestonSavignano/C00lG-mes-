export const ROOM_PROTOCOL_VERSION = 1 as const
export const MAX_ROOM_MEMBERS = 8
export const MAX_SIGNAL_SDP_LENGTH = 32_768

export const MAX_ROOM_ID_LENGTH = 128
export const MAX_SECRET_LENGTH = 256
export const MAX_GENERATION_LENGTH = 128
export const MAX_MEMBER_ID_LENGTH = 128

const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/u

export type RoomRole = 'host' | 'guest'

export type RoomMemberView = {
  memberId: string
  label: string
  present: boolean
  removed: boolean
  connectionGeneration: string | null
}

export type RoomState = {
  version: typeof ROOM_PROTOCOL_VERSION
  roomId: string
  locked: boolean
  members: RoomMemberView[]
  revision: number
}

export type CreateRoomResult = {
  version: typeof ROOM_PROTOCOL_VERSION
  roomId: string
  hostSecret: string
  inviteSecret: string
}

export type JoinRoomResult = {
  version: typeof ROOM_PROTOCOL_VERSION
  roomId: string
  memberId: string
  memberSecret: string
  label: string
  resumed: boolean
}

export type HostAuth = {
  role: 'host'
  roomId: string
  hostSecret: string
}

export type GuestAuth = {
  role: 'guest'
  roomId: string
  memberId: string
  memberSecret: string
}

export type RoomAuth = HostAuth | GuestAuth

export type ConnectionSignal = {
  version: typeof ROOM_PROTOCOL_VERSION
  roomId: string
  memberId: string
  generation: string
  kind: 'offer' | 'answer'
  description: RTCSessionDescriptionInit
}

function isBoundedToken(value: unknown, minLength: number, maxLength: number) {
  return typeof value === 'string'
    && value.length >= minLength
    && value.length <= maxLength
    && TOKEN_PATTERN.test(value)
}

export function isRoomId(value: unknown): value is string {
  return isBoundedToken(value, 16, MAX_ROOM_ID_LENGTH)
}

export function isSecret(value: unknown): value is string {
  return isBoundedToken(value, 24, MAX_SECRET_LENGTH)
}

export function isMemberId(value: unknown): value is string {
  return isBoundedToken(value, 12, MAX_MEMBER_ID_LENGTH)
}

export function isGeneration(value: unknown): value is string {
  return isBoundedToken(value, 12, MAX_GENERATION_LENGTH)
}

export function isSignalDescription(value: unknown): value is RTCSessionDescriptionInit {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { type?: unknown; sdp?: unknown }
  return (candidate.type === 'offer' || candidate.type === 'answer')
    && typeof candidate.sdp === 'string'
    && candidate.sdp.length > 0
    && candidate.sdp.length <= MAX_SIGNAL_SDP_LENGTH
}
