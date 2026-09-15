const encoder = new TextEncoder()
const OPEN = 1
const CONNECTING = 0
const WAKE_PAYLOAD = JSON.stringify({ type: 'wake', version: 1 })
const MAX_SEEN_WAKE_IDS = 64
const MAX_WAKE_DIAGNOSTICS = 32

export const POC_NOSTR_WAKE_COOLDOWN_MS = 1_500
export const POC_NOSTR_WAKE_SUBSCRIPTION_SETTLE_MS = 500

export type PocNostrWakeDiagnostic = {
  at: string
  stage:
    | 'guest-wake-sent'
    | 'host-wake-listener-armed'
    | 'host-wake-received'
    | 'host-announcement-sent'
  openRelayCount?: number
}

const wakeDiagnostics: PocNostrWakeDiagnostic[] = []

function resetWakeDiagnostics() {
  wakeDiagnostics.length = 0
}

function recordWakeDiagnostic(
  stage: PocNostrWakeDiagnostic['stage'],
  openRelayCount?: number,
) {
  wakeDiagnostics.push({
    at: new Date().toISOString(),
    stage,
    ...(openRelayCount === undefined ? {} : { openRelayCount }),
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

function scheduleOnceAfterSubscriptionSettle(
  socket: SocketLike,
  payload: string,
  onSent?: () => void,
) {
  const send = () => {
    if (socket.readyState !== OPEN) return
    socket.send(payload)
    recordWakeDiagnostic('guest-wake-sent')
    onSent?.()
  }

  const schedule = () => {
    setTimeout(send, POC_NOSTR_WAKE_SUBSCRIPTION_SETTLE_MS)
  }

  if (socket.readyState === OPEN) {
    schedule()
    return 'open' as const
  }

  if (socket.readyState !== CONNECTING) {
    return 'ignored' as const
  }

  const onOpen: EventListener = () => {
    socket.removeEventListener('open', onOpen)
    schedule()
  }
  socket.addEventListener('open', onOpen)
  return 'waiting' as const
}

export async function sendPocNostrGuestWake({
  appId,
  roomId,
  rendezvousSecret,
  createEvent,
  sockets,
  onWakeSent,
}: {
  appId: string
  roomId: string
  rendezvousSecret: string
  createEvent: CreateEvent
  sockets: Record<string, SocketLike>
  onWakeSent?: () => void
}) {
  resetWakeDiagnostics()
  const wakeTopic = await derivePocNostrWakeTopic(appId, roomId, rendezvousSecret)
  const event = await createEvent(wakeTopic, WAKE_PAYLOAD)
  let openRelays = 0
  let waitingForOpen = 0

  for (const socket of Object.values(sockets)) {
    const result = scheduleOnceAfterSubscriptionSettle(socket, event, onWakeSent)
    if (result === 'open') openRelays += 1
    if (result === 'waiting') waitingForOpen += 1
  }

  return {
    openRelays,
    waitingForOpen,
    settleMs: POC_NOSTR_WAKE_SUBSCRIPTION_SETTLE_MS,
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
  resetWakeDiagnostics()
  const [wakeTopic, rootTopic] = await Promise.all([
    derivePocNostrWakeTopic(appId, roomId, rendezvousSecret),
    derivePocNostrRootTopic(appId, roomId),
  ])
  const subscriptionId = createSubscriptionId()
  const subscription = subscribe(subscriptionId, wakeTopic)
  const seenEventIds = new Set<string>()
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
    recordWakeDiagnostic('host-announcement-sent', openRelayCount)
    onAnnouncementSent?.(openRelayCount)
  }

  const onWake = (data: unknown) => {
    if (stopped) return
    const eventId = parseWakeEvent(data, subscriptionId, wakeTopic)
    if (!eventId || seenEventIds.has(eventId)) return
    rememberEvent(eventId)

    const current = now()
    if (current - lastWakeAt < POC_NOSTR_WAKE_COOLDOWN_MS) return
    lastWakeAt = current
    recordWakeDiagnostic('host-wake-received')
    onWakeReceived?.()
    void announceHost()
  }

  for (const socket of Object.values(sockets)) {
    const onMessage: EventListener = (event) => {
      onWake((event as MessageEvent<unknown>).data)
    }
    socket.addEventListener('message', onMessage)
    cleanups.push(() => socket.removeEventListener('message', onMessage))

    if (socket.readyState === OPEN) {
      socket.send(subscription)
      continue
    }

    if (socket.readyState === CONNECTING) {
      const onOpen: EventListener = () => {
        socket.removeEventListener('open', onOpen)
        if (!stopped && socket.readyState === OPEN) socket.send(subscription)
      }
      socket.addEventListener('open', onOpen)
      cleanups.push(() => socket.removeEventListener('open', onOpen))
    }
  }

  recordWakeDiagnostic('host-wake-listener-armed')

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
