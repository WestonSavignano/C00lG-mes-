type DiagnosticParty = {
  role: string
  partyId: string
  hostId: string
  appIdentity: string | null
  transportIdentity: string | null
  actualPassive: boolean | null
  runtimeState: string
  topologyOk: boolean
  expectedPeerCount: string
}

type DiagnosticPeer = {
  peerId: string
  appIdentity: string | null
  connectionState: string
  iceConnectionState: string
  connectedAtMs: number | null
  pingMs: number | null
  path: {
    localCandidateType: string | null
    remoteCandidateType: string | null
    roundTripTimeMs: number | null
    bytesSent: number | null
    bytesReceived: number | null
    usesTurn: boolean
  }
}

type DiagnosticInput = {
  capturedAt: string
  poc: {
    trysteroVersion: string
    strategy: string
    moduleSource: string
    trickleIce: boolean
    turnConfigured: boolean
  }
  browser: {
    userAgent: string
    online: boolean
    visibility: string
  }
  party: DiagnosticParty | null
  relays: Array<{ url: string; state: string }>
  peers: DiagnosticPeer[]
  logs: Array<{ at: string; message: string }>
}

function redactKnownIdentifiers(message: string, input: DiagnosticInput) {
  const sensitive = [
    input.party?.partyId,
    input.party?.hostId,
    input.party?.appIdentity,
    input.party?.transportIdentity,
    ...input.peers.flatMap((peer) => [peer.peerId, peer.appIdentity]),
  ].filter((value): value is string => Boolean(value))

  return sensitive.reduce(
    (current, value) => current.replaceAll(value, '[redacted]'),
    message,
  )
}

export function buildSafePocDiagnostics(input: DiagnosticInput) {
  return {
    capturedAt: input.capturedAt,
    poc: input.poc,
    browser: input.browser,
    party: input.party
      ? {
          role: input.party.role,
          actualPassive: input.party.actualPassive,
          runtimeState: input.party.runtimeState,
          topologyOk: input.party.topologyOk,
          expectedPeerCount: input.party.expectedPeerCount,
        }
      : null,
    relays: input.relays,
    peers: input.peers.map((peer) => ({
      connectionState: peer.connectionState,
      iceConnectionState: peer.iceConnectionState,
      connectedAtMs: peer.connectedAtMs,
      pingMs: peer.pingMs,
      path: peer.path,
    })),
    logs: input.logs.map((entry) => ({
      at: entry.at,
      message: redactKnownIdentifiers(entry.message, input),
    })),
  }
}
