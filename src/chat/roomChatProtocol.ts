import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_SERIALIZED_CHAT_MESSAGE_LENGTH,
} from './chatProtocol'

const MAX_ID_LENGTH = 128
const MAX_SENT_AT_LENGTH = 64
const MAX_SENDER_LABEL_LENGTH = 64

export type RoomChatClientMessage = {
  version: 1
  type: 'chat.submit'
  id: string
  sentAt: string
  payload: { text: string }
}

export type RoomChatCanonicalMessage = {
  version: 1
  type: 'chat.message'
  id: string
  sentAt: string
  sender: { memberId: string; label: string }
  payload: { text: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isText(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= MAX_CHAT_MESSAGE_LENGTH
}

function isId(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

function isSentAt(value: unknown) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_SENT_AT_LENGTH
    && !Number.isNaN(Date.parse(value))
}

export function createRoomChatSubmit(text: string): RoomChatClientMessage {
  const trimmed = text.trim()
  if (!isText(trimmed)) {
    throw new Error(trimmed ? 'Chat message is too long' : 'Chat message cannot be empty')
  }
  return {
    version: 1,
    type: 'chat.submit',
    id: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
    payload: { text: trimmed },
  }
}

export function serializeRoomChatSubmit(message: RoomChatClientMessage) {
  const canonical = parseSubmitValue(message)
  if (!canonical) {
    throw new Error('Invalid room chat submission')
  }
  return serializeBounded(canonical)
}

export function parseRoomChatSubmit(serialized: string): RoomChatClientMessage | null {
  if (serialized.length > MAX_SERIALIZED_CHAT_MESSAGE_LENGTH) {
    return null
  }
  try {
    return parseSubmitValue(JSON.parse(serialized))
  } catch {
    return null
  }
}

export function createCanonicalRoomChatMessage(
  submission: RoomChatClientMessage,
  sender: { memberId: string; label: string },
  text = submission.payload.text,
): RoomChatCanonicalMessage {
  if (!isId(sender.memberId) || typeof sender.label !== 'string' || sender.label.length === 0 || sender.label.length > MAX_SENDER_LABEL_LENGTH || !isText(text)) {
    throw new Error('Invalid room chat sender or text')
  }
  return {
    version: 1,
    type: 'chat.message',
    id: submission.id,
    sentAt: submission.sentAt,
    sender: { memberId: sender.memberId, label: sender.label },
    payload: { text },
  }
}

export function serializeCanonicalRoomChatMessage(message: RoomChatCanonicalMessage) {
  const canonical = parseCanonicalValue(message)
  if (!canonical) {
    throw new Error('Invalid canonical room chat message')
  }
  return serializeBounded(canonical)
}

export function parseCanonicalRoomChatMessage(serialized: string): RoomChatCanonicalMessage | null {
  if (serialized.length > MAX_SERIALIZED_CHAT_MESSAGE_LENGTH) {
    return null
  }
  try {
    return parseCanonicalValue(JSON.parse(serialized))
  } catch {
    return null
  }
}

function serializeBounded(value: RoomChatClientMessage | RoomChatCanonicalMessage) {
  const serialized = JSON.stringify(value)
  if (serialized.length > MAX_SERIALIZED_CHAT_MESSAGE_LENGTH) {
    throw new Error('Chat message is too large')
  }
  return serialized
}

function parseSubmitValue(value: unknown): RoomChatClientMessage | null {
  if (!isRecord(value) || value.version !== 1 || value.type !== 'chat.submit' || !isId(value.id) || !isSentAt(value.sentAt) || !isRecord(value.payload) || !isText(value.payload.text)) {
    return null
  }
  return {
    version: 1,
    type: 'chat.submit',
    id: value.id as string,
    sentAt: value.sentAt as string,
    payload: { text: value.payload.text },
  }
}

function parseCanonicalValue(value: unknown): RoomChatCanonicalMessage | null {
  if (!isRecord(value) || value.version !== 1 || value.type !== 'chat.message' || !isId(value.id) || !isSentAt(value.sentAt) || !isRecord(value.sender) || !isId(value.sender.memberId) || typeof value.sender.label !== 'string' || value.sender.label.length === 0 || value.sender.label.length > MAX_SENDER_LABEL_LENGTH || !isRecord(value.payload) || !isText(value.payload.text)) {
    return null
  }
  return {
    version: 1,
    type: 'chat.message',
    id: value.id as string,
    sentAt: value.sentAt as string,
    sender: {
      memberId: value.sender.memberId as string,
      label: value.sender.label,
    },
    payload: { text: value.payload.text },
  }
}
