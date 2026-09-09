import { describe, expect, it } from 'vitest'
import { decodeSignal, encodeSignal } from './signalingCodec'

function encodeRawPayload(payload: unknown) {
  return btoa(JSON.stringify(payload))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

describe('signalingCodec', () => {
  it('round trips an offer', () => {
    const offer: RTCSessionDescriptionInit = {
      type: 'offer',
      sdp: 'v=0\r\na=ice-ufrag:host-offer\r\n',
    }

    const encoded = encodeSignal(offer)

    expect(decodeSignal(encoded, 'offer')).toEqual(offer)
  })

  it('round trips an answer', () => {
    const answer: RTCSessionDescriptionInit = {
      type: 'answer',
      sdp: 'v=0\r\na=ice-ufrag:guest-answer\r\n',
    }

    const encoded = encodeSignal(answer)

    expect(decodeSignal(encoded, 'answer')).toEqual(answer)
  })

  it('produces URL-safe output', () => {
    const encoded = encodeSignal({
      type: 'offer',
      sdp: 'v=0\r\na=ice-pwd:+/unsafe-padding-test\r\n',
    })

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/u)
  })

  it('rejects malformed encoded data', () => {
    expect(() => decodeSignal('not-valid-encoded-json', 'offer')).toThrow(
      'Invalid signaling payload',
    )
  })

  it('rejects unsupported signaling versions', () => {
    const encoded = encodeRawPayload({
      version: 2,
      description: {
        type: 'offer',
        sdp: 'v=0\r\n',
      },
    })

    expect(() => decodeSignal(encoded, 'offer')).toThrow(
      'Unsupported signaling version',
    )
  })

  it('rejects a session description with the wrong type', () => {
    const encoded = encodeRawPayload({
      version: 1,
      description: {
        type: 'answer',
        sdp: 'v=0\r\n',
      },
    })

    expect(() => decodeSignal(encoded, 'offer')).toThrow(
      'Unexpected signaling type',
    )
  })
})
