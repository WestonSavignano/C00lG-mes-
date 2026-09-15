import {
  createEventDrivenNostrModule,
  deriveTrysteroRootTopic,
  startEventDrivenRendezvous,
  type EventDrivenNostrModule,
  type RendezvousDiagnostic,
  type TrysteroNostrCoreModule,
  type TrysteroNostrPrimitives,
} from './trysteroNostrRendezvous'

export { deriveTrysteroRootTopic }

const APP_ID = 'coolgamesplus-party-v2'
const ACTION_NAMESPACE = 'party-v2'
const sharedPoisonRegistry = new Set<string>()

const PRODUCTION_NOSTR_RELAY_URLS = [
  'wss://relay02.lnfi.network',
  'wss://nostr.data.haus',
  'wss://relay-can.zombi.cloudrodion.com',
  'wss://yabu.me/v2',
]

export type TrysteroHandshakeSend = (data: string) => Promise<void>
export type TrysteroHandshakeReceive = () => Promise<{ data: unknown; metadata?: unknown }>
export type PartyDiagnosticSource = 'start-host' | 'restore-host' | 'join-invite' | 'restore-guest'

type RelaySocketLike = {
  readyState: number
  send?: (data: string) => void
  addEventListener?: (type: string, listener: EventListener) => void
  removeEventListener?: (type: string, listener: EventListener) => void
}

export type TrysteroRoomLike = {
  makeAction: (namespace: string) => {
    send: (data: string, options?: { target?: string | string[] | null }) => Promise<void>
    onMessage: ((data: string, context: { peerId: string }) => void | Promise<void>) | null
  }
  leave: () => Promise<void>
  isPassive: () => boolean
  getPeers: () => Record<string, RTCPeerConnection>
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
}

export type TrysteroNostrModuleLike = {
  joinRoom: (
    config: {
      appId: string
      password: string
      passive: boolean
      trickleIce: boolean
      relayConfig?: {
        urls?: string[]
        redundancy?: number
        manualReconnection?: boolean
        warnOnRelayFailure?: boolean
      }
    },
    roomId: string,
    callbacks?: {
      onJoinError?: (details: { error: string; peerId: string }) => void
      onPeerHandshake?: (
        peerId: string,
        send: TrysteroHandshakeSend,
        receive: TrysteroHandshakeReceive,
        isInitiator: boolean,
      ) => Promise<void>
      handshakeTimeoutMs?: number
    },
  ) => TrysteroRoomLike
  selfId?: string
  getRelaySockets?: () => Record<string, RelaySocketLike>
  createEvent?: (topic: string, content: string) => Promise<string>
  subscribe?: (subscriptionId: string, topic: string) => string
  onRootSubscriptionReady?: (
    listener: (event: { relayUrl: string; socket: RelaySocketLike }) => void,
  ) => () => void
}

export type TrysteroNostrTransportOptions = {
  role: 'host' | 'guest'
  diagnosticSource?: PartyDiagnosticSource
  partyId: string
  rendezvousCapability: string
  onMessage?: (data: string, peerId: string) => void | Promise<void>
  onPeerJoin?: (peerId: string) => void
  onPeerLeave?: (peerId: string) => void
  onJoinError?: (details: { error: string; peerId: string }) => void
  onPeerHandshake?: (
    peerId: string,
    send: TrysteroHandshakeSend,
    receive: TrysteroHandshakeReceive,
    isInitiator: boolean,
  ) => Promise<void>
  loadModule?: () => Promise<TrysteroNostrModuleLike>
  poisonRegistry?: Set<string>
}

type PartyDiagnosticStage =
  | 'transport-started'
  | 'relay-health'
  | 'host-rendezvous-ready'
  | 'guest-rendezvous-ready'
  | 'guest-wake-sent'
  | 'host-wake-received'
  | 'host-reannounce-sent'
  | 'handshake-started'
  | 'handshake-accepted'
  | 'join-error'
  | 'peer-joined'
  | 'peer-left'
  | 'rtc-path'

type RelayStateCounts = {
  connecting: number
  open: number
  closing: number
  closed: number
  unknown: number
}

type CandidateType = 'host' | 'srflx' | 'prflx' | 'relay' | 'unknown'

type PartyDiagnostic = {
  stage: PartyDiagnosticStage
  role: 'host' | 'guest'
  source?: PartyDiagnosticSource
  elapsedMs?: number
  initiator?: boolean
  trickleIce?: boolean
  turnConfigured?: boolean
  relayCount?: number
  relayStates?: RelayStateCounts
  relayUrl?: string
  readyRelayCount?: number
  openRelayCount?: number
  wakeIndex?: number
  attemptedRelayCount?: number
  peerCount?: number
  localCandidateType?: CandidateType
  remoteCandidateType?: CandidateType
  roundTripTimeMs?: number | null
  usesTurn?: boolean
  reason?: 'sdp-connectivity-failed' | 'application-handshake-failed' | 'password-failed' | 'unknown'
  error?: string
}

function redactDiagnosticError(
  error: string,
  sensitiveValues: Array<string | null | undefined>,
) {
  let redacted = error.slice(0, 512)
  for (const sensitive of sensitiveValues) {
    if (sensitive) redacted = redacted.replaceAll(sensitive, '[redacted]')
  }
  return redacted
}

function classifyJoinError(error: string): NonNullable<PartyDiagnostic['reason']> {
  const normalized = error.toLowerCase()
  if (normalized.includes('could not connect to peer') && normalized.includes('sdp')) {
    return 'sdp-connectivity-failed'
  }
  if (normalized.includes('handshake')) {
    return 'application-handshake-failed'
  }
  if (normalized.includes('password')) {
    return 'password-failed'
  }
  return 'unknown'
}

function summarizeRelayStates(sockets: Record<string, RelaySocketLike>): RelayStateCounts {
  const counts: RelayStateCounts = {
    connecting: 0,
    open: 0,
    closing: 0,
    closed: 0,
    unknown: 0,
  }

  for (const socket of Object.values(sockets)) {
    switch (socket.readyState) {
      case 0: counts.connecting += 1; break
      case 1: counts.open += 1; break
      case 2: counts.closing += 1; break
      case 3: counts.closed += 1; break
      default: counts.unknown += 1
    }
  }

  return counts
}

function logPartyDiagnostic(diagnostic: PartyDiagnostic, warning = false) {
  if (warning) {
    console.warn('[party-network]', diagnostic)
    return
  }
  console.info('[party-network]', diagnostic)
}

function hasUnsafeClosedPeer(room: TrysteroRoomLike) {
  return Object.values(room.getPeers()).some((peer) =>
    peer.connectionState === 'closed'
    || peer.connectionState === 'failed'
    || peer.iceConnectionState === 'closed'
    || peer.iceConnectionState === 'failed')
}

function isEventDrivenModule(module: TrysteroNostrModuleLike): module is TrysteroNostrModuleLike & {
  selfId: string
  getRelaySockets: NonNullable<TrysteroNostrModuleLike['getRelaySockets']>
  createEvent: NonNullable<TrysteroNostrModuleLike['createEvent']>
  subscribe: NonNullable<TrysteroNostrModuleLike['subscribe']>
  onRootSubscriptionReady: NonNullable<TrysteroNostrModuleLike['onRootSubscriptionReady']>
} {
  if (
    typeof module.selfId !== 'string'
    || !module.selfId
    || typeof module.getRelaySockets !== 'function'
    || typeof module.createEvent !== 'function'
    || typeof module.subscribe !== 'function'
    || typeof module.onRootSubscriptionReady !== 'function'
  ) {
    return false
  }

  const sockets = module.getRelaySockets()
  return Object.values(sockets).every((socket) => (
    typeof socket.send === 'function'
    && typeof socket.addEventListener === 'function'
    && typeof socket.removeEventListener === 'function'
  ))
}

function controlledCandidateType(value: unknown): CandidateType {
  return value === 'host' || value === 'srflx' || value === 'prflx' || value === 'relay'
    ? value
    : 'unknown'
}

async function summarizeRtcPath(peer: RTCPeerConnection) {
  const report = await peer.getStats()
  const records = new Map<string, Record<string, unknown>>()
  report.forEach((record) => {
    const candidate = record as unknown as Record<string, unknown>
    if (typeof candidate.id === 'string') records.set(candidate.id, candidate)
  })

  const pair = [...records.values()].find((record) => (
    record.type === 'candidate-pair'
    && record.state === 'succeeded'
    && (record.selected === true || record.nominated === true)
  ))
  if (!pair) return null

  const local = typeof pair.localCandidateId === 'string'
    ? records.get(pair.localCandidateId)
    : undefined
  const remote = typeof pair.remoteCandidateId === 'string'
    ? records.get(pair.remoteCandidateId)
    : undefined
  const localCandidateType = controlledCandidateType(local?.candidateType)
  const remoteCandidateType = controlledCandidateType(remote?.candidateType)
  const rttSeconds = typeof pair.currentRoundTripTime === 'number'
    ? pair.currentRoundTripTime
    : null

  return {
    localCandidateType,
    remoteCandidateType,
    roundTripTimeMs: rttSeconds === null ? null : Math.round(rttSeconds * 1_000),
    usesTurn: localCandidateType === 'relay' || remoteCandidateType === 'relay',
  }
}

async function loadProductionModule(): Promise<TrysteroNostrModuleLike> {
  const [core, nostr] = await Promise.all([
    import('@trystero-p2p/core'),
    import('@trystero-p2p/nostr'),
  ])
  return createEventDrivenNostrModule({
    core: core as unknown as TrysteroNostrCoreModule,
    nostr: nostr as unknown as TrysteroNostrPrimitives,
  }) as unknown as TrysteroNostrModuleLike
}

export class TrysteroNostrTransport {
  private room: TrysteroRoomLike | null = null
  private action: ReturnType<TrysteroRoomLike['makeAction']> | null = null
  private startPromise: Promise<void> | null = null
  private disposePromise: Promise<{ requiresReload: boolean }> | null = null
  private rendezvousStop: (() => void) | null = null
  private disposed = false
  private startedAtMs = 0
  private lastRelayHealthKey: string | null = null
  private readonly options: TrysteroNostrTransportOptions
  private readonly poisonRegistry: Set<string>
  private readonly roomKey: string

  constructor(options: TrysteroNostrTransportOptions) {
    this.options = options
    this.poisonRegistry = options.poisonRegistry ?? sharedPoisonRegistry
    this.roomKey = `${APP_ID}:${options.partyId}`
  }

  private assertActive() {
    if (this.disposed) {
      throw new Error('Party transport is disposed and inactive')
    }
  }

  private elapsedMs() {
    return this.startedAtMs ? Math.max(0, Date.now() - this.startedAtMs) : 0
  }

  private logRelayHealth(module: TrysteroNostrModuleLike, force = false) {
    const sockets = module.getRelaySockets?.()
    if (!sockets) return
    const relayStates = summarizeRelayStates(sockets)
    const relayCount = Object.keys(sockets).length
    const healthKey = JSON.stringify({ relayCount, relayStates })
    if (!force && healthKey === this.lastRelayHealthKey) return
    this.lastRelayHealthKey = healthKey
    logPartyDiagnostic({
      stage: 'relay-health',
      role: this.options.role,
      source: this.options.diagnosticSource,
      elapsedMs: this.elapsedMs(),
      relayCount,
      relayStates,
    })
  }

  private logRendezvousDiagnostic(diagnostic: RendezvousDiagnostic) {
    logPartyDiagnostic({
      ...diagnostic,
      role: this.options.role,
      source: this.options.diagnosticSource,
      elapsedMs: this.elapsedMs(),
    })
  }

  private async logRtcPath(peerId: string) {
    const peer = this.room?.getPeers()[peerId]
    if (!peer || this.disposed) return
    try {
      const path = await summarizeRtcPath(peer)
      if (!path || this.disposed) return
      logPartyDiagnostic({
        stage: 'rtc-path',
        role: this.options.role,
        source: this.options.diagnosticSource,
        elapsedMs: this.elapsedMs(),
        ...path,
      })
    } catch {
      // RTC diagnostics must never affect the live party path.
    }
  }

  async start() {
    this.assertActive()
    if (this.room) {
      return
    }
    if (this.startPromise) {
      return this.startPromise
    }
    if (this.poisonRegistry.has(this.roomKey)) {
      throw new Error('The previous peer transport could not shut down safely; reload this page to reconnect')
    }

    this.startedAtMs = Date.now()
    this.lastRelayHealthKey = null
    this.startPromise = this.startGeneration()
    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  private async startGeneration() {
    const module = await (this.options.loadModule ?? loadProductionModule)()
    this.assertActive()

    const applicationHandshake = this.options.onPeerHandshake
      ? async (
          peerId: string,
          send: TrysteroHandshakeSend,
          receive: TrysteroHandshakeReceive,
          isInitiator: boolean,
        ) => {
          this.assertActive()
          logPartyDiagnostic({
            stage: 'handshake-started',
            role: this.options.role,
            source: this.options.diagnosticSource,
            elapsedMs: this.elapsedMs(),
            initiator: isInitiator,
          })
          const guardedSend: TrysteroHandshakeSend = async (data) => {
            this.assertActive()
            await send(data)
            this.assertActive()
          }
          const guardedReceive: TrysteroHandshakeReceive = async () => {
            this.assertActive()
            const received = await receive()
            this.assertActive()
            return received
          }
          await this.options.onPeerHandshake!(
            peerId,
            guardedSend,
            guardedReceive,
            isInitiator,
          )
          this.assertActive()
          logPartyDiagnostic({
            stage: 'handshake-accepted',
            role: this.options.role,
            source: this.options.diagnosticSource,
            elapsedMs: this.elapsedMs(),
            initiator: isInitiator,
          })
        }
      : undefined

    const room = module.joinRoom(
      {
        appId: APP_ID,
        password: this.options.rendezvousCapability,
        passive: this.options.role === 'guest',
        trickleIce: true,
        relayConfig: {
          urls: [...PRODUCTION_NOSTR_RELAY_URLS],
          manualReconnection: false,
          warnOnRelayFailure: true,
        },
      },
      this.options.partyId,
      {
        handshakeTimeoutMs: 15_000,
        onJoinError: (details) => {
          if (this.disposed) return
          logPartyDiagnostic({
            stage: 'join-error',
            role: this.options.role,
            source: this.options.diagnosticSource,
            elapsedMs: this.elapsedMs(),
            reason: classifyJoinError(details.error),
            error: redactDiagnosticError(details.error, [
              details.peerId,
              this.options.partyId,
              this.options.rendezvousCapability,
            ]),
          }, true)
          this.logRelayHealth(module, true)
          this.options.onJoinError?.(details)
        },
        onPeerHandshake: applicationHandshake,
      },
    )
    this.room = room
    logPartyDiagnostic({
      stage: 'transport-started',
      role: this.options.role,
      source: this.options.diagnosticSource,
      elapsedMs: this.elapsedMs(),
      trickleIce: true,
      turnConfigured: false,
      relayCount: PRODUCTION_NOSTR_RELAY_URLS.length,
    })
    this.logRelayHealth(module)

    if (isEventDrivenModule(module)) {
      const rendezvous = await startEventDrivenRendezvous({
        role: this.options.role,
        appId: APP_ID,
        roomId: this.options.partyId,
        rendezvousCapability: this.options.rendezvousCapability,
        module: module as unknown as EventDrivenNostrModule,
        log: (diagnostic) => this.logRendezvousDiagnostic(diagnostic),
      })
      if (this.disposed) {
        rendezvous.stop()
        return
      }
      this.rendezvousStop = () => rendezvous.stop()
    }

    const action = room.makeAction(ACTION_NAMESPACE)
    action.onMessage = async (data, context) => {
      if (this.disposed) return
      await this.options.onMessage?.(data, context.peerId)
    }
    room.onPeerJoin = (peerId) => {
      if (this.disposed) return
      logPartyDiagnostic({
        stage: 'peer-joined',
        role: this.options.role,
        source: this.options.diagnosticSource,
        elapsedMs: this.elapsedMs(),
        peerCount: Object.keys(room.getPeers()).length,
      })
      this.logRelayHealth(module)
      void this.logRtcPath(peerId)
      this.options.onPeerJoin?.(peerId)
    }
    room.onPeerLeave = (peerId) => {
      if (this.disposed) return
      logPartyDiagnostic({
        stage: 'peer-left',
        role: this.options.role,
        source: this.options.diagnosticSource,
        elapsedMs: this.elapsedMs(),
        peerCount: Object.keys(room.getPeers()).length,
      })
      this.options.onPeerLeave?.(peerId)
    }

    this.action = action
  }

  async send(data: string, target?: string | string[] | null) {
    this.assertActive()
    if (!this.action) {
      throw new Error('Party transport is not connected')
    }
    if (this.options.role === 'guest' && (typeof target !== 'string' || !target)) {
      throw new Error('Guest party traffic must target the authenticated host peer')
    }
    await this.action.send(data, { target })
    this.assertActive()
  }

  peerIds() {
    return this.disposed || !this.room ? [] : Object.keys(this.room.getPeers())
  }

  disconnectPeer(peerId: string) {
    if (this.disposed) return
    this.room?.getPeers()[peerId]?.close()
  }

  dispose() {
    if (!this.disposePromise) {
      this.disposed = true
      this.rendezvousStop?.()
      this.rendezvousStop = null
      this.disposePromise = this.disposeGeneration()
    }
    return this.disposePromise
  }

  private async disposeGeneration() {
    if (this.startPromise) {
      try {
        await this.startPromise
      } catch {
        // Failed startup still may have created a room generation. Inspect it below.
      }
    }

    const room = this.room
    const action = this.action
    this.room = null
    this.action = null

    if (!room) {
      return { requiresReload: false }
    }

    if (action) {
      action.onMessage = null
    }
    room.onPeerJoin = null
    room.onPeerLeave = null

    // Trystero 0.25.4 issue #195: room.leave() can reject while sending the
    // leave action over an already-closed data channel, before Trystero clears
    // its occupied-room registry. Public APIs do not expose a safe way to
    // repair that registry. Fail closed instead of reusing a stranded room.
    if (hasUnsafeClosedPeer(room)) {
      this.poisonRegistry.add(this.roomKey)
      return { requiresReload: true }
    }

    try {
      await room.leave()
      return { requiresReload: false }
    } catch {
      this.poisonRegistry.add(this.roomKey)
      return { requiresReload: true }
    }
  }
}
