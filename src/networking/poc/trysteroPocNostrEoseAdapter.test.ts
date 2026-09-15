import { describe, expect, it, vi } from 'vitest'
import { createPocNostrEoseModule } from './trysteroPocNostrEoseAdapter'

type TopicAdapter = {
  init(config: unknown): Array<Promise<unknown>>
  subscribeTopic(
    client: unknown,
    topic: string,
    onMessage: (topic: string, content: string) => void,
    context: { kind: 'root' | 'self' },
  ): Promise<() => void> | (() => void)
}

describe('POC Nostr EOSE adapter', () => {
  it('marks a Trystero root subscription ready only after that relay returns matching EOSE', async () => {
    const send = vi.fn()
    const socket = { readyState: WebSocket.OPEN }
    const client = {
      socket,
      url: 'wss://relay.test',
      send,
      ready: Promise.resolve(undefined as unknown),
      isClosed: false,
      close: vi.fn(),
    }
    client.ready = Promise.resolve(client)

    let adapter: TopicAdapter | null = null
    let onRelayMessage: ((data: string) => void) | null = null
    let onReconnect: (() => void) | null = null

    const relayManager = {
      register: vi.fn((_url: string, createRelay: () => unknown) => createRelay()),
      getSockets: vi.fn(() => ({ 'wss://relay.test': socket })),
    }

    const joinRoom = vi.fn()
    const core = {
      createRelayManager: vi.fn(() => relayManager),
      createTopicStrategy: vi.fn((value: TopicAdapter) => {
        adapter = value
        return joinRoom
      }),
      getRelays: vi.fn(() => ['wss://relay.test']),
      makeSocket: vi.fn((_url: string, onMessage: (data: string) => void, reconnect: () => void) => {
        onRelayMessage = onMessage
        onReconnect = reconnect
        return client
      }),
      genId: vi.fn(() => 'root-sub-id'),
      selfId: 'guest-transport-id',
    }

    const nostr = {
      createEvent: vi.fn(async () => 'signed-event'),
      subscribe: vi.fn((subId: string, topic: string) => JSON.stringify(['REQ', subId, topic])),
      defaultRelayUrls: ['wss://relay.test'],
    }
    const observe = vi.fn()

    const module = createPocNostrEoseModule({ core, nostr, observe })
    expect(module.joinRoom).toBe(joinRoom)
    expect(adapter).not.toBeNull()

    const [relayPromise] = adapter!.init({})
    const relay = await relayPromise
    const onRootReady = vi.fn()
    const stopReady = module.onRootSubscriptionReady(onRootReady)
    const onMessage = vi.fn()
    const cleanup = await adapter!.subscribeTopic(
      relay,
      'root-topic',
      onMessage,
      { kind: 'root' },
    )

    expect(send).toHaveBeenCalledWith(JSON.stringify(['REQ', 'root-sub-id', 'root-topic']))
    expect(onRootReady).not.toHaveBeenCalled()

    onRelayMessage?.(JSON.stringify([
      'EVENT',
      'root-sub-id',
      { content: 'host-announcement', tags: [['x', 'root-topic']] },
    ]))
    expect(onMessage).toHaveBeenCalledWith('root-topic', 'host-announcement')
    expect(onRootReady).not.toHaveBeenCalled()

    onRelayMessage?.(JSON.stringify(['EOSE', 'other-sub-id']))
    expect(onRootReady).not.toHaveBeenCalled()

    onRelayMessage?.(JSON.stringify(['EOSE', 'root-sub-id']))
    expect(onRootReady).toHaveBeenCalledTimes(1)
    expect(onRootReady).toHaveBeenCalledWith({
      relayUrl: 'wss://relay.test',
      socket,
    })
    expect(observe).toHaveBeenCalledWith({
      stage: 'root-subscription-ready',
      relayUrl: 'wss://relay.test',
    })

    onReconnect?.()
    expect(send).toHaveBeenCalledTimes(2)
    onRelayMessage?.(JSON.stringify(['EOSE', 'root-sub-id']))
    expect(onRootReady).toHaveBeenCalledTimes(2)

    cleanup()
    expect(send).toHaveBeenLastCalledWith(JSON.stringify(['CLOSE', 'root-sub-id']))
    stopReady()
  })
})
