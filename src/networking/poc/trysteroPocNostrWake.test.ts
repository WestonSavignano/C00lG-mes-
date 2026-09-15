import { describe, expect, it, vi } from 'vitest'
import { TRYSTERO_POC_APP_ID } from './trysteroPocModel'
import {
  POC_NOSTR_WAKE_COOLDOWN_MS,
  derivePocNostrRootTopic,
  derivePocNostrWakeTopic,
  getPocNostrWakeDiagnostics,
  resetPocNostrWakeDiagnostics,
  startPocNostrGuestWake,
  startPocNostrHostWakeListener,
} from './trysteroPocNostrWake'

function createSocket(initialState = WebSocket.OPEN) {
  let state = initialState
  let messageHandler: ((event: MessageEvent<string>) => void) | null = null
  let openHandler: (() => void) | null = null
  const send = vi.fn()

  return {
    socket: {
      get readyState() {
        return state
      },
      send,
      addEventListener: vi.fn((type: string, handler: EventListener) => {
        if (type === 'message') messageHandler = handler as (event: MessageEvent<string>) => void
        if (type === 'open') openHandler = handler as () => void
      }),
      removeEventListener: vi.fn(),
    },
    send,
    open() {
      state = WebSocket.OPEN
      openHandler?.()
    },
    message(data: string) {
      messageHandler?.({ data } as MessageEvent<string>)
    },
  }
}

describe('event-driven Nostr late-guest wake', () => {
  it('derives Trystero 0.25.4 root-topic encoding and a private wake topic bound to the rendezvous secret', async () => {
    await expect(derivePocNostrRootTopic(TRYSTERO_POC_APP_ID, 'party-a'))
      .resolves.toBe('1w1o454e4372q1b3l4u4z1j1i164s3ue4gt2g')

    const first = await derivePocNostrWakeTopic(TRYSTERO_POC_APP_ID, 'party-a', 'secret-a')
    const second = await derivePocNostrWakeTopic(TRYSTERO_POC_APP_ID, 'party-a', 'secret-b')

    expect(first).toMatch(/^[0-9a-f]{64}$/u)
    expect(second).toMatch(/^[0-9a-f]{64}$/u)
    expect(first).not.toBe(second)
    expect(first).not.toContain('party-a')
    expect(first).not.toContain('secret-a')
  })

  it('sends one guest wake only when that relay root subscription reports EOSE readiness', async () => {
    const first = createSocket(WebSocket.OPEN)
    const reconnect = createSocket(WebSocket.OPEN)
    const createEvent = vi.fn(async () => 'signed-wake-event')
    const cleanup = vi.fn()
    let onReady: ((event: { relayUrl: string; socket: typeof first.socket }) => void) | null = null
    const onRootSubscriptionReady = vi.fn((listener: typeof onReady) => {
      onReady = listener
      return cleanup
    })

    const wake = await startPocNostrGuestWake({
      appId: TRYSTERO_POC_APP_ID,
      roomId: 'party-a',
      rendezvousSecret: 'secret-a',
      createEvent,
      onRootSubscriptionReady,
    })

    expect(createEvent).toHaveBeenCalledTimes(1)
    expect(first.send).not.toHaveBeenCalled()

    onReady?.({ relayUrl: 'wss://relay.test', socket: first.socket })
    expect(first.send).toHaveBeenCalledTimes(1)
    expect(first.send).toHaveBeenCalledWith('signed-wake-event')

    onReady?.({ relayUrl: 'wss://relay.test', socket: first.socket })
    expect(first.send).toHaveBeenCalledTimes(1)

    onReady?.({ relayUrl: 'wss://relay.test', socket: reconnect.socket })
    expect(reconnect.send).toHaveBeenCalledTimes(1)
    expect(reconnect.send).toHaveBeenCalledWith('signed-wake-event')

    wake.stop()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('lets an active host turn a private wake event into one normal Trystero host announcement with duplicate and spam bounds', async () => {
    const relay = createSocket(WebSocket.OPEN)
    const createEvent = vi.fn(async (_topic: string, content: string) => `signed:${content}`)
    const subscribe = vi.fn(() => 'wake-subscription')
    const onWakeReceived = vi.fn()
    const onAnnouncementSent = vi.fn()
    let now = 10_000

    const listener = await startPocNostrHostWakeListener({
      appId: TRYSTERO_POC_APP_ID,
      roomId: 'party-a',
      rendezvousSecret: 'secret-a',
      peerId: 'host-transport-peer',
      createEvent,
      subscribe,
      onWakeReceived,
      onAnnouncementSent,
      createSubscriptionId: () => 'wake-sub-id',
      now: () => now,
      sockets: { relay: relay.socket },
    })

    expect(POC_NOSTR_WAKE_COOLDOWN_MS).toBeGreaterThanOrEqual(1_000)
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(relay.send).toHaveBeenCalledWith('wake-subscription')

    const wakeTopic = await derivePocNostrWakeTopic(TRYSTERO_POC_APP_ID, 'party-a', 'secret-a')
    const rootTopic = await derivePocNostrRootTopic(TRYSTERO_POC_APP_ID, 'party-a')
    const wakeMessage = (id: string) => JSON.stringify([
      'EVENT',
      'wake-sub-id',
      {
        id,
        content: JSON.stringify({ type: 'wake', version: 1 }),
        tags: [['x', wakeTopic]],
      },
    ])

    relay.message(wakeMessage('wake-1'))
    await vi.waitFor(() => expect(createEvent).toHaveBeenCalledWith(
      rootTopic,
      JSON.stringify({ peerId: 'host-transport-peer' }),
    ))
    expect(onWakeReceived).toHaveBeenCalledTimes(1)
    expect(onAnnouncementSent).toHaveBeenCalledWith(1)

    const callsAfterFirstWake = createEvent.mock.calls.length
    relay.message(wakeMessage('wake-1'))
    relay.message(wakeMessage('wake-2'))
    await Promise.resolve()
    expect(createEvent).toHaveBeenCalledTimes(callsAfterFirstWake)
    expect(onWakeReceived).toHaveBeenCalledTimes(1)

    now += POC_NOSTR_WAKE_COOLDOWN_MS + 1
    relay.message(wakeMessage('wake-3'))
    await vi.waitFor(() => expect(createEvent).toHaveBeenCalledTimes(callsAfterFirstWake + 1))
    expect(onWakeReceived).toHaveBeenCalledTimes(2)
    expect(onAnnouncementSent).toHaveBeenCalledTimes(2)

    listener.stop()
    expect(relay.send).toHaveBeenCalledWith(JSON.stringify(['CLOSE', 'wake-sub-id']))
  })

  it('records sanitized relay acknowledgement evidence for the manual host announcement', async () => {
    resetPocNostrWakeDiagnostics()
    const relay = createSocket(WebSocket.OPEN)
    const announcementId = 'announcement-event-id'
    const createEvent = vi.fn(async (_topic: string, content: string) => JSON.stringify([
      'EVENT',
      {
        id: announcementId,
        content,
        tags: [],
      },
    ]))
    const subscribe = vi.fn(() => 'wake-subscription')

    const listener = await startPocNostrHostWakeListener({
      appId: TRYSTERO_POC_APP_ID,
      roomId: 'party-a',
      rendezvousSecret: 'secret-a',
      peerId: 'host-transport-peer',
      createEvent,
      subscribe,
      createSubscriptionId: () => 'wake-sub-id',
      sockets: { 'wss://relay.test': relay.socket },
    })

    const wakeTopic = await derivePocNostrWakeTopic(TRYSTERO_POC_APP_ID, 'party-a', 'secret-a')
    relay.message(JSON.stringify([
      'EVENT',
      'wake-sub-id',
      {
        id: 'wake-1',
        content: JSON.stringify({ type: 'wake', version: 1 }),
        tags: [['x', wakeTopic]],
      },
    ]))

    await vi.waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1))
    relay.message(JSON.stringify([
      'OK',
      announcementId,
      false,
      'rate-limited: slow down',
    ]))

    expect(getPocNostrWakeDiagnostics()).toContainEqual(expect.objectContaining({
      stage: 'host-announcement-ack',
      relayUrl: 'wss://relay.test',
      accepted: false,
      ackReasonCategory: 'rate-limited',
    }))
    expect(JSON.stringify(getPocNostrWakeDiagnostics())).not.toContain(announcementId)
    expect(JSON.stringify(getPocNostrWakeDiagnostics())).not.toContain('slow down')

    listener.stop()
  })
})
