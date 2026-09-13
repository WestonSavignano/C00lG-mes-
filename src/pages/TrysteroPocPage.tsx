import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BackLink from '../components/BackLink'
import H1 from '../components/H1'
import P from '../components/P'
import Page from '../components/Page'
import {
  buildPartyUrl,
  buildTrysteroConfig,
  evaluateGuestAdmission,
  loadOrCreateIdentity,
  parsePartyHash,
  parsePocHandshake,
  validateRemoteHandshake,
  type PocHandshake,
  type PocRole,
} from '../networking/poc/trysteroPocModel'
import {
  summarizeRtcStats,
  type RtcPathSummary,
  type RtcStatRecord,
} from '../networking/poc/trysteroPocStats'
import './TrysteroPocPage.css'

const TRYSTERO_VERSION = '0.25.4'
const TRYSTERO_MODULE_URL = `https://esm.run/trystero@${TRYSTERO_VERSION}`
const POC_PATH = '/networking-poc/trystero'
const HOST_IDENTITY_KEY = 'c00lgames.poc.trystero.host'
const REFRESH_INTERVAL_MS = 1_500

const EMPTY_RTC_PATH: RtcPathSummary = {
  localCandidateType: null,
  remoteCandidateType: null,
  roundTripTimeMs: null,
  bytesSent: null,
  bytesReceived: null,
  usesTurn: false,
}

type JoinErrorDetails = {
  error: string
  appId: string
  roomId: string
  peerId: string
}

type HandshakePayload = {
  data: unknown
}

type TrysteroRoom = {
  ping(peerId: string): Promise<number>
  leave(): Promise<void>
  isPassive(): boolean
  getPeers(): Record<string, RTCPeerConnection>
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
  connectedAtMs: number | null
  pingMs: number | null
  path: RtcPathSummary
}

type RelayView = {
  url: string
  state: string
}

type EventLogEntry = {
  at: string
  message: string
}

type RuntimeState = 'idle' | 'loading' | 'discovering' | 'connected' | 'error'

function guestIdentityKey(partyId: string) {
  return `c00lgames.poc.trystero.guest.${partyId}`
}

function websocketState(state: number) {
  switch (state) {
    case WebSocket.CONNECTING:
      return 'connecting'
    case WebSocket.OPEN:
      return 'open'
    case WebSocket.CLOSING:
      return 'closing'
    case WebSocket.CLOSED:
      return 'closed'
    default:
      return `unknown (${state})`
  }
}

function short(value: string | null) {
  if (!value) {
    return '—'
  }
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
}

async function loadTrystero(): Promise<TrysteroModule> {
  return import(/* @vite-ignore */ TRYSTERO_MODULE_URL) as Promise<TrysteroModule>
}

async function summarizePeer(peer: RTCPeerConnection) {
  const report = await peer.getStats()
  const records: RtcStatRecord[] = []
  report.forEach((record) => records.push(record as unknown as RtcStatRecord))
  return summarizeRtcStats(records)
}

function createLogEntry(message: string): EventLogEntry {
  return {
    at: new Date().toISOString(),
    message,
  }
}

export function TrysteroPocPage() {
  const [hash, setHash] = useState(() => window.location.hash)
  const route = useMemo(() => parsePartyHash(hash), [hash])
  const [runtimeState, setRuntimeState] = useState<RuntimeState>('idle')
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [appIdentity, setAppIdentity] = useState<string | null>(null)
  const [transportIdentity, setTransportIdentity] = useState<string | null>(null)
  const [actualPassive, setActualPassive] = useState<boolean | null>(null)
  const [peers, setPeers] = useState<PeerView[]>([])
  const [relays, setRelays] = useState<RelayView[]>([])
  const [logs, setLogs] = useState<EventLogEntry[]>([])
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const startedAtRef = useRef(0)
  const roomRef = useRef<TrysteroRoom | null>(null)
  const trysteroRef = useRef<TrysteroModule | null>(null)
  const peerAppIdentityRef = useRef(new Map<string, string>())
  const guestPeerByIdentityRef = useRef(new Map<string, string>())
  const peerConnectedAtRef = useRef(new Map<string, number>())
  const peerPingRef = useRef(new Map<string, number>())

  const addLog = useCallback((message: string) => {
    setLogs((current) => [...current.slice(-79), createLogEntry(message)])
  }, [])

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const guestInvite = useMemo(() => {
    if (route.kind !== 'party' || route.role !== 'host') {
      return null
    }

    return buildPartyUrl({
      origin: window.location.origin,
      pathname: POC_PATH,
      role: 'guest',
      partyId: route.partyId,
      secret: route.secret,
      hostId: route.hostId,
    }).toString()
  }, [route])

  const createParty = useCallback(() => {
    setRuntimeError(null)
    try {
      const hostId = loadOrCreateIdentity(localStorage, HOST_IDENTITY_KEY)
      const partyId = crypto.randomUUID()
      const secret = crypto.randomUUID()
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
      setRuntimeError(error instanceof Error ? error.message : 'Could not create a test party.')
    }
  }, [])

  const copyText = useCallback(async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus(success)
    } catch {
      setCopyStatus('Clipboard unavailable — select and copy the value manually.')
    }
  }, [])

  useEffect(() => {
    if (route.kind !== 'party') {
      setRuntimeState('idle')
      setAppIdentity(null)
      setTransportIdentity(null)
      setActualPassive(null)
      setPeers([])
      setRelays([])
      return
    }

    let disposed = false
    let refreshTimer: ReturnType<typeof setInterval> | null = null
    let room: TrysteroRoom | null = null
    const peerAppIdentity = peerAppIdentityRef.current
    const guestPeerByIdentity = guestPeerByIdentityRef.current
    const peerConnectedAt = peerConnectedAtRef.current
    const peerPing = peerPingRef.current
    peerAppIdentity.clear()
    guestPeerByIdentity.clear()
    peerConnectedAt.clear()
    peerPing.clear()

    const refreshDiagnostics = async () => {
      if (disposed || !room) {
        return
      }

      const currentPeers = room.getPeers()
      const peerViews = await Promise.all(
        Object.entries(currentPeers).map(async ([peerId, peer]) => {
          let path = EMPTY_RTC_PATH
          try {
            path = await summarizePeer(peer)
          } catch {
            // getStats may fail while a peer is being torn down; the next refresh retries.
          }
          return {
            peerId,
            appIdentity: peerAppIdentity.get(peerId) ?? null,
            connectionState: peer.connectionState,
            iceConnectionState: peer.iceConnectionState,
            connectedAtMs: peerConnectedAt.get(peerId) ?? null,
            pingMs: peerPing.get(peerId) ?? null,
            path,
          } satisfies PeerView
        }),
      )

      if (disposed) {
        return
      }
      setPeers(peerViews)
      setRuntimeState(peerViews.length > 0 ? 'connected' : 'discovering')

      const module = trysteroRef.current
      if (module) {
        const sockets = module.getRelaySockets()
        setRelays(Object.entries(sockets).map(([url, socket]) => ({
          url,
          state: websocketState(socket.readyState),
        })))
      }
    }

    const run = async () => {
      setRuntimeState('loading')
      setRuntimeError(null)
      setPeers([])
      setRelays([])
      setLogs([])
      startedAtRef.current = performance.now()

      let localIdentity: string
      try {
        localIdentity = route.role === 'host'
          ? loadOrCreateIdentity(localStorage, HOST_IDENTITY_KEY)
          : loadOrCreateIdentity(localStorage, guestIdentityKey(route.partyId))
      } catch (error) {
        throw new Error(error instanceof Error ? `Local identity unavailable: ${error.message}` : 'Local identity unavailable.')
      }

      if (route.role === 'host' && localIdentity !== route.hostId) {
        throw new Error('This private host link belongs to a different browser identity. Create a new test party here instead.')
      }

      setAppIdentity(localIdentity)
      addLog(`${route.role} application identity restored: ${short(localIdentity)}`)
      addLog(`loading Trystero ${TRYSTERO_VERSION} Nostr strategy`)

      const trystero = await loadTrystero()
      if (disposed) {
        return
      }
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
            if (disposed) {
              return
            }
            const message = `join error for ${short(details.peerId)}: ${details.error}`
            addLog(message)
            setRuntimeError(message)
          },
          onPeerHandshake: async (peerId, send, receive) => {
            const receivePromise = receive()
            await send(localHandshake)
            const payload = await receivePromise
            const remoteHandshake = parsePocHandshake(payload.data)
            if (!remoteHandshake) {
              throw new Error('Remote peer sent an invalid application handshake.')
            }

            const validation = validateRemoteHandshake({
              localRole: route.role,
              partyId: route.partyId,
              expectedHostId: route.hostId,
              handshake: remoteHandshake,
            })
            if (!validation.ok) {
              throw new Error(`Application handshake rejected: ${validation.reason}.`)
            }

            if (route.role === 'host') {
              const admission = evaluateGuestAdmission(
                new Set(guestPeerByIdentity.keys()),
                remoteHandshake.appIdentity,
              )
              if (!admission.accepted) {
                throw new Error(`Application admission rejected: ${admission.reason}.`)
              }

              const previousPeer = guestPeerByIdentity.get(remoteHandshake.appIdentity)
              if (previousPeer && previousPeer !== peerId) {
                room?.getPeers()[previousPeer]?.close()
                peerAppIdentity.delete(previousPeer)
                peerConnectedAt.delete(previousPeer)
                peerPing.delete(previousPeer)
              }
              guestPeerByIdentity.set(remoteHandshake.appIdentity, peerId)
              addLog(`${admission.reconnecting ? 'returning' : 'new'} guest admitted: ${short(remoteHandshake.appIdentity)}`)
            }

            peerAppIdentity.set(peerId, remoteHandshake.appIdentity)
          },
        },
      )
      roomRef.current = room
      setActualPassive(room.isPassive())
      setRuntimeState('discovering')
      addLog(`${route.role === 'host' ? 'active host' : 'passive guest'} joined public Nostr rendezvous`)

      room.onPeerJoin = (peerId) => {
        if (disposed) {
          return
        }
        const elapsed = Math.round(performance.now() - startedAtRef.current)
        peerConnectedAt.set(peerId, elapsed)
        addLog(`WebRTC peer connected after ${elapsed} ms: ${short(peerId)}`)
        void room?.ping(peerId).then((pingMs) => {
          if (!disposed) {
            peerPing.set(peerId, Math.round(pingMs))
            addLog(`peer ping ${short(peerId)}: ${Math.round(pingMs)} ms`)
            void refreshDiagnostics()
          }
        }).catch(() => {
          addLog(`peer ping failed: ${short(peerId)}`)
        })
        void refreshDiagnostics()
      }

      room.onPeerLeave = (peerId) => {
        if (disposed) {
          return
        }
        const identity = peerAppIdentity.get(peerId)
        if (identity && guestPeerByIdentity.get(identity) === peerId) {
          guestPeerByIdentity.delete(identity)
        }
        peerAppIdentity.delete(peerId)
        peerConnectedAt.delete(peerId)
        peerPing.delete(peerId)
        addLog(`WebRTC peer disconnected: ${short(peerId)}`)
        void refreshDiagnostics()
      }

      await refreshDiagnostics()
      refreshTimer = setInterval(() => void refreshDiagnostics(), REFRESH_INTERVAL_MS)
    }

    const onOnline = () => addLog('browser network status: online')
    const onOffline = () => addLog('browser network status: offline')
    const onVisibility = () => addLog(`document visibility: ${document.visibilityState}`)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisibility)

    void run().catch((error) => {
      if (disposed) {
        return
      }
      const message = error instanceof Error ? error.message : 'Trystero POC failed to start.'
      setRuntimeError(message)
      setRuntimeState('error')
      addLog(`startup error: ${message}`)
    })

    return () => {
      disposed = true
      if (refreshTimer) {
        clearInterval(refreshTimer)
      }
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisibility)
      const leavingRoom = room
      roomRef.current = null
      trysteroRef.current = null
      if (leavingRoom) {
        void leavingRoom.leave().catch(() => undefined)
      }
    }
  }, [addLog, route])

  const expectedPeerCount = route.kind === 'party'
    ? route.role === 'host'
      ? '0–7 guests'
      : 'exactly 1 host when connected'
    : '—'

  const topologyOk = route.kind !== 'party'
    ? true
    : route.role === 'host'
      ? peers.length <= 7
      : peers.length <= 1

  const diagnostics = useMemo(() => ({
    capturedAt: new Date().toISOString(),
    poc: {
      trysteroVersion: TRYSTERO_VERSION,
      strategy: 'nostr',
      moduleSource: TRYSTERO_MODULE_URL,
      turnConfigured: false,
    },
    browser: {
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      visibility: document.visibilityState,
    },
    party: route.kind === 'party'
      ? {
          role: route.role,
          partyId: route.partyId,
          hostId: route.hostId,
          appIdentity,
          transportIdentity,
          actualPassive,
          runtimeState,
          topologyOk,
          expectedPeerCount,
        }
      : null,
    relays,
    peers,
    logs,
  }), [actualPassive, appIdentity, expectedPeerCount, logs, peers, relays, route, runtimeState, topologyOk, transportIdentity])

  if (route.kind === 'none') {
    return (
      <Page className="trystero-poc">
        <BackLink to="/">Home</BackLink>
        <div className="trystero-poc__hero">
          <p className="trystero-poc__eyebrow">Issue #18 · feasibility spike</p>
          <H1>Trystero networking POC</H1>
          <P>
            This diagnostic harness tests client-only host-star WebRTC through public Trystero/Nostr rendezvous. It does not replace production Chat.
          </P>
          <button className="trystero-poc__button" type="button" onClick={createParty}>
            Create test party
          </button>
          {runtimeError ? <p className="trystero-poc__error" role="alert">{runtimeError}</p> : null}
        </div>
        <section className="trystero-poc__card" aria-labelledby="poc-boundary-heading">
          <h2 id="poc-boundary-heading">What this proves</h2>
          <ul>
            <li>One active host can discover passive guests without a C00lG@mes+ signaling API.</li>
            <li>Guests should connect only to the host, not to one another.</li>
            <li>Application identity remains separate from transient Trystero peer identity.</li>
            <li>TURN is intentionally not configured; direct-connect failures are evidence for the decision gate.</li>
          </ul>
        </section>
      </Page>
    )
  }

  if (route.kind === 'invalid') {
    return (
      <Page className="trystero-poc">
        <BackLink to="/">Home</BackLink>
        <div className="trystero-poc__hero">
          <p className="trystero-poc__eyebrow">Issue #18 · feasibility spike</p>
          <H1>Trystero networking POC</H1>
          <p className="trystero-poc__error" role="alert">The test-party fragment is incomplete or invalid.</p>
          <button className="trystero-poc__button" type="button" onClick={createParty}>
            Create a new test party
          </button>
        </div>
      </Page>
    )
  }

  return (
    <Page className="trystero-poc">
      <BackLink to="/">Home</BackLink>
      <div className="trystero-poc__hero">
        <p className="trystero-poc__eyebrow">Issue #18 · feasibility spike · Trystero {TRYSTERO_VERSION}</p>
        <H1>Trystero networking POC</H1>
        <P>
          POC only. Production Chat still uses its existing coordinator. This page uses public Nostr rendezvous plus direct WebRTC and configures no TURN relay.
        </P>
        <div className="trystero-poc__status-row">
          <span className={`trystero-poc__status trystero-poc__status--${runtimeState}`}>{runtimeState}</span>
          <span>{route.role === 'host' ? 'Active host' : 'Passive guest'}</span>
          <span>{navigator.onLine ? 'Browser online' : 'Browser offline'}</span>
        </div>
        {runtimeError ? <p className="trystero-poc__error" role="alert">{runtimeError}</p> : null}
      </div>

      {route.role === 'host' && guestInvite ? (
        <section className="trystero-poc__card" aria-labelledby="guest-invite-heading">
          <h2 id="guest-invite-heading">Guest invite</h2>
          <p>Open this single link on another device. For the cross-network test, turn Wi-Fi off on the iPhone before opening it.</p>
          <textarea className="trystero-poc__invite" readOnly rows={4} value={guestInvite} aria-label="Guest invite URL" />
          <button className="trystero-poc__button" type="button" onClick={() => void copyText(guestInvite, 'Guest invite copied.')}>
            Copy guest invite
          </button>
        </section>
      ) : null}

      <div className="trystero-poc__grid">
        <section className="trystero-poc__card" aria-labelledby="identity-heading">
          <h2 id="identity-heading">Identity & topology</h2>
          <dl className="trystero-poc__metrics">
            <div><dt>Role</dt><dd>{route.role}</dd></div>
            <div><dt>Configured passive</dt><dd>{route.role === 'guest' ? 'yes' : 'no'}</dd></div>
            <div><dt>Trystero reports passive</dt><dd>{actualPassive === null ? '—' : actualPassive ? 'yes' : 'no'}</dd></div>
            <div><dt>Application identity</dt><dd title={appIdentity ?? undefined}>{short(appIdentity)}</dd></div>
            <div><dt>Trystero peer identity</dt><dd title={transportIdentity ?? undefined}>{short(transportIdentity)}</dd></div>
            <div><dt>Connected peers</dt><dd>{peers.length}</dd></div>
            <div><dt>Expected</dt><dd>{expectedPeerCount}</dd></div>
            <div><dt>Topology check</dt><dd>{topologyOk ? 'within star bound' : 'VIOLATION'}</dd></div>
          </dl>
        </section>

        <section className="trystero-poc__card" aria-labelledby="infrastructure-heading">
          <h2 id="infrastructure-heading">Infrastructure boundary</h2>
          <dl className="trystero-poc__metrics">
            <div><dt>C00lG@mes+ signaling backend</dt><dd>none</dd></div>
            <div><dt>Rendezvous</dt><dd>public Nostr relays</dd></div>
            <div><dt>Nostr relay sockets</dt><dd>{relays.length}</dd></div>
            <div><dt>STUN</dt><dd>Trystero defaults</dd></div>
            <div><dt>TURN configured</dt><dd>no</dd></div>
            <div><dt>Application traffic</dt><dd>direct WebRTC</dd></div>
          </dl>
        </section>
      </div>

      <section className="trystero-poc__card" aria-labelledby="peer-heading">
        <h2 id="peer-heading">WebRTC peers</h2>
        {peers.length === 0 ? (
          <p>No usable WebRTC peer yet. The page is waiting on public rendezvous and ICE negotiation.</p>
        ) : (
          <div className="trystero-poc__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Peer</th>
                  <th>App identity</th>
                  <th>Connection</th>
                  <th>ICE</th>
                  <th>Path</th>
                  <th>TURN</th>
                  <th>Connect</th>
                  <th>Ping</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((peer) => (
                  <tr key={peer.peerId}>
                    <td title={peer.peerId}>{short(peer.peerId)}</td>
                    <td title={peer.appIdentity ?? undefined}>{short(peer.appIdentity)}</td>
                    <td>{peer.connectionState}</td>
                    <td>{peer.iceConnectionState}</td>
                    <td>{peer.path.localCandidateType ?? '—'} ↔ {peer.path.remoteCandidateType ?? '—'}</td>
                    <td>{peer.path.usesTurn ? 'yes' : 'no'}</td>
                    <td>{peer.connectedAtMs === null ? '—' : `${peer.connectedAtMs} ms`}</td>
                    <td>{peer.pingMs === null ? '—' : `${peer.pingMs} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="trystero-poc__card" aria-labelledby="relay-heading">
        <h2 id="relay-heading">Public Nostr rendezvous</h2>
        {relays.length === 0 ? <p>No relay sockets are visible yet.</p> : (
          <ul className="trystero-poc__relay-list">
            {relays.map((relay) => <li key={relay.url}><code>{relay.url}</code><span>{relay.state}</span></li>)}
          </ul>
        )}
      </section>

      <section className="trystero-poc__card" aria-labelledby="event-heading">
        <div className="trystero-poc__card-header">
          <h2 id="event-heading">Evidence log</h2>
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

export default TrysteroPocPage
