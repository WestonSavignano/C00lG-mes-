export const PARTY_PROTOCOL_GENERATION = 2 as const
export const HOST_PARTY_STORAGE_SCHEMA_VERSION = 1 as const
export const GUEST_PARTY_STORAGE_SCHEMA_VERSION = 1 as const
export const MAX_PARTY_GUESTS = 7

export type PartyRole = 'host' | 'guest'

export type PartyMemberView = {
  memberId: string
  label: string
  removed: boolean
}

export type PartyChatMessage = {
  id: string
  sentAt: number
  sender: {
    memberId: string
    label: string
  }
  text: string
}

export type PartyRoute =
  | { kind: 'none' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'host'; partyId: string }
  | { kind: 'guest'; partyId: string }
  | {
      kind: 'guest-invite'
      partyId: string
      rendezvousCapability: string
      admissionCapability: string
      hostFingerprint: string
    }
