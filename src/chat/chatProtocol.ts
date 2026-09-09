export const MAX_CHAT_MESSAGE_LENGTH = 1_000
export const MAX_CHAT_HISTORY = 200

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
    || typeof value.sentAt !== 'string'
    || Number.isNaN(Date.parse(value.sentAt))
    || !isRecord(value.payload)
    || !isValidText(value.payload.text)
  ) {
    return false
  }

  return true
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

  return JSON.stringify(message)
}

export function parseChatMessage(serialized: string): ChatMessage | null {
  try {
    const parsed: unknown = JSON.parse(serialized)
    return isChatMessage(parsed) ? parsed : null
  } catch {
    return null
  }
}
