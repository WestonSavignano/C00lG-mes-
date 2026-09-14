import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import BackLink from '../components/BackLink'
import H1 from '../components/H1'
import P from '../components/P'
import Page from '../components/Page'
import { deriveCredentialVerifier } from '../networking/poc/authorityCrypto'
import {
  loadOrCreateGuestAuthority,
  saveGuestAuthority,
  type GuestAuthorityCredentials,
} from '../networking/poc/guestAuthorityStorage'
import {
  POC_AUTHORITY_VERSION,
  applySyncToGuestReplica,
  createGuestReplica,
  createInitialHostAuthorityState,
  parseAuthorityWireMessage,
  type AuthoritySyncResponse,
  type CanonicalAuthorityEvent,
  type CanonicalChatEvent,
  type GuestChatIntent,
  type GuestReplica,
  type HostAuthorityState,
} from '../networking/poc/hostAuthorityModel'
import {
  parseAuthorityServerMessage,
  type AuthorityServerMessage,
} from '../networking/poc/hostAuthorityProtocol'
import { HostAuthoritySession } from '../networking/poc/hostAuthoritySession'
import { IndexedDbHostAuthorityStore } from '../networking/poc/indexedDbHostAuthorityStore'
import {
  buildPartyUrl,
  buildTrysteroConfig,
  evaluateGuestAdmission,
  loadOrCreateIdentity,
  parsePartyHash,
  parsePocHandshake,
  validateRemoteHandshake,
  type PocHandshake,
} from '../networking/poc/trysteroPocModel'
import './TrysteroPocPage.css'

const TRYSTERO_VERSION = '0.25.4'
const TRYSTERO_MODULE_URL = `https://esm.run/trystero@${TRYSTERO_VERSION}`
const POC_PATH = '/networking-poc/host-authority'
const HOST_IDENTITY_KEY = 'c00lgames.poc.trystero.host'
const AUTHORITY_ACTION_ID = 'c00lgames-host-authority-v1'
const REFRESH_INTERVAL_MS = 1_500
const FORCE_SNAPSHOT_SEQUENCE = Number.MAX_SAFE_INTEGER

type JoinErrorDetails = {
  error: string
  appId: string
  roomId: string
  peerId: string
}

type HandshakePayload = { data: unknown }

type ActionContext = { peerId: string }

type TrysteroAction<T> = {
  send(data: T, options?: { target?: string | string[] }): Promise<void>
  onMessage: ((data: T, context: ActionContext) => void) | null
}

type TrysteroRoom = {
  ping(peerId: string): Promise<number>
  leave(): Promise<void>
  isPassive(): boolean
  getPeers(): Record<string, RTCPeerConnection>
  makeAction<T>(actionId: string): TrysteroAction<T>
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
}

type TrysteroModule = {
  joinRoom(
    config: ReturnType<typeof buildTrysteroConfig>,
    roomId: string,
    callbacks?: {
      onJoinError?: (details: JoinErrorDetails) => void
      onPeerHandshake?: (
        peerId: string,
        send: (data: PocHandshake) => Promise<void>,
        receive: () => Promise<HandshakePayload>,
        isInitiator: boolean,
      ) => Promise<void>
      handshakeTimeoutMs?: number
    },
  ): TrysteroRoom
  selfId: string
  getRelaySockets(): Record<string, WebSocket>
}

type PeerView = {
  peerId: string
  appIdentity: string | null
  connectionState: RTCPeerConnectionState
  iceConnectionState: RTCIceConnectionState
  pingMs: number | null
}

type EventLogEntry = { at: string; message: string }
type RuntimeState = 'idle' | 'loading' | 'discovering' | 'connected' | 'error'
type GuestAuthState = 'not-applicable' | 'pending' | 'accepted' | 'denied'

function guestIdentityKey(partyId: string) {
  return `c00lgames.poc.trystero.guest.${partyId}`
}

function short(value: string | null | undefined) {
  if (!value) return '—'
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
}

function createLogEntry(message: string): EventLogEntry {
  return { at: new Date().toISOString(), message }
}

async function loadTrystero(): Promise<TrysteroModule> {
  return import(/* @vite-ignore */ TRYSTERO_MODULE_URL) as Promise<TrysteroModule>
}

function publicHostState(state: HostAuthorityState | null, connectedMemberIds: string[]) {
  if (!state) return null
  return {
    partyId: state.partyId,
    incarnationId: state.incarnationId,
    hostAppIdentity: state.hostAppIdentity,
    locked: state.locked,
    canonicalSequence: state.canonicalSequence,
    retainedFromSequence: state.events[0]?.sequence ?? state.canonicalSequence + 1,
    retainedThroughSequence: state.events.at(-1)?.sequence ?? state.canonicalSequence,
    members: state.members.map((member) => ({
      memberId: member.memberId,
      label: member.label,
      removed: member.removed,
      lastClientSequence: member.lastClientSequence,
      connected: connectedMemberIds.includes(member.memberId),
    })),
    messageCount: state.events.filter((event) => event.type === 'chat.message').length,
  }
}

export function HostAuthorityPocPage() {
  const [hash, setHash] = useState(() => window.location.hash)
  const route = useMemo(() => parsePartyHash(hash), [hash])
  const [runtimeState, setRuntimeState] = useState<RuntimeState>('idle')
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [appIdentity, setAppIdentity] = useState<string | null>(null)
  const [transportIdentity, setTransportIdentity] = useState<string | null>(null)
  const [actualPassive, setActualPassive] = useState<boolean | null>(null)
  const [peers, setPeers] = useState<PeerView[]>([])
  const [relayCount, setRelayCount] = useState(0)
  const [logs, setLogs] = useState<EventLogEntry[]>([])
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [authorityState, setAuthorityState] = useState<HostAuthorityState | null>(null)
  const [guestReplica, setGuestReplica] = useState<GuestReplica | null>(null)
  const [guestAuthState, setGuestAuthState] = useState<GuestAuthState>('not-applicable')
  const [lastSyncMode, setLastSyncMode] = useState('none')
  const [lastRetainedFromSequence, setLastRetainedFromSequence] = useState<number | null>(null)
  const [connectedMemberIds, setConnectedMemberIds] = useState<string[]>([])
  const [chatDraft, setChatDraft] = useState('')
  const [guestCredentialView, setGuestCredentialView] = useState<{ credentialId: string; nextClientSequence: number } | null>(null)
  const [canReplayGuestIntent, setCanReplayGuestIntent] = useState(false)

  const roomRef = useRef<TrysteroRoom | null>(null)
  const actionRef = useRef<TrysteroAction<unknown> | null>(null)
  const trysteroRef = useRef<TrysteroModule | null>(null)
  const hostStoreRef = useRef<IndexedDbHostAuthorityStore | null>(null)
  const hostSessionRef = useRef<HostAuthoritySession | null>(null)
  const guestCredentialsRef = useRef<GuestAuthorityCredentials | null>(null)
  const guestReplicaRef = useRef<GuestReplica | null>(null)
  const hostPeerRef = useRef<string | null>(null)
  const lastGuestIntentRef = useRef<GuestChatIntent | null>(null)
  const peerAppIdentityRef = useRef(new Map<string, string>())
  const guestPeerByIdentityRef = useRef(new Map<string, string>())
  const peerPingRef = useRef(new Map<string, number>())

  const addLog = useCallback((message: string) => {
    setLogs((current) => [...current.slice(-99), createLogEntry(message)])
  }, [])

  const refreshConnectedMembers = useCallback(() => {
    const session = hostSessionRef.current
    if (!session) {
      setConnectedMemberIds([])
      return
    }
    setConnectedMemberIds(session.state.members
      .filter((member) => !member.removed && Boolean(session.transportForMember(member.memberId)))
      .map((member) => member.memberId))
  }, [])

  const requestGuestSync = useCallback(async (lastCanonicalSequence: number) => {
    const action = actionRef.current
    const peerId = hostPeerRef.current
    if (!action || !peerId) return
    await action.send({
      version: POC_AUTHORITY_VERSION,
      type: 'sync.request',
      lastCanonicalSequence,
    }, { target: peerId })
  }, [])

  const applyGuestSync = useCallback(async (
    memberId: string,
    sync: AuthoritySyncResponse,
  ) => {
    const credentials = guestCredentialsRef.current
    if (!credentials) return false

    let replica = guestReplicaRef.current
    if (!replica || replica.memberId !== memberId) {
      if (sync.mode !== 'snapshot' || !sync.snapshot) {
        addLog('guest has no trustworthy replica for a delta; requesting full snapshot')
        await requestGuestSync(FORCE_SNAPSHOT_SEQUENCE)
        return false
      }
      if (sync.snapshot.partyId !== credentials.partyId || sync.snapshot.hostAppIdentity !== credentials.hostAppIdentity) {
        throw new Error('Host snapshot does not match the pinned party/host identity')
      }
      replica = createGuestReplica({
        partyId: credentials.partyId,
        hostAppIdentity: credentials.hostAppIdentity,
        incarnationId: sync.snapshot.incarnationId,
        memberId,
      })
    }

    let nextReplica: GuestReplica
    try {
      nextReplica = applySyncToGuestReplica(replica, sync)
    } catch (error) {
      addLog(`guest replica could not apply ${sync.mode} sync; requesting snapshot`)
      await requestGuestSync(FORCE_SNAPSHOT_SEQUENCE)
      if (error instanceof Error) addLog(`sync apply detail: ${error.message}`)
      return false
    }

    const nextCredentials: GuestAuthorityCredentials = {
      ...credentials,
      memberId,
      lastCanonicalSequence: nextReplica.lastCanonicalSequence,
      nextClientSequence: sync.acceptedClientSequence + 1,
      cachedReplica: nextReplica,
    }
    saveGuestAuthority(localStorage, nextCredentials)
    guestCredentialsRef.current = nextCredentials
    setGuestCredentialView({
      credentialId: nextCredentials.credentialId,
      nextClientSequence: nextCredentials.nextClientSequence,
    })
    guestReplicaRef.current = nextReplica
    setGuestReplica(nextReplica)
    setLastSyncMode(sync.mode)
    setLastRetainedFromSequence(sync.retainedFromSequence)
    addLog(`guest converged through canonical sequence ${sync.sequence} via ${sync.mode}`)
    return true
  }, [addLog, requestGuestSync])

  const broadcastCanonicalEvent = useCallback(async (
    event: CanonicalAuthorityEvent,
    options: { extraTargets?: string[]; excludeTargets?: string[] } = {},
  ) => {
    const session = hostSessionRef.current
    const action = actionRef.current
    if (!session || !action) return
    const excluded = new Set(options.excludeTargets ?? [])
    const targets = [...new Set([
      ...session.authenticatedTransports(),
      ...(options.extraTargets ?? []),
    ])].filter((peerId) => !excluded.has(peerId))
    if (targets.length === 0) return
    const message: AuthorityServerMessage = {
      version: POC_AUTHORITY_VERSION,
      type: 'canonical.event',
      event,
    }
    await action.send(message, { target: targets })
  }, [])

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const guestInvite = useMemo(() => {
    if (route.kind !== 'party' || route.role !== 'host') return null
    return buildPartyUrl({
      origin: window.location.origin,
      pathname: POC_PATH,
      role: 'guest',
      partyId: route.partyId,
      secret: route.secret,
      hostId: route.hostId,
    }).toString()
  }, [route])

  const createParty = useCallback(async () => {
    setRuntimeError(null)
    try {
      const hostId = loadOrCreateIdentity(localStorage, HOST_IDENTITY_KEY)
      const partyId = crypto.randomUUID()
      const incarnationId = crypto.randomUUID()
      const secret = crypto.randomUUID()
      const store = new IndexedDbHostAuthorityStore()
      await store.save(createInitialHostAuthorityState({ partyId, incarnationId, hostAppIdentity: hostId }))
      store.close()
      const url = buildPartyUrl({
        origin: window.location.origin,
        pathname: POC_PATH,
        role: 'host',
        partyId,
        secret,
        hostId,
      })
      window.history.replaceState(null, '', `${url.pathname}${url.hash}`)
      setHash(url.hash)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Could not create durable test party.')
    }
  }, [])

  const copyText = useCallback(async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus(success)
    } catch {
      setCopyStatus('Clipboard unavailable — select and copy manually.')
    }
  }, [])

  useEffect(() => {
    if (route.kind !== 'party') return

    let disposed = false
    let refreshTimer: ReturnType<typeof setInterval> | null = null
    let room: TrysteroRoom | null = null
    let action: TrysteroAction<unknown> | null = null
    let hostStore: IndexedDbHostAuthorityStore | null = null
    let hostMessageQueue: Promise<void> = Promise.resolve()
    const peerAppIdentity = peerAppIdentityRef.current
    const guestPeerByIdentity = guestPeerByIdentityRef.current
    const peerPing = peerPingRef.current
    peerAppIdentity.clear()
    guestPeerByIdentity.clear()
    peerPing.clear()

    const refreshTransportDiagnostics = async () => {
      if (disposed || !room) return
      const currentPeers = room.getPeers()
      const views: PeerView[] = Object.entries(currentPeers).map(([peerId, peer]) => ({
        peerId,
        appIdentity: peerAppIdentity.get(peerId) ?? null,
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        pingMs: peerPing.get(peerId) ?? null,
      }))
      setPeers(views)
      setRuntimeState(views.length > 0 ? 'connected' : 'discovering')
      const module = trysteroRef.current
      setRelayCount(module ? Object.keys(module.getRelaySockets()).length : 0)
    }

    const denyPeer = async (peerId: string, reason: AuthorityServerMessage & { type: 'auth.denied' }) => {
      if (!action || !room) return
      await action.send(reason, { target: peerId }).catch(() => undefined)
      room.getPeers()[peerId]?.close()
    }

    const handleHostAuthorityMessage = async (raw: unknown, peerId: string) => {
      const session = hostSessionRef.current
      if (!session || !action || !room) return
      const message = parseAuthorityWireMessage(raw)
      if (!message) {
        addLog(`host rejected malformed authority payload from ${short(peerId)}`)
        return
      }

      if (message.type === 'auth.request') {
        const handshakeIdentity = peerAppIdentity.get(peerId)
        if (!handshakeIdentity || handshakeIdentity !== message.credentialId) {
          addLog(`host denied credential/handshake identity mismatch from ${short(peerId)}`)
          await denyPeer(peerId, { version: POC_AUTHORITY_VERSION, type: 'auth.denied', reason: 'identity-mismatch' })
          return
        }
        const credentialVerifier = await deriveCredentialVerifier(message.credentialSecret)
        const result = await session.authenticate({
          credentialId: message.credentialId,
          credentialVerifier,
        })
        if (!result.accepted) {
          addLog(`host authority denied ${short(message.credentialId)}: ${result.reason}`)
          await denyPeer(peerId, { version: POC_AUTHORITY_VERSION, type: 'auth.denied', reason: result.reason })
          return
        }

        const binding = session.bindTransport(result.member.memberId, peerId)
        if (binding.replacedPeerId) {
          room.getPeers()[binding.replacedPeerId]?.close()
          addLog(`canonical member ${short(result.member.memberId)} rebound to new transport ${short(peerId)}`)
        }
        refreshConnectedMembers()
        setAuthorityState(session.state)
        const sync = await session.synchronize(result.member.memberId, message.lastCanonicalSequence)
        setLastSyncMode(`host sent ${sync.mode}`)
        setLastRetainedFromSequence(sync.retainedFromSequence)
        const accepted: AuthorityServerMessage = {
          version: POC_AUTHORITY_VERSION,
          type: 'auth.accepted',
          memberId: result.member.memberId,
          label: result.member.label,
          sync,
        }
        await action.send(accepted, { target: peerId })
        addLog(`${result.resumed ? 'returning' : 'new'} canonical member accepted: ${short(result.member.memberId)} (${sync.mode})`)
        if (result.event) {
          await broadcastCanonicalEvent(result.event, { excludeTargets: [peerId] })
        }
        return
      }

      const memberId = session.memberForTransport(peerId)
      if (!memberId) {
        const rejected: AuthorityServerMessage = {
          version: POC_AUTHORITY_VERSION,
          type: 'intent.rejected',
          reason: 'not-authenticated',
          sync: null,
        }
        await action.send(rejected, { target: peerId })
        return
      }

      if (message.type === 'sync.request') {
        const member = session.state.members.find((candidate) => candidate.memberId === memberId)
        if (!member || member.removed) return
        const sync = await session.synchronize(memberId, message.lastCanonicalSequence)
        const accepted: AuthorityServerMessage = {
          version: POC_AUTHORITY_VERSION,
          type: 'auth.accepted',
          memberId,
          label: member.label,
          sync,
        }
        await action.send(accepted, { target: peerId })
        setLastSyncMode(`host sent ${sync.mode}`)
        setLastRetainedFromSequence(sync.retainedFromSequence)
        addLog(`host served ${sync.mode} recovery to ${short(memberId)} from seq ${message.lastCanonicalSequence}`)
        return
      }

      const result = await session.commitGuestChat(memberId, message)
      if (!result.accepted) {
        const sync = await session.synchronize(memberId, 0).catch(() => null)
        const rejected: AuthorityServerMessage = {
          version: POC_AUTHORITY_VERSION,
          type: 'intent.rejected',
          reason: result.reason,
          sync,
        }
        await action.send(rejected, { target: peerId })
        addLog(`host rejected guest intent from ${short(memberId)}: ${result.reason}`)
        return
      }
      setAuthorityState(session.state)
      await broadcastCanonicalEvent(result.event)
      addLog(`host durably committed guest chat seq ${result.event.sequence} from ${short(memberId)}`)
    }

    const handleGuestAuthorityMessage = async (raw: unknown, peerId: string) => {
      if (hostPeerRef.current && peerId !== hostPeerRef.current) {
        addLog(`guest ignored authority payload from unexpected peer ${short(peerId)}`)
        return
      }
      const message = parseAuthorityServerMessage(raw)
      if (!message) {
        addLog(`guest rejected malformed host authority payload from ${short(peerId)}`)
        return
      }
      if (message.type === 'auth.denied') {
        setGuestAuthState('denied')
        setRuntimeError(`Host authority denied this guest: ${message.reason}`)
        addLog(`guest authority denied: ${message.reason}`)
        return
      }
      if (message.type === 'auth.accepted') {
        const applied = await applyGuestSync(message.memberId, message.sync)
        if (applied) {
          setGuestAuthState('accepted')
          setRuntimeError(null)
        }
        return
      }
      const credentials = guestCredentialsRef.current
      const replica = guestReplicaRef.current
      if (message.type === 'intent.rejected') {
        addLog(`host rejected local intent: ${message.reason}`)
        if (message.sync && credentials?.memberId) {
          await applyGuestSync(credentials.memberId, message.sync)
        }
        return
      }
      if (!credentials?.memberId || !replica) {
        addLog('canonical event arrived without a trustworthy replica; requesting snapshot')
        await requestGuestSync(FORCE_SNAPSHOT_SEQUENCE)
        return
      }
      if (message.event.sequence <= replica.lastCanonicalSequence) {
        addLog(`guest ignored duplicate canonical event seq ${message.event.sequence}`)
        return
      }
      const syntheticSync: AuthoritySyncResponse = {
        version: POC_AUTHORITY_VERSION,
        type: 'sync.response',
        mode: 'delta',
        sequence: message.event.sequence,
        retainedFromSequence: message.event.sequence,
        acceptedClientSequence: Math.max(0, credentials.nextClientSequence - 1),
        events: [message.event],
        snapshot: null,
      }
      await applyGuestSync(credentials.memberId, syntheticSync)
    }

    const handlePeerJoin = (peerId: string) => {
      if (!room || peerPing.has(peerId)) return
      peerPing.set(peerId, -1)
      addLog(`WebRTC peer connected: ${short(peerId)}`)
      void room.ping(peerId).then((pingMs) => {
        if (disposed) return
        peerPing.set(peerId, Math.round(pingMs))
        void refreshTransportDiagnostics()
      }).catch(() => {
        peerPing.delete(peerId)
      })

      if (route.role === 'guest') {
        hostPeerRef.current = peerId
        setGuestAuthState('pending')
        const credentials = guestCredentialsRef.current
        if (credentials && action) {
          const requestedSequence = credentials.cachedReplica
            ? credentials.cachedReplica.lastCanonicalSequence
            : FORCE_SNAPSHOT_SEQUENCE
          void action.send({
            version: POC_AUTHORITY_VERSION,
            type: 'auth.request',
            credentialId: credentials.credentialId,
            credentialSecret: credentials.credentialSecret,
            lastCanonicalSequence: requestedSequence,
          }, { target: peerId }).then(() => {
            addLog(`guest sent durable credential + recovery cursor ${requestedSequence === FORCE_SNAPSHOT_SEQUENCE ? 'snapshot' : requestedSequence}`)
          }).catch((error) => {
            addLog(`guest auth send failed: ${error instanceof Error ? error.message : 'unknown error'}`)
          })
        }
      }
      void refreshTransportDiagnostics()
    }

    const run = async () => {
      setRuntimeState('loading')
      setRuntimeError(null)
      setLogs([])
      setPeers([])
      setRelayCount(0)
      setLastSyncMode('none')
      setLastRetainedFromSequence(null)
      setConnectedMemberIds([])
      setChatDraft('')
      setAuthorityState(null)
      setGuestReplica(null)
      guestReplicaRef.current = null
      guestCredentialsRef.current = null
      hostSessionRef.current = null
      hostPeerRef.current = null
      lastGuestIntentRef.current = null
      setGuestCredentialView(null)
      setCanReplayGuestIntent(false)
      setGuestAuthState(route.role === 'guest' ? 'pending' : 'not-applicable')

      let localIdentity: string
      try {
        localIdentity = route.role === 'host'
          ? loadOrCreateIdentity(localStorage, HOST_IDENTITY_KEY)
          : loadOrCreateIdentity(localStorage, guestIdentityKey(route.partyId))
      } catch (error) {
        throw new Error(`Local identity unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, { cause: error })
      }
      if (route.role === 'host' && localIdentity !== route.hostId) {
        throw new Error('This host link belongs to a different browser identity. Create a new durable test party here instead.')
      }
      setAppIdentity(localIdentity)
      addLog(`${route.role} application identity restored: ${short(localIdentity)}`)

      if (route.role === 'host') {
        hostStore = new IndexedDbHostAuthorityStore()
        hostStoreRef.current = hostStore
        const session = await HostAuthoritySession.restore(hostStore, route.partyId)
        if (session.state.hostAppIdentity !== localIdentity) {
          throw new Error('Durable host state is pinned to a different host identity')
        }
        hostSessionRef.current = session
        setAuthorityState(session.state)
        addLog(`host restored IndexedDB authority at canonical seq ${session.state.canonicalSequence}`)
      } else {
        const credentials = loadOrCreateGuestAuthority(
          localStorage,
          route.partyId,
          route.hostId,
          () => localIdentity,
          () => crypto.randomUUID(),
        )
        if (credentials.credentialId !== localIdentity) {
          throw new Error('Guest durable credential no longer matches its application identity')
        }
        guestCredentialsRef.current = credentials
        setGuestCredentialView({
          credentialId: credentials.credentialId,
          nextClientSequence: credentials.nextClientSequence,
        })
        const cached = credentials.cachedReplica
        if (cached
          && credentials.memberId
          && cached.memberId === credentials.memberId
          && cached.partyId === route.partyId
          && cached.hostAppIdentity === route.hostId) {
          guestReplicaRef.current = cached
          setGuestReplica(cached)
          addLog(`guest restored cached replica at canonical seq ${cached.lastCanonicalSequence}`)
        } else if (credentials.cachedReplica) {
          addLog('guest discarded cached replica whose identity pins did not match durable credentials')
        }
      }

      addLog(`loading Trystero ${TRYSTERO_VERSION} Nostr strategy`)
      const trystero = await loadTrystero()
      if (disposed) return
      trysteroRef.current = trystero
      setTransportIdentity(trystero.selfId)
      addLog(`Trystero transport identity: ${short(trystero.selfId)}`)

      const localHandshake: PocHandshake = {
        version: 1,
        partyId: route.partyId,
        role: route.role,
        appIdentity: localIdentity,
      }

      room = trystero.joinRoom(
        buildTrysteroConfig(route.role, route.secret),
        route.partyId,
        {
          handshakeTimeoutMs: 10_000,
          onJoinError: (details) => {
            if (disposed) return
            const message = `join error for ${short(details.peerId)}: ${details.error}`
            addLog(message)
            setRuntimeError(message)
          },
          onPeerHandshake: async (peerId, send, receive) => {
            const receivePromise = receive()
            await send(localHandshake)
            const payload = await receivePromise
            const remoteHandshake = parsePocHandshake(payload.data)
            if (!remoteHandshake) throw new Error('Remote peer sent an invalid application handshake')
            const validation = validateRemoteHandshake({
              localRole: route.role,
              partyId: route.partyId,
              expectedHostId: route.hostId,
              handshake: remoteHandshake,
            })
            if (!validation.ok) throw new Error(`Application handshake rejected: ${validation.reason}`)

            if (route.role === 'host') {
              const admission = evaluateGuestAdmission(new Set(guestPeerByIdentity.keys()), remoteHandshake.appIdentity)
              if (!admission.accepted) throw new Error(`Transport admission rejected: ${admission.reason}`)
              const previousPeer = guestPeerByIdentity.get(remoteHandshake.appIdentity)
              if (previousPeer && previousPeer !== peerId) {
                room?.getPeers()[previousPeer]?.close()
                peerAppIdentity.delete(previousPeer)
                peerPing.delete(previousPeer)
              }
              guestPeerByIdentity.set(remoteHandshake.appIdentity, peerId)
            }
            peerAppIdentity.set(peerId, remoteHandshake.appIdentity)
          },
        },
      )
      roomRef.current = room
      setActualPassive(room.isPassive())
      action = room.makeAction<unknown>(AUTHORITY_ACTION_ID)
      actionRef.current = action
      action.onMessage = (data, context) => {
        if (route.role === 'host') {
          hostMessageQueue = hostMessageQueue
          .then(() => handleHostAuthorityMessage(data, context.peerId))
          .catch((error) => {
            const message = error instanceof Error ? error.message : 'Host authority handler failed'
            addLog(`host authority error: ${message}`)
            setRuntimeError(message)
          })
        } else {
          void handleGuestAuthorityMessage(data, context.peerId).catch((error) => {
            const message = error instanceof Error ? error.message : 'Guest authority handler failed'
            addLog(`guest authority error: ${message}`)
            setRuntimeError(message)
          })
        }
      }
      setRuntimeState('discovering')
      addLog(`${route.role === 'host' ? 'active host' : 'passive guest'} joined public Nostr rendezvous; authority channel ready`)

      room.onPeerJoin = handlePeerJoin
      room.onPeerLeave = (peerId) => {
        const identity = peerAppIdentity.get(peerId)
        if (identity && guestPeerByIdentity.get(identity) === peerId) guestPeerByIdentity.delete(identity)
        peerAppIdentity.delete(peerId)
        peerPing.delete(peerId)
        if (route.role === 'host') {
          hostSessionRef.current?.unbindTransport(peerId)
          refreshConnectedMembers()
        } else if (hostPeerRef.current === peerId) {
          hostPeerRef.current = null
          setGuestAuthState('pending')
        }
        addLog(`WebRTC peer disconnected: ${short(peerId)}; durable application state retained`)
        void refreshTransportDiagnostics()
      }

      for (const peerId of Object.keys(room.getPeers())) handlePeerJoin(peerId)
      await refreshTransportDiagnostics()
      refreshTimer = setInterval(() => void refreshTransportDiagnostics(), REFRESH_INTERVAL_MS)
    }

    const onOnline = () => addLog('browser network status: online')
    const onOffline = () => addLog('browser network status: offline')
    const onVisibility = () => addLog(`document visibility: ${document.visibilityState}`)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisibility)

    void run().catch((error) => {
      if (disposed) return
      const message = error instanceof Error ? error.message : 'Host authority POC failed to start'
      setRuntimeError(message)
      setRuntimeState('error')
      addLog(`startup error: ${message}`)
    })

    return () => {
      disposed = true
      if (refreshTimer) clearInterval(refreshTimer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisibility)
      if (action) action.onMessage = null
      const leavingRoom = room
      roomRef.current = null
      actionRef.current = null
      trysteroRef.current = null
      hostSessionRef.current = null
      hostPeerRef.current = null
      if (leavingRoom) void leavingRoom.leave().catch(() => undefined)
      hostStore?.close()
      if (hostStoreRef.current === hostStore) hostStoreRef.current = null
    }
  }, [addLog, applyGuestSync, broadcastCanonicalEvent, refreshConnectedMembers, requestGuestSync, route])

  const commitHostMessage = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    const session = hostSessionRef.current
    if (!session || !chatDraft.trim()) return
    try {
      const result = await session.commitHostChat(chatDraft)
      if (!result.accepted) return
      setAuthorityState(session.state)
      setChatDraft('')
      await broadcastCanonicalEvent(result.event)
      addLog(`host durably committed canonical chat seq ${result.event.sequence}`)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Host commit failed')
    }
  }, [addLog, broadcastCanonicalEvent, chatDraft])

  const submitGuestIntent = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    const action = actionRef.current
    const peerId = hostPeerRef.current
    const credentials = guestCredentialsRef.current
    const text = chatDraft.trim()
    if (!action || !peerId || !credentials?.memberId || guestAuthState !== 'accepted' || !text) return

    const intent: GuestChatIntent = {
      version: POC_AUTHORITY_VERSION,
      type: 'chat.intent',
      clientSequence: credentials.nextClientSequence,
      text,
    }
    const nextCredentials = { ...credentials, nextClientSequence: credentials.nextClientSequence + 1 }
    try {
      saveGuestAuthority(localStorage, nextCredentials)
      guestCredentialsRef.current = nextCredentials
    setGuestCredentialView({
      credentialId: nextCredentials.credentialId,
      nextClientSequence: nextCredentials.nextClientSequence,
    })
      lastGuestIntentRef.current = intent
      setCanReplayGuestIntent(true)
      setChatDraft('')
      await action.send(intent, { target: peerId })
      addLog(`guest sent intent #${intent.clientSequence}; awaiting host canonicalization`)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Guest intent send failed')
    }
  }, [addLog, chatDraft, guestAuthState])

  const replayLastGuestIntent = useCallback(async () => {
    const action = actionRef.current
    const peerId = hostPeerRef.current
    const intent = lastGuestIntentRef.current
    if (!action || !peerId || !intent) return
    await action.send(intent, { target: peerId })
    addLog(`guest deliberately replayed intent #${intent.clientSequence}`)
  }, [addLog])

  const resetGuestReplicaAndResync = useCallback(async () => {
    const credentials = guestCredentialsRef.current
    const replica = guestReplicaRef.current
    if (!credentials?.memberId || !replica) return
    const stale = createGuestReplica({
      partyId: credentials.partyId,
      hostAppIdentity: credentials.hostAppIdentity,
      incarnationId: replica.incarnationId,
      memberId: credentials.memberId,
    })
    const nextCredentials = {
      ...credentials,
      lastCanonicalSequence: 0,
      cachedReplica: stale,
    }
    saveGuestAuthority(localStorage, nextCredentials)
    guestCredentialsRef.current = nextCredentials
    setGuestCredentialView({
      credentialId: nextCredentials.credentialId,
      nextClientSequence: nextCredentials.nextClientSequence,
    })
    guestReplicaRef.current = stale
    setGuestReplica(stale)
    addLog('guest deliberately reset its cached replica to canonical seq 0')
    await requestGuestSync(0)
  }, [addLog, requestGuestSync])

  const forceGuestSnapshot = useCallback(async () => {
    addLog('guest deliberately requested snapshot fallback')
    await requestGuestSync(FORCE_SNAPSHOT_SEQUENCE)
  }, [addLog, requestGuestSync])

  const toggleLock = useCallback(async () => {
    const session = hostSessionRef.current
    if (!session) return
    try {
      const result = await session.setLocked(!session.state.locked)
      setAuthorityState(session.state)
      if (result.event) {
        await broadcastCanonicalEvent(result.event)
        addLog(`host durably committed room lock=${result.event.locked} at seq ${result.event.sequence}`)
      }
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Lock update failed')
    }
  }, [addLog, broadcastCanonicalEvent])

  const removeHostMember = useCallback(async (memberId: string) => {
    const session = hostSessionRef.current
    const room = roomRef.current
    if (!session) return
    const removedPeerId = session.transportForMember(memberId)
    try {
      const result = await session.removeMember(memberId)
      setAuthorityState(session.state)
      refreshConnectedMembers()
      if (result.event) {
        await broadcastCanonicalEvent(result.event, {
          extraTargets: removedPeerId ? [removedPeerId] : [],
        })
        addLog(`host durably removed ${short(memberId)} at seq ${result.event.sequence}`)
      }
      if (removedPeerId) room?.getPeers()[removedPeerId]?.close()
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Member removal failed')
    }
  }, [addLog, broadcastCanonicalEvent, refreshConnectedMembers])

  const messages: CanonicalChatEvent[] = route.kind === 'party' && route.role === 'host'
    ? authorityState?.events.filter((event): event is CanonicalChatEvent => event.type === 'chat.message') ?? []
    : guestReplica?.messages ?? []

  const hostView = publicHostState(authorityState, connectedMemberIds)
  const canonicalSequence = route.kind !== 'party'
    ? 0
    : route.role === 'host'
      ? authorityState?.canonicalSequence ?? 0
      : guestReplica?.lastCanonicalSequence ?? 0
  const retainedFromSequence = route.kind === 'party' && route.role === 'host'
    ? authorityState?.events[0]?.sequence ?? (authorityState ? authorityState.canonicalSequence + 1 : null)
    : lastRetainedFromSequence

  const diagnostics = {
    capturedAt: new Date().toISOString(),
    poc: {
      issue: 19,
      trysteroVersion: TRYSTERO_VERSION,
      strategy: 'nostr',
      turnConfigured: false,
      applicationStateBackend: 'none',
      hostPersistence: 'IndexedDB',
      guestPersistence: 'localStorage',
    },
    browser: {
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      visibility: document.visibilityState,
    },
    party: route.kind === 'party' ? {
      role: route.role,
      partyId: route.partyId,
      pinnedHostIdentity: route.hostId,
      applicationIdentity: appIdentity,
      trysteroTransportIdentity: transportIdentity,
      passive: actualPassive,
      runtimeState,
      canonicalSequence,
      retainedFromSequence,
      lastSyncMode,
      guestAuthState,
    } : null,
    hostAuthority: hostView,
    guestReplica: guestReplica ? {
      partyId: guestReplica.partyId,
      incarnationId: guestReplica.incarnationId,
      memberId: guestReplica.memberId,
      canonicalSequence: guestReplica.lastCanonicalSequence,
      locked: guestReplica.locked,
      members: guestReplica.members,
      messageCount: guestReplica.messages.length,
      nextClientSequence: guestCredentialView?.nextClientSequence ?? null,
      credentialId: guestCredentialView?.credentialId ?? null,
    } : null,
    transport: {
      peerCount: peers.length,
      relayCount,
      peers,
    },
    logs,
  }

  if (route.kind === 'none') {
    return (
      <Page className="trystero-poc">
        <BackLink to="/">Home</BackLink>
        <div className="trystero-poc__hero">
          <p className="trystero-poc__eyebrow">Issue #19 · host-as-server feasibility POC</p>
          <H1>Host-authoritative state POC</H1>
          <P>
            Proves durable host-local party and Chat authority over direct WebRTC. This does not migrate production Chat and introduces no remote application-state backend.
          </P>
          <button className="trystero-poc__button" type="button" onClick={() => void createParty()}>
            Create durable test party
          </button>
          {runtimeError ? <p className="trystero-poc__error" role="alert">{runtimeError}</p> : null}
        </div>
        <section className="trystero-poc__card">
          <h2>Proof boundary</h2>
          <ul>
            <li>Host canonical state is persisted in IndexedDB before it is broadcast.</li>
            <li>Guests persist credentials and a bounded replica, then converge to host state on reconnect.</li>
            <li>Guest submissions are intents; sender identity and canonical sequence come only from the host.</li>
            <li>Transport remains Trystero/Nostr from Issue #18; production Chat remains unchanged.</li>
          </ul>
          <p><a href="/networking-poc/trystero">Open the Issue #18 transport diagnostics</a></p>
        </section>
      </Page>
    )
  }

  if (route.kind === 'invalid') {
    return (
      <Page className="trystero-poc">
        <BackLink to="/">Home</BackLink>
        <div className="trystero-poc__hero">
          <p className="trystero-poc__eyebrow">Issue #19</p>
          <H1>Host-authoritative state POC</H1>
          <p className="trystero-poc__error" role="alert">The durable test-party fragment is incomplete or invalid.</p>
          <button className="trystero-poc__button" type="button" onClick={() => void createParty()}>
            Create a new durable test party
          </button>
        </div>
      </Page>
    )
  }

  return (
    <Page className="trystero-poc">
      <BackLink to="/">Home</BackLink>
      <div className="trystero-poc__hero">
        <p className="trystero-poc__eyebrow">Issue #19 · durable authority · Trystero {TRYSTERO_VERSION}</p>
        <H1>Host-authoritative state POC</H1>
        <P>
          The host browser is the canonical application server. Nostr is rendezvous only; canonical party and Chat state lives in the host browser, and application traffic is direct WebRTC.
        </P>
        <div className="trystero-poc__status-row">
          <span className={`trystero-poc__status trystero-poc__status--${runtimeState}`}>{runtimeState}</span>
          <span>{route.role === 'host' ? 'Active host authority' : 'Passive guest replica'}</span>
          <span>seq {canonicalSequence}</span>
          <span>sync {lastSyncMode}</span>
          {route.role === 'guest' ? <span>auth {guestAuthState}</span> : null}
        </div>
        {runtimeError ? <p className="trystero-poc__error" role="alert">{runtimeError}</p> : null}
      </div>

      {route.role === 'host' && guestInvite ? (
        <section className="trystero-poc__card">
          <h2>Guest invite</h2>
          <p>The invite carries rendezvous capability data in the fragment. Host authority state itself is not stored remotely.</p>
          <textarea className="trystero-poc__invite" readOnly rows={4} value={guestInvite} aria-label="Guest invite URL" />
          <button className="trystero-poc__button" type="button" onClick={() => void copyText(guestInvite, 'Guest invite copied.')}>
            Copy guest invite
          </button>
        </section>
      ) : null}

      <div className="trystero-poc__grid">
        <section className="trystero-poc__card">
          <h2>Authority & recovery</h2>
          <dl className="trystero-poc__metrics">
            <div><dt>Role</dt><dd>{route.role}</dd></div>
            <div><dt>Application identity</dt><dd title={appIdentity ?? undefined}>{short(appIdentity)}</dd></div>
            <div><dt>Transient transport ID</dt><dd title={transportIdentity ?? undefined}>{short(transportIdentity)}</dd></div>
            <div><dt>Canonical sequence</dt><dd>{canonicalSequence}</dd></div>
            <div><dt>Retained from sequence</dt><dd>{retainedFromSequence ?? '—'}</dd></div>
            <div><dt>Last sync mode</dt><dd>{lastSyncMode}</dd></div>
            <div><dt>Party incarnation</dt><dd>{short(route.role === 'host' ? authorityState?.incarnationId : guestReplica?.incarnationId)}</dd></div>
            <div><dt>Locked</dt><dd>{route.role === 'host' ? authorityState?.locked ? 'yes' : 'no' : guestReplica?.locked ? 'yes' : 'no'}</dd></div>
          </dl>
        </section>

        <section className="trystero-poc__card">
          <h2>Infrastructure boundary</h2>
          <dl className="trystero-poc__metrics">
            <div><dt>Application-state backend</dt><dd>none</dd></div>
            <div><dt>Host durable state</dt><dd>IndexedDB</dd></div>
            <div><dt>Guest durable state</dt><dd>localStorage</dd></div>
            <div><dt>Rendezvous</dt><dd>public Nostr</dd></div>
            <div><dt>Nostr sockets</dt><dd>{relayCount}</dd></div>
            <div><dt>TURN configured</dt><dd>no</dd></div>
            <div><dt>WebRTC peers</dt><dd>{peers.length}</dd></div>
          </dl>
        </section>
      </div>

      <section className="trystero-poc__card">
        <div className="trystero-poc__card-header">
          <h2>Canonical Chat proof</h2>
          <span>Host assigns sender + sequence after durable commit</span>
        </div>
        <form onSubmit={route.role === 'host' ? commitHostMessage : submitGuestIntent}>
          <textarea
            className="trystero-poc__invite"
            rows={3}
            maxLength={1_000}
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder={route.role === 'host' ? 'Commit a canonical host message' : 'Send a guest intent to the host'}
            aria-label="POC chat message"
          />
          <button className="trystero-poc__button" type="submit" disabled={route.role === 'guest' && guestAuthState !== 'accepted'}>
            {route.role === 'host' ? 'Commit host message' : 'Send guest intent'}
          </button>
        </form>
        {messages.length === 0 ? <p>No canonical messages yet.</p> : (
          <ol className="trystero-poc__log">
            {messages.map((message) => (
              <li key={message.sequence}>
                <strong>#{message.sequence}</strong>
                <span><strong>{message.sender.label}</strong> · {message.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {route.role === 'host' ? (
        <section className="trystero-poc__card">
          <div className="trystero-poc__card-header">
            <h2>Canonical membership</h2>
            <button className="trystero-poc__button trystero-poc__button--secondary" type="button" onClick={() => void toggleLock()}>
              {authorityState?.locked ? 'Unlock new admission' : 'Lock new admission'}
            </button>
          </div>
          {authorityState?.members.length ? (
            <div className="trystero-poc__table-wrap">
              <table>
                <thead><tr><th>Member</th><th>ID</th><th>Status</th><th>Last intent</th><th>Action</th></tr></thead>
                <tbody>
                  {authorityState.members.map((member) => (
                    <tr key={member.memberId}>
                      <td>{member.label}</td>
                      <td title={member.memberId}>{short(member.memberId)}</td>
                      <td>{member.removed ? 'removed' : connectedMemberIds.includes(member.memberId) ? 'connected' : 'offline'}</td>
                      <td>{member.lastClientSequence}</td>
                      <td>
                        <button
                          className="trystero-poc__button trystero-poc__button--secondary"
                          type="button"
                          disabled={member.removed}
                          onClick={() => void removeHostMember(member.memberId)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>No canonical guest members yet.</p>}
        </section>
      ) : (
        <section className="trystero-poc__card">
          <h2>Recovery probes</h2>
          <p>These controls deliberately exercise stale-cache, snapshot, and replay paths without changing host authority.</p>
          <div className="trystero-poc__status-row">
            <button className="trystero-poc__button trystero-poc__button--secondary" type="button" disabled={guestAuthState !== 'accepted'} onClick={() => void resetGuestReplicaAndResync()}>
              Reset replica to seq 0 + resync
            </button>
            <button className="trystero-poc__button trystero-poc__button--secondary" type="button" disabled={guestAuthState !== 'accepted'} onClick={() => void forceGuestSnapshot()}>
              Force snapshot recovery
            </button>
            <button className="trystero-poc__button trystero-poc__button--secondary" type="button" disabled={!canReplayGuestIntent} onClick={() => void replayLastGuestIntent()}>
              Replay last guest intent
            </button>
          </div>
        </section>
      )}

      <section className="trystero-poc__card">
        <h2>Transient WebRTC transport</h2>
        {peers.length === 0 ? <p>No usable WebRTC peer yet.</p> : (
          <div className="trystero-poc__table-wrap">
            <table>
              <thead><tr><th>Peer</th><th>App identity</th><th>Connection</th><th>ICE</th><th>Ping</th></tr></thead>
              <tbody>
                {peers.map((peer) => (
                  <tr key={peer.peerId}>
                    <td title={peer.peerId}>{short(peer.peerId)}</td>
                    <td title={peer.appIdentity ?? undefined}>{short(peer.appIdentity)}</td>
                    <td>{peer.connectionState}</td>
                    <td>{peer.iceConnectionState}</td>
                    <td>{peer.pingMs === null || peer.pingMs < 0 ? '—' : `${peer.pingMs} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="trystero-poc__card">
        <div className="trystero-poc__card-header">
          <h2>Recovery evidence log</h2>
          <button className="trystero-poc__button trystero-poc__button--secondary" type="button" onClick={() => void copyText(JSON.stringify(diagnostics, null, 2), 'Diagnostics copied.')}>
            Copy diagnostics
          </button>
        </div>
        {copyStatus ? <p className="trystero-poc__copy-status" role="status">{copyStatus}</p> : null}
        <ol className="trystero-poc__log">
          {logs.map((entry, index) => (
            <li key={`${entry.at}-${index}`}><time dateTime={entry.at}>{entry.at.slice(11, 23)}</time><span>{entry.message}</span></li>
          ))}
        </ol>
      </section>
    </Page>
  )
}

export default HostAuthorityPocPage
