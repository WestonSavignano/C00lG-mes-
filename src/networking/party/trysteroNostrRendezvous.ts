const EVENT = 'EVENT'
const EOSE = 'EOSE'
const CLOSED = 'CLOSED'
const ROOT_KIND = 'root'
const ANNOUNCE_KIND = 'announce'
const OPEN = 1
const DEFAULT_REDUNDANCY = 5
const STEADY_ANNOUNCE_INTERVAL_MS = 60_000
const WAKE_PAYLOAD = JSON.stringify({ type: 'wake', version: 1 })
const MAX_SEEN_WAKE_IDS = 64
const HOST_WAKE_COOLDOWN_MS = 1_500
const encoder = new TextEncoder()

type SocketLike = {
  readonly readyState: number
  send(data: string): void
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
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

export type TrysteroNostrCoreModule = {
  createRelayManager(getSocket: (client: SocketClientLike) => SocketLike): RelayManagerLike
  createTopicStrategy(adapter: TopicAdapter): unknown
  getRelays(
    config: unknown,
    defaults: string[],
    redundancy: number,
    deriveFromAppId: boolean,
  ): string[]
  makeSocket(
    url: string,
    onMessage: (data: string) => void,
    onReconnect: () => void,
  ): SocketClientLike
  genId(length: number): string
  selfId: string
}

export type TrysteroNostrPrimitives = {
  createEvent(topic: string, content: string): Promise<string>
  subscribe(subscriptionId: string, topic: string): string
  defaultRelayUrls: string[]
}

export type RootReadyEvent = {
  relayUrl: string
  socket: SocketLike
}

export type EventDrivenNostrModule = {
  joinRoom: unknown
  selfId: string
  getRelaySockets(): Record<string, SocketLike>
  createEvent(topic: string, content: string): Promise<string>
  subscribe(subscriptionId: string, topic: string): string
  onRootSubscriptionReady(listener: (event: RootReadyEvent) => void): () => void
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

export type RendezvousDiagnostic = {
  stage:
    | 'host-rendezvous-ready'
    | 'guest-rendezvous-ready'
    | 'guest-wake-sent'
    | 'host-wake-received'
    | 'host-reannounce-sent'
  relayUrl?: string
  readyRelayCount?: number
  openRelayCount?: number
  relayCount?: number
  wakeIndex?: number
  attemptedRelayCount?: number
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
  return Array.isArray(payload.tags) && payload.tags.some((tag) => (
    Array.isArray(tag) && tag[0] === 'x' && tag[1] === topic
  ))
}

function stringifyMessage(message: unknown) {
  return typeof message === 'string' ? message : JSON.stringify(message)
}

export function createEventDrivenNostrModule({
  core,
  nostr,
}: {
  core: TrysteroNostrCoreModule
  nostr: TrysteroNostrPrimitives
}): EventDrivenNostrModule {
  const relayManager = core.createRelayManager((client) => client.socket)
  const subscriptions = new Map<SocketClientLike, Map<string, SubscriptionRecord>>()
  const rootReadyListeners = new Set<(event: RootReadyEvent) => void>()

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
  }

  const markRootReady = (client: SocketClientLike, record: SubscriptionRecord) => {
    if (record.ready || record.kind !== ROOT_KIND) return
    record.ready = true
    const event = { relayUrl: client.url, socket: client.socket }
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
      if (record.kind === ROOT_KIND) record.ready = false
      return
    }

    if (messageType !== EVENT || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return
    }

    const event = payload as EventPayload
    if (typeof event.content !== 'string' || !hasTopicTag(event, record.topic)) return
    void record.onMessage(record.topic, event.content)
  }

  const resubscribe = (client: SocketClientLike) => {
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
      return client.ready
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

      client.send(await nostr.createEvent(topic, stringifyMessage(message)))
      return context.kind === ANNOUNCE_KIND
        ? { nextAnnounceMs: STEADY_ANNOUNCE_INTERVAL_MS }
        : undefined
    },
  }

  return {
    joinRoom: core.createTopicStrategy(adapter),
    selfId: core.selfId,
    getRelaySockets: relayManager.getSockets,
    createEvent: nostr.createEvent,
    subscribe: nostr.subscribe,
    onRootSubscriptionReady(listener) {
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

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function digest(algorithm: 'SHA-1' | 'SHA-256', value: string) {
  return new Uint8Array(await crypto.subtle.digest(algorithm, encoder.encode(value)))
}

export async function deriveTrysteroRootTopic(appId: string, roomId: string) {
  const bytes = await digest('SHA-1', `Trystero@${appId}@${roomId}`)
  return Array.from(bytes, (byte) => byte.toString(36)).join('')
}

async function deriveWakeTopic(appId: string, roomId: string, rendezvousCapability: string) {
  return toHex(await digest(
    'SHA-256',
    `CoolGamesPlusWake@${appId}@${roomId}@${rendezvousCapability}`,
  ))
}

function canonicalRelayUrl(relayUrl: string) {
  try {
    const url = new URL(relayUrl)
    if (url.pathname === '/' && !url.search && !url.hash) {
      return `${url.protocol}//${url.host}`
    }
    return url.toString().replace(/\/$/u, '')
  } catch {
    return relayUrl.replace(/\/$/u, '')
  }
}

function countOpenRelays(sockets: Record<string, SocketLike>) {
  return Object.values(sockets).filter((socket) => socket.readyState === OPEN).length
}

function parseWakeEvent(data: unknown, subscriptionId: string, wakeTopic: string) {
  if (typeof data !== 'string') return null
  const parsed = parseRelayMessage(data)
  if (!parsed || parsed.length < 3 || parsed[0] !== EVENT || parsed[1] !== subscriptionId) {
    return null
  }

  const event = parsed[2]
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null
  const candidate = event as { id?: unknown; content?: unknown; tags?: unknown }
  if (typeof candidate.id !== 'string' || !candidate.id) return null
  if (candidate.content !== WAKE_PAYLOAD || !Array.isArray(candidate.tags)) return null
  return candidate.tags.some((tag) => (
    Array.isArray(tag) && tag[0] === 'x' && tag[1] === wakeTopic
  )) ? candidate.id : null
}

function isSubscriptionMessage(data: unknown, type: string, subscriptionId: string) {
  if (typeof data !== 'string') return false
  const parsed = parseRelayMessage(data)
  return !!parsed && parsed[0] === type && parsed[1] === subscriptionId
}

export async function startEventDrivenRendezvous({
  role,
  appId,
  roomId,
  rendezvousCapability,
  module,
  log,
  now = () => Date.now(),
}: {
  role: 'host' | 'guest'
  appId: string
  roomId: string
  rendezvousCapability: string
  module: Pick<
    EventDrivenNostrModule,
    | 'selfId'
    | 'getRelaySockets'
    | 'createEvent'
    | 'subscribe'
    | 'onRootSubscriptionReady'
  >
  log: (diagnostic: RendezvousDiagnostic) => void
  now?: () => number
}) {
  const currentSockets = () => module.getRelaySockets()
  const wakeTopic = await deriveWakeTopic(appId, roomId, rendezvousCapability)
  const readyRootRelays = new Set<string>()
  const cleanups: Array<() => void> = []
  let stopped = false

  if (role === 'guest') {
    const wakeEvent = await module.createEvent(wakeTopic, WAKE_PAYLOAD)
    const sentSockets = new WeakSet<SocketLike>()
    let wakeIndex = 0
    let didLogReady = false

    const stopRootReady = module.onRootSubscriptionReady(({ relayUrl, socket }) => {
      if (stopped) return
      const canonical = canonicalRelayUrl(relayUrl)
      readyRootRelays.add(canonical)
      const sockets = currentSockets()
      if (!didLogReady) {
        didLogReady = true
        log({
          stage: 'guest-rendezvous-ready',
          relayUrl: canonical,
          readyRelayCount: readyRootRelays.size,
          openRelayCount: countOpenRelays(sockets),
          relayCount: Object.keys(sockets).length,
        })
      }
      if (socket.readyState !== OPEN || sentSockets.has(socket)) return
      sentSockets.add(socket)
      socket.send(wakeEvent)
      wakeIndex += 1
      log({
        stage: 'guest-wake-sent',
        relayUrl: canonical,
        wakeIndex,
        readyRelayCount: readyRootRelays.size,
      })
    })

    return {
      stop() {
        stopped = true
        stopRootReady()
      },
    }
  }

  const rootTopic = await deriveTrysteroRootTopic(appId, roomId)
  const subscriptionId = crypto.randomUUID()
  const subscription = module.subscribe(subscriptionId, wakeTopic)
  const readyWakeRelays = new Set<string>()
  const seenWakeIds = new Set<string>()
  const subscribedSockets = new WeakSet<SocketLike>()
  let didLogReady = false
  let lastWakeAt = Number.NEGATIVE_INFINITY

  const maybeLogReady = (relayUrl: string) => {
    if (didLogReady || !readyRootRelays.has(relayUrl) || !readyWakeRelays.has(relayUrl)) return
    didLogReady = true
    const sockets = currentSockets()
    log({
      stage: 'host-rendezvous-ready',
      relayUrl,
      readyRelayCount: [...readyRootRelays].filter((url) => readyWakeRelays.has(url)).length,
      openRelayCount: countOpenRelays(sockets),
      relayCount: Object.keys(sockets).length,
    })
  }

  const rememberWake = (eventId: string) => {
    seenWakeIds.add(eventId)
    if (seenWakeIds.size <= MAX_SEEN_WAKE_IDS) return
    const oldest = seenWakeIds.values().next().value
    if (typeof oldest === 'string') seenWakeIds.delete(oldest)
  }

  const reannounce = async () => {
    const announcement = await module.createEvent(rootTopic, JSON.stringify({ peerId: module.selfId }))
    if (stopped) return
    const sockets = currentSockets()
    const attemptedRelayCount = Object.keys(sockets).length
    let openRelayCount = 0
    for (const socket of Object.values(sockets)) {
      if (socket.readyState !== OPEN) continue
      socket.send(announcement)
      openRelayCount += 1
    }
    log({ stage: 'host-reannounce-sent', openRelayCount, attemptedRelayCount })
  }

  const installWakeSubscription = (relayUrl: string, socket: SocketLike) => {
    if (stopped || socket.readyState !== OPEN || subscribedSockets.has(socket)) return
    const canonical = canonicalRelayUrl(relayUrl)
    subscribedSockets.add(socket)
    readyWakeRelays.delete(canonical)

    const onMessage: EventListener = (event) => {
      if (stopped) return
      const data = (event as MessageEvent<unknown>).data
      if (isSubscriptionMessage(data, EOSE, subscriptionId)) {
        readyWakeRelays.add(canonical)
        maybeLogReady(canonical)
        return
      }
      if (isSubscriptionMessage(data, CLOSED, subscriptionId)) {
        readyWakeRelays.delete(canonical)
        return
      }

      const eventId = parseWakeEvent(data, subscriptionId, wakeTopic)
      if (!eventId || seenWakeIds.has(eventId)) return
      rememberWake(eventId)
      const current = now()
      if (current - lastWakeAt < HOST_WAKE_COOLDOWN_MS) return
      lastWakeAt = current
      log({
        stage: 'host-wake-received',
        relayUrl: canonical,
        openRelayCount: countOpenRelays(currentSockets()),
      })
      void reannounce()
    }

    socket.addEventListener('message', onMessage)
    cleanups.push(() => socket.removeEventListener('message', onMessage))
    socket.send(subscription)
  }

  const stopRootReady = module.onRootSubscriptionReady(({ relayUrl, socket }) => {
    if (stopped) return
    const canonical = canonicalRelayUrl(relayUrl)
    readyRootRelays.add(canonical)
    installWakeSubscription(canonical, socket)
    maybeLogReady(canonical)
  })
  cleanups.push(stopRootReady)

  return {
    stop() {
      if (stopped) return
      stopped = true
      for (const cleanup of cleanups) cleanup()
      const close = JSON.stringify(['CLOSE', subscriptionId])
      for (const socket of Object.values(currentSockets())) {
        if (socket.readyState === OPEN) socket.send(close)
      }
    },
  }
}
