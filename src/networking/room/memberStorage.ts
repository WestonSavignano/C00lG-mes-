import { isMemberId, isRoomId, isSecret } from './roomProtocol'

export type StoredMemberCredentials = {
  memberId: string
  memberSecret: string
}

function storageKey(roomId: string) {
  return `c00lgames.chat.member.${roomId}`
}

export function loadMemberCredentials(roomId: string): StoredMemberCredentials | null {
  if (!isRoomId(roomId)) {
    return null
  }

  const key = storageKey(roomId)
  const raw = localStorage.getItem(key)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredMemberCredentials>
    if (!isMemberId(parsed.memberId) || !isSecret(parsed.memberSecret)) {
      localStorage.removeItem(key)
      return null
    }
    return {
      memberId: parsed.memberId,
      memberSecret: parsed.memberSecret,
    }
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function saveMemberCredentials(roomId: string, credentials: StoredMemberCredentials) {
  if (!isRoomId(roomId) || !isMemberId(credentials.memberId) || !isSecret(credentials.memberSecret)) {
    return
  }
  localStorage.setItem(storageKey(roomId), JSON.stringify(credentials))
}

export function clearMemberCredentials(roomId: string) {
  if (isRoomId(roomId)) {
    localStorage.removeItem(storageKey(roomId))
  }
}
