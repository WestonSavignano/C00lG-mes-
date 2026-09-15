import { describe, expect, it, vi } from 'vitest'
import {
  createEventDrivenNostrModule,
  type TrysteroNostrCoreModule,
  type TrysteroNostrPrimitives,
} from './trysteroNostrRendezvous'

type CapturedAdapter = {
  init(config: unknown): Array<Promise<FakeClient>>
  publishTopic(
    client: FakeClient,
    topic: string,
    message: unknown,
    context: { kind: 'announce' | 'signal' },
  ): Promise<undefined | { nextAnnounceMs?: number; stopAnnouncing?: boolean }>
}

type FakeClient = {
  socket: { readyState: number }
  url: string
  ready: Promise<FakeClient>
  isClosed: boolean
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

describe('event-driven Nostr adapter parity', () => {
  it('backs off an announcement after a relay returns a rate-limited rejection', async () => {
    let adapter: CapturedAdapter | null = null
    let relayMessage: ((data: string) => void) | null = null

    const client = {} as FakeClient
    client.socket = { readyState: 1 }
    client.url = 'wss://relay.example/'
    client.isClosed = false
    client.send = vi.fn()
    client.close = vi.fn(() => {
      client.isClosed = true
    })
    client.ready = Promise.resolve(client)

    const core = {
      createRelayManager: vi.fn(() => ({
        register: vi.fn((_url: string, createRelay: () => FakeClient) => createRelay()),
        getSockets: vi.fn(() => ({ [client.url]: client.socket })),
      })),
      createTopicStrategy: vi.fn((candidate: CapturedAdapter) => {
        adapter = candidate
        return vi.fn()
      }),
      getRelays: vi.fn(() => [client.url]),
      makeSocket: vi.fn((_url: string, onMessage: (data: string) => void) => {
        relayMessage = onMessage
        return client
      }),
      genId: vi.fn(() => 'subscription-id'),
      selfId: 'self-id',
    } as unknown as TrysteroNostrCoreModule

    let eventIndex = 0
    const nostr = {
      createEvent: vi.fn(async (_topic: string, content: string) => JSON.stringify([
        'EVENT',
        { id: `event-${++eventIndex}`, content, tags: [['x', 'root-topic']] },
      ])),
      subscribe: vi.fn(() => JSON.stringify(['REQ', 'subscription-id', {}])),
      defaultRelayUrls: [client.url],
    } as TrysteroNostrPrimitives

    createEventDrivenNostrModule({ core, nostr })
    expect(adapter).not.toBeNull()
    const relay = await adapter!.init({})[0]

    const first = await adapter!.publishTopic(
      relay,
      'root-topic',
      { peerId: 'self-id' },
      { kind: 'announce' },
    )
    expect(first).toEqual(expect.objectContaining({ nextAnnounceMs: 60_000 }))
    expect(nostr.createEvent).toHaveBeenCalledTimes(1)

    relayMessage?.(JSON.stringify(['OK', 'event-1', false, 'rate-limited: slow down']))

    const second = await adapter!.publishTopic(
      relay,
      'root-topic',
      { peerId: 'self-id' },
      { kind: 'announce' },
    )

    expect(second).toEqual(expect.objectContaining({ nextAnnounceMs: expect.any(Number) }))
    expect(nostr.createEvent).toHaveBeenCalledTimes(1)
    expect(client.close).not.toHaveBeenCalled()
  })
})
