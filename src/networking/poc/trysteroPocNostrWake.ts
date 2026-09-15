const encoder = new TextEncoder()
const OPEN = 1
const CONNECTING = 0
const WAKE_PAYLOAD = JSON.stringify({ type: 'wake', version: 1 })
const MAX_SEEN_WAKE_IDS = 64
const MAX_WAKE_DIAGNOSTICS = 96

export const POC_NOSTR_WAKE_COOLDOWN_MS = 1_500

export type PocTrysteroObservedMessageKind =
  | 'announcement'
  | 'nudge'
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'unknown'

export type PocNostrAckReasonCategory =
  | 'rate-limited'
  | 'duplicate'
  | 'blocked'
  | 'auth-required'
  | 'restricted'
  | 'invalid'
  | 'pow'
  | 'other'

export type PocNostrWakeDiagnostic = {
  at: string
  stage:
    | 'relay-open'
    | 'relay-reconnected'
    | 'root-subscription-sent'
    | 'root-subscription-ready'
    | 'root-subscription-closed'
    | 'trystero-message-received'
    | 'trystero-message-published'
    | 'guest-wake-armed'
    | 'guest-wake-sent'
    | 'host-wake-listener-armed'
    | 'host-wake-subscription-sent'
    | 'host-wake-listener-ready'
    | 'host-wake-received'
    | 'host-announcement-sent'
    | 'host-announcement-ack'
  relayUrl?: string
  openRelayCount?: number
  messageKind?: PocTrysteroObservedMessageKind
  accepted?: boolean
  ackReasonCategory?: PocNostrAckReasonCategory
}

const wakeDiagnostics: PocNostrWakeDiagnostic[] = []

export function resetPocNostrWakeDiagnostics() {
  wakeDiagnostics.length = 0
}

export function recordPocNostrWakeDiagnostic(
  stage: PocNostrWakeDiagnostic['stage'],
  details: Pick<
    PocNostrWakeDiagnostic,
    | 'relayUrl'
    | 'openRelayCount'
    | 'messageKind'
    | 'accepted'
    | 'ackReasonCategory'
  > = {},
) {
  wakeDiagnostics.push({
    at: new Date().toISOString(),
    stage,
    ...(details.relayUrl ? { relayUrl: details.relayUrl } : {}),
    ...(details.openRelayCount === undefined
      ? {}
      : { openRelayCount: details.openRelayCount }),
    ...(details.messageKind ? { messageKind: details.messageKind } : {}),
    ...(details.accepted === undefined ? {} : { accepted: details.accepted }),
    ...(details.ackReasonCategory
      ? { ackReasonCategory: details.ackReasonCategory }
      : {}),
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

async function digest(algorithm: 'SHA-1' | 'SHA-256', value: string) {
  return new Uint8Array(await crypto.subtle.digest(algorithm, encoder.encode(value)))
}

export async function derivePocNostrRootTopic(appId: string, roomId: string) {
  const bytes = await digest('SHA-1', `Trystero@${appId}@${roomId}`)
  return Array.from(bytes, (byte) => byte.toString(36)).join('')
}

export async function derivePocNostrWakeTopic(
  appId: string,
  roomId: string,
  rendezvousSecret: string,
) {
  return toHex(await digest(
    'SHA-256',
    `CoolGamesPlusWake@${appId}@${roomId}@${rendezvousSecret}`,
  ))
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

function parsePublishedEventId(event: string) {
  try {
    const parsed = JSON.parse(event)
    if (!Array.isArray(parsed) || parsed[0] !== 'EVENT') return null
    const payload = parsed[1]
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    const id = (payload as { id?: unknown }).id
    return typeof id === 'string' && id ? id : null
  } catch {
    return null
  }
}

function categorizeAckReason(reason: unknown): PocNostrAckReasonCategory {
  if (typeof reason !== 'string') return 'other'
  const prefixes: PocNostrAckReasonCategory[] = [
    'rate-limited',
    'duplicate',
    'blocked',
    'auth-required',
    'restricted',
    'invalid',
    'pow',
  ]
  return prefixes.find((prefix) => reason.startsWith(`${prefix}:`)) ?? 'other'
}

function parseEventAck(data: unknown) {
  if (typeof data !== 'string') return null
  try {
    const parsed = JSON.parse(data)
    if (
      !Array.isArray(parsed)
      || parsed[0] !== 'OK'
      || typeof parsed[1] !== 'string'
      || typeof parsed[2] !== 'boolean'
    ) {
      return null
    }
    return {
      eventId: parsed[1],
      accepted: parsed[2],
      reasonCategory: parsed[2] ? undefined : categorizeAckReason(parsed[3]),
    }
  } catch {
    return null
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
  onWakeListenerReady,
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
  onWakeListenerReady?: (relayUrl: string) => void
}) {
  const [wakeTopic, rootTopic] = await Promise.all([
    derivePocNostrWakeTopic(appId, roomId, rendezvousSecret),
    derivePocNostrRootTopic(appId, roomId),
  ])
  const subscriptionId = createSubscriptionId()
  const subscription = subscribe(subscriptionId, wakeTopic)
  const seenEventIds = new Set<string>()
  const readyRelays = new Set<string>()
  const pendingAnnouncementAcks = new Map<string, string>()
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
    const announcementId = parsePublishedEventId(announcement)
    let openRelayCount = 0
    for (const [relayUrl, socket] of Object.entries(sockets)) {
      if (socket.readyState === OPEN) {
        socket.send(announcement)
        if (announcementId) pendingAnnouncementAcks.set(relayUrl, announcementId)
        openRelayCount += 1
      }
    }
    recordPocNostrWakeDiagnostic('host-announcement-sent', { openRelayCount })
    onAnnouncementSent?.(openRelayCount)
  }

  const onRelayMessage = (relayUrl: string, data: unknown) => {
    if (stopped) return

    const ack = parseEventAck(data)
    if (ack && pendingAnnouncementAcks.get(relayUrl) === ack.eventId) {
      pendingAnnouncementAcks.delete(relayUrl)
      recordPocNostrWakeDiagnostic('host-announcement-ack', {
        relayUrl,
        accepted: ack.accepted,
        ...(ack.reasonCategory ? { ackReasonCategory: ack.reasonCategory } : {}),
      })
      return
    }

    if (isSubscriptionMessage(data, 'EOSE', subscriptionId)) {
      if (!readyRelays.has(relayUrl)) {
        readyRelays.add(relayUrl)
        recordPocNostrWakeDiagnostic('host-wake-listener-ready', { relayUrl })
        onWakeListenerReady?.(relayUrl)
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
      pendingAnnouncementAcks.clear()
      for (const cleanup of cleanups) cleanup()
      const close = JSON.stringify(['CLOSE', subscriptionId])
      for (const socket of Object.values(sockets)) {
        if (socket.readyState === OPEN) socket.send(close)
      }
    },
  }
}
