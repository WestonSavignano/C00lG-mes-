import { describe, expect, it } from 'vitest'
import {
  MAX_CHAT_HISTORY,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_SERIALIZED_CHAT_MESSAGE_LENGTH,
  createChatMessage,
  parseChatMessage,
  serializeChatMessage,
  type ChatMessage,
} from './chatProtocol'

function validMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    version: 1,
    type: 'chat.message',
    id: 'message-1',
    sentAt: '2026-09-08T18:00:00.000Z',
    payload: {
      text: 'Hello from Browser A',
    },
    ...overrides,
  }
}

describe('chatProtocol', () => {
  it('creates a versioned chat message and trims surrounding whitespace', () => {
    const message = createChatMessage('  hello peer  ')

    expect(message.version).toBe(1)
    expect(message.type).toBe('chat.message')
    expect(message.id).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(message.sentAt))).toBe(false)
    expect(message.payload.text).toBe('hello peer')
  })

  it('serializes and parses a valid chat message', () => {
    const message = validMessage()

    expect(parseChatMessage(serializeChatMessage(message))).toEqual(message)
  })

  it('rejects malformed JSON and unsupported protocol versions', () => {
    expect(parseChatMessage('{not json')).toBeNull()
    expect(parseChatMessage(JSON.stringify({
      ...validMessage(),
      version: 2,
    }))).toBeNull()
  })

  it('rejects unknown message types and malformed fields', () => {
    expect(parseChatMessage(JSON.stringify({
      ...validMessage(),
      type: 'game.input',
    }))).toBeNull()

    expect(parseChatMessage(JSON.stringify({
      ...validMessage(),
      id: '',
    }))).toBeNull()

    expect(parseChatMessage(JSON.stringify({
      ...validMessage(),
      sentAt: 'not-a-date',
    }))).toBeNull()
  })

  it('rejects blank outgoing messages', () => {
    expect(() => createChatMessage('   ')).toThrow('Chat message cannot be empty')
  })

  it('enforces the outgoing message length limit', () => {
    expect(() => createChatMessage('x'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1)))
      .toThrow('Chat message is too long')
  })

  it('rejects incoming messages that exceed the message length limit', () => {
    const oversized = validMessage({
      payload: {
        text: 'x'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1),
      },
    })

    expect(parseChatMessage(JSON.stringify(oversized))).toBeNull()
  })

  it('rejects an oversized serialized envelope before parsing it', () => {
    const oversizedEnvelope = JSON.stringify({
      ...validMessage(),
      ignored: 'x'.repeat(MAX_SERIALIZED_CHAT_MESSAGE_LENGTH),
    })

    expect(oversizedEnvelope.length).toBeGreaterThan(MAX_SERIALIZED_CHAT_MESSAGE_LENGTH)
    expect(parseChatMessage(oversizedEnvelope)).toBeNull()
  })

  it('returns only canonical validated fields from incoming messages', () => {
    const message = validMessage()
    const serialized = JSON.stringify({
      ...message,
      ignored: 'top-level-extra',
      payload: {
        ...message.payload,
        ignored: 'payload-extra',
      },
    })

    const parsed = parseChatMessage(serialized)

    expect(parsed).toEqual(message)
    expect(parsed).not.toHaveProperty('ignored')
    expect(parsed?.payload).not.toHaveProperty('ignored')
  })

  it('exports finite positive bounds', () => {
    expect(MAX_CHAT_HISTORY).toBeGreaterThan(0)
    expect(Number.isSafeInteger(MAX_CHAT_HISTORY)).toBe(true)
    expect(MAX_SERIALIZED_CHAT_MESSAGE_LENGTH).toBeGreaterThan(MAX_CHAT_MESSAGE_LENGTH)
    expect(Number.isSafeInteger(MAX_SERIALIZED_CHAT_MESSAGE_LENGTH)).toBe(true)
  })
})
