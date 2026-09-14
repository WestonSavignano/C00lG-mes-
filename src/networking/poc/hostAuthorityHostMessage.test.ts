import { describe, expect, it } from 'vitest'
import { commitHostChat } from './hostAuthorityHostMessage'
import { createInitialHostAuthorityState } from './hostAuthorityModel'

const PARTY_ID = '11111111-1111-4111-8111-111111111111'
const INCARNATION_ID = '22222222-2222-4222-8222-222222222222'
const HOST_ID = '33333333-3333-4333-8333-333333333333'

describe('host-authored canonical chat', () => {
  it('assigns the durable host identity and next canonical sequence', () => {
    const state = createInitialHostAuthorityState({
      partyId: PARTY_ID,
      incarnationId: INCARNATION_ID,
      hostAppIdentity: HOST_ID,
    })

    const committed = commitHostChat(state, ' host says hello ')
    expect(committed).toMatchObject({ accepted: true })
    if (!committed.accepted) return
    expect(committed.event).toMatchObject({
      sequence: 1,
      type: 'chat.message',
      sender: { memberId: HOST_ID, label: 'Host' },
      text: 'host says hello',
    })
    expect(committed.state.canonicalSequence).toBe(1)
  })

  it('rejects empty and oversized host messages without advancing state', () => {
    const state = createInitialHostAuthorityState({
      partyId: PARTY_ID,
      incarnationId: INCARNATION_ID,
      hostAppIdentity: HOST_ID,
    })
    expect(commitHostChat(state, '   ')).toMatchObject({ accepted: false })
    expect(commitHostChat(state, 'x'.repeat(1_001))).toMatchObject({ accepted: false })
    expect(state.canonicalSequence).toBe(0)
  })
})
