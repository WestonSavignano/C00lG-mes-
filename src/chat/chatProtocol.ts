export const MAX_CHAT_MESSAGE_LENGTH = 1_000
export const MAX_CHAT_HISTORY = 200
// JSON may expand one accepted character to a six-character escape sequence.
// 8 KiB keeps the full 1,000-character text contract serializable while
// preserving a strict pre-parse bound for untrusted peer messages.
export const MAX_SERIALIZED_CHAT_MESSAGE_LENGTH = 8_192

const MAX_CHAT_MESSAGE_ID_LENGTH = 128
const MAX_CHAT_SENT_AT_LENGTH = 64

export type ChatMessage = {
  version: 1
  type: 'chat.message'
  id: string
  sentAt: string
  payload: {
    text: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidText(text: unknown): text is string {
  return typeof text === 'string'
    && text.trim().length > 0
    && text.length <= MAX_CHAT_MESSAGE_LENGTH
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) {
    return false
  }

  if (
    value.version !== 1
    || value.type !== 'chat.message'
    || typeof value.id !== 'string'
    || value.id.length === 0
    || value.id.length > MAX_CHAT_MESSAGE_ID_LENGTH
    || typeof value.sentAt !== 'string'
    || value.sentAt.length === 0
    || value.sentAt.length > MAX_CHAT_SENT_AT_LENGTH
    || Number.isNaN(Date.parse(value.sentAt))
    || !isRecord(value.payload)
    || !isValidText(value.payload.text)
  ) {
    return false
  }

  return true
}

function canonicalizeChatMessage(message: ChatMessage): ChatMessage {
  return {
    version: 1,
    type: 'chat.message',
    id: message.id,
    sentAt: message.sentAt,
    payload: {
      text: message.payload.text,
    },
  }
}

export function createChatMessage(text: string): ChatMessage {
  const trimmedText = text.trim()

  if (!trimmedText) {
    throw new Error('Chat message cannot be empty')
  }

  if (trimmedText.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new Error('Chat message is too long')
  }

  return {
    version: 1,
    type: 'chat.message',
    id: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
    payload: {
      text: trimmedText,
    },
  }
}

export function serializeChatMessage(message: ChatMessage) {
  if (!isChatMessage(message)) {
    throw new Error('Invalid chat message')
  }

  const serialized = JSON.stringify(canonicalizeChatMessage(message))

  if (serialized.length > MAX_SERIALIZED_CHAT_MESSAGE_LENGTH) {
    throw new Error('Chat message is too large')
  }

  return serialized
}

export function parseChatMessage(serialized: string): ChatMessage | null {
  if (serialized.length > MAX_SERIALIZED_CHAT_MESSAGE_LENGTH) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(serialized)

    if (!isChatMessage(parsed)) {
      return null
    }

    return canonicalizeChatMessage(parsed)
  } catch {
    return null
  }
}
