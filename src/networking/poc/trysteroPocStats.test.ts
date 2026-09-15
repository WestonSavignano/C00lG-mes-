import { describe, expect, it } from 'vitest'
import { summarizeRtcStats, type RtcStatRecord } from './trysteroPocStats'

describe('Trystero POC RTC diagnostics', () => {
  it('uses the selected candidate pair and reports whether TURN is in use', () => {
    const stats: RtcStatRecord[] = [
      {
        id: 'transport-1',
        type: 'transport',
        selectedCandidatePairId: 'pair-1',
      },
      {
        id: 'pair-1',
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        localCandidateId: 'local-1',
        remoteCandidateId: 'remote-1',
        currentRoundTripTime: 0.042,
        bytesSent: 1200,
        bytesReceived: 800,
      },
      {
        id: 'local-1',
        type: 'local-candidate',
        candidateType: 'srflx',
      },
      {
        id: 'remote-1',
        type: 'remote-candidate',
        candidateType: 'host',
      },
    ]

    expect(summarizeRtcStats(stats)).toEqual({
      localCandidateType: 'srflx',
      remoteCandidateType: 'host',
      roundTripTimeMs: 42,
      bytesSent: 1200,
      bytesReceived: 800,
      usesTurn: false,
    })
  })

  it('falls back to a nominated succeeded pair and detects a relay candidate', () => {
    const stats: RtcStatRecord[] = [
      {
        id: 'pair-2',
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        localCandidateId: 'local-2',
        remoteCandidateId: 'remote-2',
      },
      {
        id: 'local-2',
        type: 'local-candidate',
        candidateType: 'relay',
      },
      {
        id: 'remote-2',
        type: 'remote-candidate',
        candidateType: 'srflx',
      },
    ]

    expect(summarizeRtcStats(stats)).toMatchObject({
      localCandidateType: 'relay',
      remoteCandidateType: 'srflx',
      usesTurn: true,
    })
  })

  it('returns an empty summary before a candidate pair is selected', () => {
    expect(summarizeRtcStats([])).toEqual({
      localCandidateType: null,
      remoteCandidateType: null,
      roundTripTimeMs: null,
      bytesSent: null,
      bytesReceived: null,
      usesTurn: false,
    })
  })
})
