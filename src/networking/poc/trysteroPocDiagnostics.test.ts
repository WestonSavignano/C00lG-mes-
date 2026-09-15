import { describe, expect, it } from 'vitest'
import { buildSafePocDiagnostics } from './trysteroPocDiagnostics'

describe('Trystero POC diagnostics privacy', () => {
  it('keeps topology/timing evidence while omitting party and peer identifiers', () => {
    const diagnostics = buildSafePocDiagnostics({
      capturedAt: '2026-09-15T17:00:00.000Z',
      poc: {
        trysteroVersion: '0.25.4',
        strategy: 'nostr-wake',
        moduleSource: 'https://esm.run/trystero@0.25.4',
        trickleIce: true,
        turnConfigured: false,
      },
      browser: {
        userAgent: 'test-agent',
        online: true,
        visibility: 'visible',
      },
      party: {
        role: 'guest',
        partyId: 'party-secret-id',
        hostId: 'host-secret-id',
        appIdentity: 'application-secret-id',
        transportIdentity: 'transport-secret-id',
        actualPassive: true,
        runtimeState: 'connected',
        topologyOk: true,
        expectedPeerCount: 'exactly 1 host when connected',
      },
      relays: [{ url: 'wss://relay.example', state: 'open' }],
      peers: [{
        peerId: 'remote-peer-secret-id',
        appIdentity: 'remote-application-secret-id',
        connectionState: 'connected',
        iceConnectionState: 'connected',
        connectedAtMs: 1837,
        pingMs: 42,
        path: {
          localCandidateType: 'srflx',
          remoteCandidateType: 'srflx',
          roundTripTimeMs: 40,
          bytesSent: 123,
          bytesReceived: 456,
          usesTurn: false,
        },
      }],
      logs: [{
        at: '2026-09-15T17:00:01.000Z',
        message: 'remote-peer-secret-id connected to party-secret-id after 1837 ms',
      }],
    })

    const serialized = JSON.stringify(diagnostics)
    expect(serialized).not.toContain('party-secret-id')
    expect(serialized).not.toContain('host-secret-id')
    expect(serialized).not.toContain('application-secret-id')
    expect(serialized).not.toContain('transport-secret-id')
    expect(serialized).not.toContain('remote-peer-secret-id')
    expect(serialized).not.toContain('remote-application-secret-id')
    expect(serialized).toContain('1837')
    expect(serialized).toContain('srflx')
    expect(serialized).toContain('nostr-wake')
    expect(serialized).toContain('[redacted]')
  })
})
