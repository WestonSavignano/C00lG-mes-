import { describe, expect, it } from 'vitest'
import {
  MAX_PARTY_WIRE_MESSAGE_BYTES,
  PARTY_PROTOCOL_GENERATION,
  parsePartyMessage,
  serializePartyMessage,
  type PartyWireMessage,
} from './partyProtocol'

describe('party wire protocol', () => {
  it('round-trips a guest hello without admission or member credentials', () => {
    const message: PartyWireMessage = {
      version: PARTY_PROTOCOL_GENERATION,
      type: 'hello',
      partyId: 'party-a',
      role: 'guest',
      transportAttemptId: 'attempt-a',
      guestNonce: 'guest-nonce-a',
    }

    const serialized = serializePartyMessage(message)

    expect(parsePartyMessage(serialized)).toEqual(message)
    expect(serialized).not.toContain('credentialSecret')
    expect(serialized).not.toContain('admissionCapability')
  })

  it('round-trips host proof and authentication messages as distinct phases', () => {
    const hostProof: PartyWireMessage = {
      version: PARTY_PROTOCOL_GENERATION,
      type: 'host-proof',
      partyId: 'party-a',
      incarnationId: 'incarnation-a',
      transportAttemptId: 'attempt-a',
      hostPublicKey: 'public-key',
      hostNonce: 'host-nonce-a',
      signature: 'signature-a',
    }
    const admission: PartyWireMessage = {
      version: PARTY_PROTOCOL_GENERATION,
      type: 'authenticate-new',
      partyId: 'party-a',
      transportAttemptId: 'attempt-a',
      admissionCapability: 'admission-a',
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    }
    const resume: PartyWireMessage = {
      version: PARTY_PROTOCOL_GENERATION,
      type: 'authenticate-resume',
      partyId: 'party-a',
      transportAttemptId: 'attempt-b',
      credentialId: 'credential-a',
      credentialSecret: 'secret-a',
    }

    expect(parsePartyMessage(serializePartyMessage(hostProof))).toEqual(hostProof)
    expect(parsePartyMessage(serializePartyMessage(admission))).toEqual(admission)
    expect(parsePartyMessage(serializePartyMessage(resume))).toEqual(resume)
  })

  it('round-trips authenticated, canonical, delta, snapshot, rejection, superseded, and removed messages', () => {
    const messages: PartyWireMessage[] = [
      {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'authenticated',
        partyId: 'party-a',
        incarnationId: 'inc-a',
        transportAttemptId: 'attempt-a',
        memberId: 'member-1',
        label: 'Guest 1',
        canonicalSequence: 4,
        nextRequestSequence: 7,
      },
      {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'chat-intent',
        partyId: 'party-a',
        transportAttemptId: 'attempt-a',
        requestSequence: 2,
        clientMessageId: 'message-a',
        sentAt: 123,
        text: 'hello',
      },
      {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'canonical-chat',
        partyId: 'party-a',
        incarnationId: 'inc-a',
        canonicalSequence: 5,
        message: {
          id: 'message-a',
          sentAt: 123,
          sender: { memberId: 'member-1', label: 'Guest 1' },
          text: 'hello',
        },
      },
      {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'sync-request',
        partyId: 'party-a',
        transportAttemptId: 'attempt-a',
        afterCanonicalSequence: 3,
      },
      {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'sync-delta',
        partyId: 'party-a',
        incarnationId: 'inc-a',
        fromCanonicalSequence: 4,
        toCanonicalSequence: 5,
        events: [],
      },
      {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'sync-snapshot',
        partyId: 'party-a',
        incarnationId: 'inc-a',
        canonicalSequence: 5,
        locked: false,
        members: [],
        messages: [],
      },
      {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'rejected',
        partyId: 'party-a',
        code: 'rate-limited',
      },
      {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'superseded',
        partyId: 'party-a',
        memberId: 'member-1',
      },
      {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'removed',
        partyId: 'party-a',
        memberId: 'member-1',
      },
    ]

    for (const message of messages) {
      expect(parsePartyMessage(serializePartyMessage(message))).toEqual(message)
    }
  })

  it('allows a bounded 200-message UTF-8 snapshot without relaxing individual Chat limits', () => {
    const snapshot: PartyWireMessage = {
      version: PARTY_PROTOCOL_GENERATION,
      type: 'sync-snapshot',
      partyId: 'party-a',
      incarnationId: 'inc-a',
      canonicalSequence: 200,
      locked: false,
      members: [],
      messages: Array.from({ length: 200 }, (_, index) => ({
        id: `message-${index}`,
        sentAt: index,
        sender: { memberId: 'host', label: 'Host' },
        text: '界'.repeat(1_000),
      })),
    }

    const serialized = serializePartyMessage(snapshot)

    expect(new TextEncoder().encode(serialized).byteLength).toBeGreaterThan(512 * 1024)
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(MAX_PARTY_WIRE_MESSAGE_BYTES)
    expect(parsePartyMessage(serialized)).toEqual(snapshot)
  })

  it('fails closed for unsupported versions, unknown types, malformed shapes, and oversized payloads', () => {
    expect(parsePartyMessage(JSON.stringify({ version: 1, type: 'hello' }))).toBeNull()
    expect(parsePartyMessage(JSON.stringify({ version: 2, type: 'future-message' }))).toBeNull()
    expect(parsePartyMessage(JSON.stringify({ version: 2, type: 'hello', partyId: 7 }))).toBeNull()
    expect(parsePartyMessage(JSON.stringify({
      version: 2,
      type: 'authenticated',
      partyId: 'party-a',
      incarnationId: 'inc-a',
      transportAttemptId: 'attempt-a',
      memberId: 'member-a',
      label: 'Guest 1',
      canonicalSequence: 1,
      nextRequestSequence: 0,
    }))).toBeNull()
    expect(parsePartyMessage('x'.repeat(MAX_PARTY_WIRE_MESSAGE_BYTES + 1))).toBeNull()
  })
})
