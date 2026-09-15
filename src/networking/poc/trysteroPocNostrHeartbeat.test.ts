import { describe, expect, it, vi } from 'vitest'
import { TRYSTERO_POC_APP_ID } from './trysteroPocModel'
import {
  FAST_NOSTR_HEARTBEAT_MS,
  derivePocNostrRootTopic,
  sendPocNostrPresenceHeartbeat,
} from './trysteroPocNostrHeartbeat'

describe('fast Nostr POC heartbeat', () => {
  it('uses a five-second cadence and derives the same root topic namespace as Trystero', async () => {
    expect(FAST_NOSTR_HEARTBEAT_MS).toBe(5_000)
    await expect(derivePocNostrRootTopic(TRYSTERO_POC_APP_ID, 'party-a'))
      .resolves.toBe('443c959e0473622f81aeb337362aac8a0ea01d58')
  })

  it('sends a normal signed host-presence event only through open relay sockets', async () => {
    const openSend = vi.fn()
    const closedSend = vi.fn()
    const createEvent = vi.fn(async () => 'signed-event')

    const result = await sendPocNostrPresenceHeartbeat({
      appId: TRYSTERO_POC_APP_ID,
      roomId: 'party-a',
      peerId: 'transport-peer',
      createEvent,
      sockets: {
        open: { readyState: WebSocket.OPEN, send: openSend },
        closed: { readyState: WebSocket.CLOSED, send: closedSend },
      },
    })

    expect(createEvent).toHaveBeenCalledWith(
      '443c959e0473622f81aeb337362aac8a0ea01d58',
      JSON.stringify({ peerId: 'transport-peer' }),
    )
    expect(openSend).toHaveBeenCalledWith('signed-event')
    expect(closedSend).not.toHaveBeenCalled()
    expect(result).toEqual({ openRelayCount: 1, sentRelayCount: 1 })
  })
})
