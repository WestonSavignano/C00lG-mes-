const APP_ID = 'coolgamesplus-party-v2'
const ACTION_NAMESPACE = 'party-v2'
const sharedPoisonRegistry = new Set<string>()

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
  private disposed = false
  private readonly poisonRegistry: Set<string>
  private readonly roomKey: string

  constructor(private readonly options: TrysteroNostrTransportOptions) {
    this.poisonRegistry = options.poisonRegistry ?? sharedPoisonRegistry
    this.roomKey = `${APP_ID}:${options.partyId}`
  }

  async start() {
    if (this.room) {
      return
    }
    if (this.startPromise) {
      return this.startPromise
    }
    if (this.disposed) {
      throw new Error('This party transport generation has already been disposed')
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
    if (this.disposed) {
      throw new Error('Party transport was disposed before startup completed')
    }

    const room = module.joinRoom(
      {
        appId: APP_ID,
        password: this.options.rendezvousCapability,
        passive: this.options.role === 'guest',
        trickleIce: true,
        relayConfig: {
          redundancy: 5,
          manualReconnection: false,
          warnOnRelayFailure: true,
        },
      },
      this.options.partyId,
      {
        handshakeTimeoutMs: 15_000,
        onJoinError: this.options.onJoinError,
        onPeerHandshake: this.options.onPeerHandshake,
      },
    )
    const action = room.makeAction(ACTION_NAMESPACE)
    action.onMessage = async (data, context) => {
      await this.options.onMessage?.(data, context.peerId)
    }
    room.onPeerJoin = (peerId) => this.options.onPeerJoin?.(peerId)
    room.onPeerLeave = (peerId) => this.options.onPeerLeave?.(peerId)

    this.room = room
    this.action = action
  }

  async send(data: string, target?: string | string[] | null) {
    if (!this.action) {
      throw new Error('Party transport is not connected')
    }
    if (this.options.role === 'guest' && (typeof target !== 'string' || !target)) {
      throw new Error('Guest party traffic must target the authenticated host peer')
    }
    await this.action.send(data, { target })
  }

  peerIds() {
    return this.room ? Object.keys(this.room.getPeers()) : []
  }

  disconnectPeer(peerId: string) {
    this.room?.getPeers()[peerId]?.close()
  }

  async dispose() {
    if (this.startPromise) {
      try {
        await this.startPromise
      } catch {
        // A failed start has no trusted room generation to leave.
      }
    }

    this.disposed = true
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
