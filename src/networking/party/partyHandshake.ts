import {
  createHostProofChallenge,
  fingerprintHostPublicKey,
  generateCapability,
  generateTransportAttemptId,
  importHostPublicKey,
  signHostProof,
  verifyHostProof,
} from './partyCrypto'
import type { GuestPartyStore } from './guestPartyStore'
import { GuestPartyReplica } from './guestPartyReplica'
import { HostPartyAuthority } from './hostPartyAuthority'
import {
  parsePartyMessage,
  PARTY_PROTOCOL_GENERATION,
  serializePartyMessage,
  type PartyCanonicalWireEvent,
  type PartyWireMessage,
} from './partyProtocol'
import type {
  TrysteroHandshakeReceive,
  TrysteroHandshakeSend,
} from './trysteroNostrTransport'
import type { HostPartyMemberRecord } from './hostPartyStore'

async function receiveMessage(receive: TrysteroHandshakeReceive) {
  const received = await receive()
  if (typeof received.data !== 'string') {
    throw new Error('Invalid party handshake payload')
  }
  const message = parsePartyMessage(received.data)
  if (!message) {
    throw new Error('Invalid party handshake message')
  }
  return message
}

async function sendMessage(send: TrysteroHandshakeSend, message: PartyWireMessage) {
  await send(serializePartyMessage(message))
}

export type HostHandshakeAuthenticated = {
  peerId: string
  transportAttemptId: string
  member: HostPartyMemberRecord
  isNewMember: boolean
  event: PartyCanonicalWireEvent | null
  replaced: { peerId: string; transportAttemptId: string } | null
}

export function createHostPartyHandshake(input: {
  authority: HostPartyAuthority
  onAuthenticated?: (authenticated: HostHandshakeAuthenticated) => void | Promise<void>
}) {
  return async (
    peerId: string,
    send: TrysteroHandshakeSend,
    receive: TrysteroHandshakeReceive,
    _isInitiator: boolean,
  ) => {
    const hello = await receiveMessage(receive)
    if (hello.type !== 'hello'
      || hello.partyId !== input.authority.state.partyId
      || hello.role !== 'guest') {
      throw new Error('Invalid guest hello')
    }

    const hostNonce = generateCapability()
    const challenge = createHostProofChallenge({
      partyId: input.authority.state.partyId,
      incarnationId: input.authority.state.incarnationId,
      guestNonce: hello.guestNonce,
      hostNonce,
      transportAttemptId: hello.transportAttemptId,
    })
    const signature = await signHostProof(input.authority.state.hostPrivateKey, challenge)
    await sendMessage(send, {
      version: PARTY_PROTOCOL_GENERATION,
      type: 'host-proof',
      partyId: input.authority.state.partyId,
      incarnationId: input.authority.state.incarnationId,
      transportAttemptId: hello.transportAttemptId,
      hostPublicKey: input.authority.state.hostPublicKey,
      hostNonce,
      signature,
    })

    const authentication = await receiveMessage(receive)
    if (authentication.partyId !== input.authority.state.partyId
      || !('transportAttemptId' in authentication)
      || authentication.transportAttemptId !== hello.transportAttemptId) {
      throw new Error('Authentication does not match this transport attempt')
    }

    let member: HostPartyMemberRecord
    let isNewMember = false
    let event: PartyCanonicalWireEvent | null = null

    if (authentication.type === 'authenticate-new') {
      const result = await input.authority.authenticateNew({
        admissionCapability: authentication.admissionCapability,
        credentialId: authentication.credentialId,
        credentialSecret: authentication.credentialSecret,
      })
      if (!result.accepted) {
        await sendMessage(send, {
          version: PARTY_PROTOCOL_GENERATION,
          type: 'rejected',
          partyId: input.authority.state.partyId,
          code: result.reason,
        })
        throw new Error(`Party admission rejected: ${result.reason}`)
      }
      member = result.member
      isNewMember = true
      event = result.event
    } else if (authentication.type === 'authenticate-resume') {
      const result = await input.authority.authenticateResume({
        credentialId: authentication.credentialId,
        credentialSecret: authentication.credentialSecret,
      })
      if (!result.accepted) {
        await sendMessage(send, {
          version: PARTY_PROTOCOL_GENERATION,
          type: 'rejected',
          partyId: input.authority.state.partyId,
          code: result.reason,
        })
        throw new Error(`Party resume rejected: ${result.reason}`)
      }
      member = result.member
    } else {
      throw new Error('Expected party authentication after host proof')
    }

    const { replaced } = input.authority.bindTransport(member.memberId, peerId, hello.transportAttemptId)
    await sendMessage(send, {
      version: PARTY_PROTOCOL_GENERATION,
      type: 'authenticated',
      partyId: input.authority.state.partyId,
      incarnationId: input.authority.state.incarnationId,
      transportAttemptId: hello.transportAttemptId,
      memberId: member.memberId,
      label: member.label,
      canonicalSequence: input.authority.state.canonicalSequence,
      nextRequestSequence: member.lastAcceptedRequestSequence + 1,
    })

    await input.onAuthenticated?.({
      peerId,
      transportAttemptId: hello.transportAttemptId,
      member,
      isNewMember,
      event,
      replaced,
    })
  }
}

export type GuestHandshakeAuthenticated = {
  hostPeerId: string
  transportAttemptId: string
  memberId: string
  label: string
  hostCanonicalSequence: number
  nextRequestSequence: number
}

export function createGuestPartyHandshake(input: {
  replica: GuestPartyReplica
  store: GuestPartyStore
  admissionCapability?: string
  onAuthenticated?: (authenticated: GuestHandshakeAuthenticated) => void | Promise<void>
}) {
  return async (
    peerId: string,
    send: TrysteroHandshakeSend,
    receive: TrysteroHandshakeReceive,
    _isInitiator: boolean,
  ) => {
    const transportAttemptId = generateTransportAttemptId()
    const guestNonce = generateCapability()
    await sendMessage(send, {
      version: PARTY_PROTOCOL_GENERATION,
      type: 'hello',
      partyId: input.replica.state.partyId,
      role: 'guest',
      transportAttemptId,
      guestNonce,
    })

    const proof = await receiveMessage(receive)
    if (proof.type !== 'host-proof'
      || proof.partyId !== input.replica.state.partyId
      || proof.transportAttemptId !== transportAttemptId) {
      throw new Error('Invalid host proof')
    }

    const hostPublicKey = await importHostPublicKey(proof.hostPublicKey)
    const fingerprint = await fingerprintHostPublicKey(hostPublicKey)
    if (fingerprint !== input.replica.state.hostFingerprint) {
      throw new Error('Party host identity does not match the pinned invite')
    }
    if (input.replica.state.incarnationId && input.replica.state.incarnationId !== proof.incarnationId) {
      throw new Error('The original party incarnation is no longer available')
    }

    const challenge = createHostProofChallenge({
      partyId: proof.partyId,
      incarnationId: proof.incarnationId,
      guestNonce,
      hostNonce: proof.hostNonce,
      transportAttemptId,
    })
    if (!(await verifyHostProof(hostPublicKey, challenge, proof.signature))) {
      throw new Error('Party host identity proof could not be verified')
    }

    const durableGuest = input.replica.state
    if (durableGuest.memberId && durableGuest.incarnationId) {
      await sendMessage(send, {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'authenticate-resume',
        partyId: durableGuest.partyId,
        transportAttemptId,
        credentialId: durableGuest.credentialId,
        credentialSecret: durableGuest.credentialSecret,
      })
    } else {
      if (!input.admissionCapability) {
        throw new Error('This guest has no admission capability or resumable member credentials')
      }
      await sendMessage(send, {
        version: PARTY_PROTOCOL_GENERATION,
        type: 'authenticate-new',
        partyId: durableGuest.partyId,
        transportAttemptId,
        admissionCapability: input.admissionCapability,
        credentialId: durableGuest.credentialId,
        credentialSecret: durableGuest.credentialSecret,
      })
    }

    const authenticated = await receiveMessage(receive)
    if (authenticated.type === 'rejected') {
      throw new Error(`Party authentication rejected: ${authenticated.code}`)
    }
    if (authenticated.type !== 'authenticated'
      || authenticated.partyId !== durableGuest.partyId
      || authenticated.transportAttemptId !== transportAttemptId
      || authenticated.incarnationId !== proof.incarnationId) {
      throw new Error('Invalid authenticated party response')
    }

    input.replica.replaceAuthentication({
      incarnationId: authenticated.incarnationId,
      memberId: authenticated.memberId,
      label: authenticated.label,
      nextRequestSequence: authenticated.nextRequestSequence,
    })
    await input.store.save(input.replica.state)

    await input.onAuthenticated?.({
      hostPeerId: peerId,
      transportAttemptId,
      memberId: authenticated.memberId,
      label: authenticated.label,
      hostCanonicalSequence: authenticated.canonicalSequence,
      nextRequestSequence: authenticated.nextRequestSequence,
    })
  }
}
