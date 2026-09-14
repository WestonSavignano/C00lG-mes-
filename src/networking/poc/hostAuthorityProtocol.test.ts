import { describe, expect, it } from 'vitest'
import { parseAuthorityServerMessage } from './hostAuthorityProtocol'

const MEMBER_ID = '55555555-5555-4555-8555-555555555555'

const sync = {
  version: 1 as const,
  type: 'sync.response' as const,
  mode: 'delta' as const,
  sequence: 0,
  retainedFromSequence: 1,
  acceptedClientSequence: 0,
  events: [],
  snapshot: null,
}

describe('host authority server protocol', () => {
  it('parses bounded auth acceptance and sync payloads', () => {
    expect(parseAuthorityServerMessage({
      version: 1,
      type: 'auth.accepted',
      memberId: MEMBER_ID,
      label: 'Guest 1',
      sync,
    })).toEqual({
      version: 1,
      type: 'auth.accepted',
      memberId: MEMBER_ID,
      label: 'Guest 1',
      sync,
    })
  })

  it('rejects malformed remote canonical messages', () => {
    expect(parseAuthorityServerMessage(null)).toBeNull()
    expect(parseAuthorityServerMessage({ version: 2, type: 'auth.denied', reason: 'member-removed' })).toBeNull()
    expect(parseAuthorityServerMessage({ version: 1, type: 'canonical.event', event: { type: 'chat.message' } })).toBeNull()
    expect(parseAuthorityServerMessage({ ...sync, type: 'auth.accepted', memberId: 'forged', label: 'Guest 1', sync })).toBeNull()
  })
})
