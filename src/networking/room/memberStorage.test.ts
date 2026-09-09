import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearMemberCredentials,
  loadMemberCredentials,
  saveMemberCredentials,
} from './memberStorage'

const ROOM_ID = 'room_1234567890123456'
const MEMBER = {
  memberId: 'member_1234567890',
  memberSecret: 'secret_123456789012345678901234',
}

describe('memberStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists valid room-scoped member credentials', () => {
    saveMemberCredentials(ROOM_ID, MEMBER)
    expect(loadMemberCredentials(ROOM_ID)).toEqual(MEMBER)
  })

  it('ignores and removes malformed stored data', () => {
    localStorage.setItem(`c00lgames.chat.member.${ROOM_ID}`, '{bad json')
    expect(loadMemberCredentials(ROOM_ID)).toBeNull()
    expect(localStorage.getItem(`c00lgames.chat.member.${ROOM_ID}`)).toBeNull()
  })

  it('does not persist invite or host credentials', () => {
    saveMemberCredentials(ROOM_ID, MEMBER)
    const stored = localStorage.getItem(`c00lgames.chat.member.${ROOM_ID}`) ?? ''
    expect(stored).toContain(MEMBER.memberId)
    expect(stored).not.toContain('invite')
    expect(stored).not.toContain('host')
  })

  it('clears a stored member explicitly', () => {
    saveMemberCredentials(ROOM_ID, MEMBER)
    clearMemberCredentials(ROOM_ID)
    expect(loadMemberCredentials(ROOM_ID)).toBeNull()
  })
})
