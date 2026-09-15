const encoder = new TextEncoder()
const OPEN = 1
const CONNECTING = 0
const WAKE_PAYLOAD = JSON.stringify({ type: 'wake', version: 1 })
const MAX_SEEN_WAKE_IDS = 64
const MAX_WAKE_DIAGNOSTICS = 64

export const POC_NOSTR_WAKE_COOLDOWN_MS = 1_500

export type PocNostrWakeDiagnostic = {
  at: string
  stage:
    | 'relay-open'
    | 'relay-reconnected'
    | 'root-subscription-sent'
    | 'root-subscription-ready'
    | 'root-subscription-closed'
    | 'guest-wake-armed'
    | 'guest-wake-sent'
    | 'host-wake-listener-armed'
    | 'host-wake-subscription-sent'
    | 'host-wake-listener-ready'
    | 'host-wake-received'
    | 'host-announcement-sent'
  relayUrl?: string
  openRelayCount?: number
}

const wakeDiagnostics: PocNostrWakeDiagnostic[] = []

export function resetPocNostrWakeDiagnostics() {
  wakeDiagnostics.length = 0
}

export function recordPocNostrWakeDiagnostic(
  stage: PocNostrWakeDiagnostic['stage'],
  details: Pick<PocNostrWakeDiagnostic, 'relayUrl' | 'openRelayCount'> = {},
) {
  wakeDiagnostics.push({
    at: new Date().toISOString(),
    stage,
    ...(details.relayUrl ? { relayUrl: details.relayUrl } : {}),
    ...(details.openRelayCount === undefined
      ? {}
      : { openRelayCount: details.openRelayCount }),
  })
  if (wakeDiagnostics.length > MAX_WAKE_DIAGNOSTICS) {
    wakeDiagnostics.splice(0, wakeDiagnostics.length - MAX_WAKE_DIAGNOSTICS)
  }
}

export function getPocNostrWakeDiagnostics() {
  return wakeDiagnostics.map((entry) => ({ ...entry }))
}

type SocketLike = {
  readonly readyState: number
  send(data: string): void
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

type RootReadyEvent = {
  relayUrl: string
  socket: SocketLike
}

type OnRootSubscriptionReady = (
  listener: (event: RootReadyEvent) => void,
) => () => void

type CreateEvent = (topic: string, content: string) => Promise<string>
type Subscribe = (subscriptionId: string, topic: string) => string

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hash(algorithm: 'SHA-1' | 'SHA-256', value: string) {
  const digest = await crypto.subtle.digest(algorithm, encoder.encode(value))
  return toHex(new Uint8Array(digest))
}

export function derivePocNostrRootTopic(appId: string, roomId: string) {
  return hash('SHA-1', `Trystero@${appId}@${roomId}`)
}

export function derivePocNostrWakeTopic(
  appId: string,
  roomId: string,
  rendezvousSecret: string,
) {
  return hash('SHA-256', `CoolGamesPlusWake@${appId}@${roomId}@${rendezvousSecret}`)
}

export async function startPocNostrGuestWake({
  appId,
  roomId,
  rendezvousSecret,
  createEvent,
  onRootSubscriptionReady,
}: {
  appId: string
  roomId: string
  rendezvousSecret: string
  createEvent: CreateEvent
  onRootSubscriptionReady: OnRootSubscriptionReady
}) {
  const wakeTopic = await derivePocNostrWakeTopic(appId, roomId, rendezvousSecret)
  const event = await createEvent(wakeTopic, WAKE_PAYLOAD)
  const sentSockets = new WeakSet<SocketLike>()

  recordPocNostrWakeDiagnostic('guest-wake-armed')

  const stopReady = onRootSubscriptionReady(({ relayUrl, socket }) => {
    if (socket.readyState !== OPEN || sentSockets.has(socket)) return
    sentSockets.add(socket)
    socket.send(event)
    recordPocNostrWakeDiagnostic('guest-wake-sent', { relayUrl })
  })

  return {
    stop() {
      stopReady()
    },
  }
}

function parseWakeEvent(data: unknown, subscriptionId: string, wakeTopic: string) {
  if (typeof data !== 'string') return null

  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }

  if (!Array.isArray(parsed) || parsed.length < 3) return null
  if (parsed[0] !== 'EVENT' || parsed[1] !== subscriptionId) return null

  const event = parsed[2]
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null
  const candidate = event as { id?: unknown; content?: unknown; tags?: unknown }
  if (typeof candidate.id !== 'string' || !candidate.id) return null
  if (candidate.content !== WAKE_PAYLOAD || !Array.isArray(candidate.tags)) return null

  const matchesTopic = candidate.tags.some((tag) =>
    Array.isArray(tag) && tag[0] === 'x' && tag[1] === wakeTopic)

  return matchesTopic ? candidate.id : null
}

function isSubscriptionMessage(data: unknown, type: string, subscriptionId: string) {
  if (typeof data !== 'string') return false
  try {
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) && parsed[0] === type && parsed[1] === subscriptionId
  } catch {
    return false
  }
}

export async function startPocNostrHostWakeListener({
  appId,
  roomId,
  rendezvousSecret,
  peerId,
  createEvent,
  subscribe,
  sockets,
  createSubscriptionId = () => crypto.randomUUID(),
  now = () => Date.now(),
  onWakeReceived,
  onAnnouncementSent,
}: {
  appId: string
  roomId: string
  rendezvousSecret: string
  peerId: string
  createEvent: CreateEvent
  subscribe: Subscribe
  sockets: Record<string, SocketLike>
  createSubscriptionId?: () => string
  now?: () => number
  onWakeReceived?: () => void
  onAnnouncementSent?: (openRelayCount: number) => void
}) {
  const [wakeTopic, rootTopic] = await Promise.all([
    derivePocNostrWakeTopic(appId, roomId, rendezvousSecret),
    derivePocNostrRootTopic(appId, roomId),
  ])
  const subscriptionId = createSubscriptionId()
  const subscription = subscribe(subscriptionId, wakeTopic)
  const seenEventIds = new Set<string>()
  const readyRelays = new Set<string>()
  let lastWakeAt = Number.NEGATIVE_INFINITY
  let stopped = false
  const cleanups: Array<() => void> = []

  const rememberEvent = (eventId: string) => {
    seenEventIds.add(eventId)
    if (seenEventIds.size <= MAX_SEEN_WAKE_IDS) return
    const oldest = seenEventIds.values().next().value
    if (typeof oldest === 'string') seenEventIds.delete(oldest)
  }

  const announceHost = async () => {
    const announcement = await createEvent(
      rootTopic,
      JSON.stringify({ peerId }),
    )
    if (stopped) return
    let openRelayCount = 0
    for (const socket of Object.values(sockets)) {
      if (socket.readyState === OPEN) {
        socket.send(announcement)
        openRelayCount += 1
      }
    }
    recordPocNostrWakeDiagnostic('host-announcement-sent', { openRelayCount })
    onAnnouncementSent?.(openRelayCount)
  }

  const onRelayMessage = (relayUrl: string, data: unknown) => {
    if (stopped) return

    if (isSubscriptionMessage(data, 'EOSE', subscriptionId)) {
      if (!readyRelays.has(relayUrl)) {
        readyRelays.add(relayUrl)
        recordPocNostrWakeDiagnostic('host-wake-listener-ready', { relayUrl })
      }
      return
    }

    if (isSubscriptionMessage(data, 'CLOSED', subscriptionId)) {
      readyRelays.delete(relayUrl)
      return
    }

    const eventId = parseWakeEvent(data, subscriptionId, wakeTopic)
    if (!eventId || seenEventIds.has(eventId)) return
    rememberEvent(eventId)

    const current = now()
    if (current - lastWakeAt < POC_NOSTR_WAKE_COOLDOWN_MS) return
    lastWakeAt = current
    recordPocNostrWakeDiagnostic('host-wake-received', { relayUrl })
    onWakeReceived?.()
    void announceHost()
  }

  const sendSubscription = (relayUrl: string, socket: SocketLike) => {
    if (stopped || socket.readyState !== OPEN) return
    socket.send(subscription)
    recordPocNostrWakeDiagnostic('host-wake-subscription-sent', { relayUrl })
  }

  for (const [relayUrl, socket] of Object.entries(sockets)) {
    const onMessage: EventListener = (event) => {
      onRelayMessage(relayUrl, (event as MessageEvent<unknown>).data)
    }
    socket.addEventListener('message', onMessage)
    cleanups.push(() => socket.removeEventListener('message', onMessage))

    if (socket.readyState === OPEN) {
      sendSubscription(relayUrl, socket)
      continue
    }

    if (socket.readyState === CONNECTING) {
      const onOpen: EventListener = () => {
        socket.removeEventListener('open', onOpen)
        sendSubscription(relayUrl, socket)
      }
      socket.addEventListener('open', onOpen)
      cleanups.push(() => socket.removeEventListener('open', onOpen))
    }
  }

  recordPocNostrWakeDiagnostic('host-wake-listener-armed')

  return {
    stop() {
      if (stopped) return
      stopped = true
      for (const cleanup of cleanups) cleanup()
      const close = JSON.stringify(['CLOSE', subscriptionId])
      for (const socket of Object.values(sockets)) {
        if (socket.readyState === OPEN) socket.send(close)
      }
    },
  }
}
