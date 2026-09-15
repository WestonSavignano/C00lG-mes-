import { describe, expect, it, vi } from 'vitest'
import { TRYSTERO_POC_APP_ID } from './trysteroPocModel'
import {
  POC_NOSTR_WAKE_COOLDOWN_MS,
  derivePocNostrRootTopic,
  derivePocNostrWakeTopic,
  sendPocNostrGuestWake,
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
  it('derives the normal Trystero root topic and a private wake topic bound to the rendezvous secret', async () => {
    await expect(derivePocNostrRootTopic(TRYSTERO_POC_APP_ID, 'party-a'))
      .resolves.toBe('443c959e0473622f81aeb337362aac8a0ea01d58')

    const first = await derivePocNostrWakeTopic(TRYSTERO_POC_APP_ID, 'party-a', 'secret-a')
    const second = await derivePocNostrWakeTopic(TRYSTERO_POC_APP_ID, 'party-a', 'secret-b')

    expect(first).toMatch(/^[0-9a-f]{64}$/u)
    expect(second).toMatch(/^[0-9a-f]{64}$/u)
    expect(first).not.toBe(second)
    expect(first).not.toContain('party-a')
    expect(first).not.toContain('secret-a')
  })

  it('waits for the Trystero room subscription to settle after relay open before sending the bounded guest wake', async () => {
    vi.useFakeTimers()
    try {
      const open = createSocket(WebSocket.OPEN)
      const connecting = createSocket(WebSocket.CONNECTING)
      const createEvent = vi.fn(async () => 'signed-wake-event')
      const onWakeSent = vi.fn()

      const result = await sendPocNostrGuestWake({
        appId: TRYSTERO_POC_APP_ID,
        roomId: 'party-a',
        rendezvousSecret: 'secret-a',
        createEvent,
        onWakeSent,
        sockets: {
          open: open.socket,
          connecting: connecting.socket,
        },
      })

      expect(createEvent).toHaveBeenCalledTimes(1)
      expect(open.send).not.toHaveBeenCalled()
      expect(connecting.send).not.toHaveBeenCalled()
      expect(onWakeSent).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(499)
      expect(open.send).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(open.send).toHaveBeenCalledTimes(1)
      expect(open.send).toHaveBeenCalledWith('signed-wake-event')
      expect(onWakeSent).toHaveBeenCalledTimes(1)

      connecting.open()
      expect(connecting.send).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(500)
      expect(connecting.send).toHaveBeenCalledTimes(1)
      expect(connecting.send).toHaveBeenCalledWith('signed-wake-event')
      expect(onWakeSent).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ sentImmediately: 1, waitingForOpen: 1, settleMs: 500 })
    } finally {
      vi.useRealTimers()
    }
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
})
