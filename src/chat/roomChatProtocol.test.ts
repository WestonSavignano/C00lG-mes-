import { describe, expect, it } from 'vitest'
import {
  createCanonicalRoomChatMessage,
  createRoomChatSubmit,
  parseCanonicalRoomChatMessage,
  parseRoomChatSubmit,
  serializeCanonicalRoomChatMessage,
  serializeRoomChatSubmit,
} from './roomChatProtocol'

describe('roomChatProtocol', () => {
  it('canonicalizes guest submissions without preserving spoofed fields', () => {
    const parsed = parseRoomChatSubmit(JSON.stringify({
      version: 1,
      type: 'chat.submit',
      id: 'message-1',
      sentAt: '2026-09-09T04:00:00.000Z',
      sender: { memberId: 'spoofed', label: 'Spoofed' },
      payload: { text: 'hello' },
      extra: 'ignored',
    }))

    expect(parsed).toEqual({
      version: 1,
      type: 'chat.submit',
      id: 'message-1',
      sentAt: '2026-09-09T04:00:00.000Z',
      payload: { text: 'hello' },
    })
  })

  it('round trips bounded canonical room messages', () => {
    const submit = createRoomChatSubmit('hello room')
    const canonical = createCanonicalRoomChatMessage(submit, {
      memberId: 'member_1234567890',
      label: 'Guest 1',
    })

    expect(parseRoomChatSubmit(serializeRoomChatSubmit(submit))).toEqual(submit)
    expect(parseCanonicalRoomChatMessage(
      serializeCanonicalRoomChatMessage(canonical),
    )).toEqual(canonical)
  })
})
