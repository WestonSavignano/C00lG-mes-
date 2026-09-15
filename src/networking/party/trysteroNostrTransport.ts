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
}

export type TrysteroNostrTransportOptions = {
  role: 'host' | 'guest'
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
  | 'handshake-started'
  | 'handshake-accepted'
  | 'join-error'
  | 'peer-joined'

type PartyDiagnostic = {
  stage: PartyDiagnosticStage
  role: 'host' | 'guest'
  initiator?: boolean
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

async function loadProductionModule(): Promise<TrysteroNostrModuleLike> {
  return import('@trystero-p2p/nostr') as unknown as Promise<TrysteroNostrModuleLike>
}

export class TrysteroNostrTransport {
  private room: TrysteroRoomLike | null = null
  private action: ReturnType<TrysteroRoomLike['makeAction']> | null = null
  private startPromise: Promise<void> | null = null
  private disposePromise: Promise<{ requiresReload: boolean }> | null = null
  private disposed = false
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
            error: redactDiagnosticError(details.error, [
              details.peerId,
              this.options.partyId,
              this.options.rendezvousCapability,
            ]),
          }, true)
          this.options.onJoinError?.(details)
        },
        onPeerHandshake: applicationHandshake,
      },
    )
    this.room = room
    logPartyDiagnostic({
      stage: 'transport-started',
      role: this.options.role,
    })
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
      })
      this.options.onPeerJoin?.(peerId)
    }
    room.onPeerLeave = (peerId) => {
      if (!this.disposed) this.options.onPeerLeave?.(peerId)
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
