import type { SignalType, SignalingPayloadV1 } from './types'

const SIGNALING_VERSION = 1

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const paddingLength = (4 - (normalized.length % 4)) % 4
  const padded = normalized.padEnd(normalized.length + paddingLength, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

function isSignalType(value: unknown): value is SignalType {
  return value === 'offer' || value === 'answer'
}

function parsePayload(encoded: string): unknown {
  try {
    return JSON.parse(decodeBase64Url(encoded))
  } catch {
    throw new Error('Invalid signaling payload')
  }
}

export function encodeSignal(description: RTCSessionDescriptionInit) {
  if (!isSignalType(description.type) || typeof description.sdp !== 'string' || !description.sdp) {
    throw new Error('Invalid signaling payload')
  }

  const payload: SignalingPayloadV1 = {
    version: SIGNALING_VERSION,
    description: {
      type: description.type,
      sdp: description.sdp,
    },
  }

  return encodeBase64Url(JSON.stringify(payload))
}

export function decodeSignal(
  encoded: string,
  expectedType: SignalType,
): RTCSessionDescriptionInit {
  const payload = parsePayload(encoded)

  if (typeof payload !== 'object' || payload === null || !('version' in payload)) {
    throw new Error('Invalid signaling payload')
  }

  if (payload.version !== SIGNALING_VERSION) {
    throw new Error('Unsupported signaling version')
  }

  if (!('description' in payload)) {
    throw new Error('Invalid signaling payload')
  }

  const description = payload.description

  if (
    typeof description !== 'object'
    || description === null
    || !('type' in description)
    || !('sdp' in description)
    || !isSignalType(description.type)
    || typeof description.sdp !== 'string'
    || !description.sdp
  ) {
    throw new Error('Invalid signaling payload')
  }

  if (description.type !== expectedType) {
    throw new Error('Unexpected signaling type')
  }

  return {
    type: description.type,
    sdp: description.sdp,
  }
}
