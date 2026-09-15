const EVENT = 'EVENT'
const EOSE = 'EOSE'
const CLOSED = 'CLOSED'
const ROOT_KIND = 'root'
const ANNOUNCE_KIND = 'announce'
const DEFAULT_REDUNDANCY = 5
const STEADY_ANNOUNCE_INTERVAL_MS = 60_000
const OPEN = 1

type SocketLike = {
  readonly readyState: number
}

type SocketClientLike = {
  socket: SocketLike
  url: string
  ready: Promise<SocketClientLike>
  isClosed: boolean
  send(data: string): void
  close?(): void
}

type TopicSubscriptionContext = {
  kind: 'root' | 'self'
}

type TopicPublishContext = {
  kind: 'announce' | 'signal'
}

type TopicAdapter = {
  init(config: unknown): Array<Promise<SocketClientLike>>
  subscribeTopic(
    client: SocketClientLike,
    topic: string,
    onMessage: (topic: string, content: string) => void | Promise<void>,
    context: TopicSubscriptionContext,
  ): (() => void) | Promise<() => void>
  publishTopic(
    client: SocketClientLike,
    topic: string,
    message: unknown,
    context: TopicPublishContext,
  ): Promise<undefined | { nextAnnounceMs: number }>
}

type RelayManagerLike = {
  register(url: string, createRelay: () => SocketClientLike): SocketClientLike
  getSockets(): Record<string, SocketLike>
}

export type PocNostrCoreModule = {
  createRelayManager(getSocket: (client: SocketClientLike) => SocketLike): RelayManagerLike
  createTopicStrategy(adapter: TopicAdapter): unknown
  getRelays(
    config: unknown,
    defaults: string[],
    redundancy: number,
    normalize: boolean,
  ): string[]
  makeSocket(
    url: string,
    onMessage: (data: string) => void,
    onReconnect: () => void,
  ): SocketClientLike
  genId(length: number): string
  selfId: string
}

export type PocNostrModule = {
  createEvent(topic: string, content: string): Promise<string>
  subscribe(subscriptionId: string, topic: string): string
  defaultRelayUrls: string[]
}

export type PocTrysteroMessageKind =
  | 'announcement'
  | 'nudge'
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'unknown'

export type PocNostrAdapterObservation = {
  stage:
    | 'relay-open'
    | 'relay-reconnected'
    | 'root-subscription-sent'
    | 'root-subscription-ready'
    | 'root-subscription-closed'
    | 'trystero-message-received'
    | 'trystero-message-published'
  relayUrl: string
  messageKind?: PocTrysteroMessageKind
}

export type PocNostrRootReadyEvent = {
  relayUrl: string
  socket: SocketLike
}

type SubscriptionRecord = {
  subscriptionId: string
  topic: string
  kind: TopicSubscriptionContext['kind']
  onMessage: (topic: string, content: string) => void | Promise<void>
  ready: boolean
}

type EventPayload = {
  content?: unknown
  tags?: unknown
}

function parseRelayMessage(data: string): unknown[] | null {
  try {
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function hasTopicTag(payload: EventPayload, topic: string) {
  if (!Array.isArray(payload.tags)) return false
  return payload.tags.some((tag) => (
    Array.isArray(tag) && tag[0] === 'x' && tag[1] === topic
  ))
}

function stringifyMessage(message: unknown) {
  return typeof message === 'string' ? message : JSON.stringify(message)
}

function parseMessagePayload(message: unknown): Record<string, unknown> | null {
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null
    } catch {
      return null
    }
  }

  return message && typeof message === 'object' && !Array.isArray(message)
    ? message as Record<string, unknown>
    : null
}

function classifyTrysteroMessage(
  message: unknown,
  noSignalKind: 'announcement' | 'nudge',
): PocTrysteroMessageKind {
  const payload = parseMessagePayload(message)
  if (!payload) return 'unknown'

  if (typeof payload.offer === 'string' && payload.offer) return 'offer'
  if (typeof payload.answer === 'string' && payload.answer) return 'answer'
  if (typeof payload.candidate === 'string' && payload.candidate) return 'candidate'
  if (typeof payload.peerId === 'string' && payload.peerId) return noSignalKind
  return 'unknown'
}

export function createPocNostrEoseModule({
  core,
  nostr,
  observe,
}: {
  core: PocNostrCoreModule
  nostr: PocNostrModule
  observe?: (observation: PocNostrAdapterObservation) => void
}) {
  const relayManager = core.createRelayManager((client) => client.socket)
  const subscriptions = new Map<SocketClientLike, Map<string, SubscriptionRecord>>()
  const rootReadyListeners = new Set<(event: PocNostrRootReadyEvent) => void>()

  const observeStage = (
    stage: PocNostrAdapterObservation['stage'],
    relayUrl: string,
    messageKind?: PocTrysteroMessageKind,
  ) => observe?.({
    stage,
    relayUrl,
    ...(messageKind ? { messageKind } : {}),
  })

  const recordsFor = (client: SocketClientLike) => {
    let records = subscriptions.get(client)
    if (!records) {
      records = new Map()
      subscriptions.set(client, records)
    }
    return records
  }

  const sendSubscription = (client: SocketClientLike, record: SubscriptionRecord) => {
    record.ready = false
    client.send(nostr.subscribe(record.subscriptionId, record.topic))
    if (record.kind === ROOT_KIND) {
      observeStage('root-subscription-sent', client.url)
    }
  }

  const markRootReady = (client: SocketClientLike, record: SubscriptionRecord) => {
    if (record.ready || record.kind !== ROOT_KIND) return
    record.ready = true
    const event = { relayUrl: client.url, socket: client.socket }
    observeStage('root-subscription-ready', client.url)
    rootReadyListeners.forEach((listener) => listener(event))
  }

  const handleRelayMessage = (client: SocketClientLike, data: string) => {
    const parsed = parseRelayMessage(data)
    if (!parsed || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string') return

    const [messageType, subscriptionId, payload] = parsed
    const record = subscriptions.get(client)?.get(subscriptionId)
    if (!record) return

    if (messageType === EOSE) {
      markRootReady(client, record)
      return
    }

    if (messageType === CLOSED) {
      if (record.kind === ROOT_KIND) {
        record.ready = false
        observeStage('root-subscription-closed', client.url)
      }
      return
    }

    if (messageType !== EVENT || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return
    }

    const event = payload as EventPayload
    if (typeof event.content !== 'string' || !hasTopicTag(event, record.topic)) return

    observeStage(
      'trystero-message-received',
      client.url,
      classifyTrysteroMessage(
        event.content,
        record.kind === ROOT_KIND ? 'announcement' : 'nudge',
      ),
    )
    void record.onMessage(record.topic, event.content)
  }

  const resubscribe = (client: SocketClientLike) => {
    observeStage('relay-reconnected', client.url)
    subscriptions.get(client)?.forEach((record) => sendSubscription(client, record))
  }

  const adapter: TopicAdapter = {
    init: (config) => core.getRelays(
      config,
      nostr.defaultRelayUrls,
      DEFAULT_REDUNDANCY,
      true,
    ).map((url) => {
      const client = relayManager.register(url, () => core.makeSocket(
        url,
        (data) => handleRelayMessage(client, data),
        () => resubscribe(client),
      ))

      return client.ready.then((readyClient) => {
        observeStage('relay-open', readyClient.url)
        return readyClient
      })
    }),

    subscribeTopic: (client, topic, onMessage, context) => {
      const subscriptionId = core.genId(64)
      const record: SubscriptionRecord = {
        subscriptionId,
        topic,
        kind: context.kind,
        onMessage,
        ready: false,
      }
      recordsFor(client).set(subscriptionId, record)
      sendSubscription(client, record)

      return () => {
        const records = subscriptions.get(client)
        records?.delete(subscriptionId)
        if (records?.size === 0) subscriptions.delete(client)
        client.send(JSON.stringify(['CLOSE', subscriptionId]))
      }
    },

    publishTopic: async (client, topic, message, context) => {
      if (client.isClosed) {
        return context.kind === ANNOUNCE_KIND
          ? { nextAnnounceMs: STEADY_ANNOUNCE_INTERVAL_MS }
          : undefined
      }

      const event = await nostr.createEvent(topic, stringifyMessage(message))
      const didSend = client.socket.readyState === OPEN
      client.send(event)

      if (didSend) {
        observeStage(
          'trystero-message-published',
          client.url,
          context.kind === ANNOUNCE_KIND
            ? 'announcement'
            : classifyTrysteroMessage(message, 'nudge'),
        )
      }

      return context.kind === ANNOUNCE_KIND
        ? { nextAnnounceMs: STEADY_ANNOUNCE_INTERVAL_MS }
        : undefined
    },
  }

  const joinRoom = core.createTopicStrategy(adapter)

  return {
    joinRoom,
    selfId: core.selfId,
    getRelaySockets: relayManager.getSockets,
    createEvent: nostr.createEvent,
    subscribe: nostr.subscribe,
    onRootSubscriptionReady(listener: (event: PocNostrRootReadyEvent) => void) {
      rootReadyListeners.add(listener)

      subscriptions.forEach((records, client) => {
        records.forEach((record) => {
          if (record.kind === ROOT_KIND && record.ready) {
            listener({ relayUrl: client.url, socket: client.socket })
          }
        })
      })

      return () => rootReadyListeners.delete(listener)
    },
  }
}
