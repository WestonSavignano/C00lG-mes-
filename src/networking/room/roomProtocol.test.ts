import { describe, expect, it } from 'vitest'
import {
  MAX_GENERATION_LENGTH,
  MAX_ROOM_MEMBERS,
  MAX_SIGNAL_SDP_LENGTH,
  ROOM_PROTOCOL_VERSION,
  isGeneration,
  isMemberId,
  isRoomId,
  isSecret,
  isSignalDescription,
} from './roomProtocol'

describe('roomProtocol', () => {
  it('uses the expected version and small-group member cap', () => {
    expect(ROOM_PROTOCOL_VERSION).toBe(1)
    expect(MAX_ROOM_MEMBERS).toBe(8)
  })

  it('accepts generated token shapes and rejects malformed identifiers', () => {
    expect(isRoomId('room_1234567890123456')).toBe(true)
    expect(isSecret('secret_123456789012345678901234')).toBe(true)
    expect(isMemberId('member_1234567890')).toBe(true)
    expect(isGeneration('generation_123456')).toBe(true)

    expect(isRoomId('short')).toBe(false)
    expect(isRoomId('room id with spaces')).toBe(false)
    expect(isSecret('too-short')).toBe(false)
    expect(isGeneration('x'.repeat(MAX_GENERATION_LENGTH + 1))).toBe(false)
  })

  it('bounds signal descriptions and allows only offer/answer SDP', () => {
    expect(isSignalDescription({ type: 'offer', sdp: 'v=0\r\n' })).toBe(true)
    expect(isSignalDescription({ type: 'answer', sdp: 'v=0\r\n' })).toBe(true)
    expect(isSignalDescription({ type: 'pranswer', sdp: 'v=0\r\n' })).toBe(false)
    expect(isSignalDescription({ type: 'offer', sdp: '' })).toBe(false)
    expect(isSignalDescription({
      type: 'offer',
      sdp: 'x'.repeat(MAX_SIGNAL_SDP_LENGTH + 1),
    })).toBe(false)
  })
})
