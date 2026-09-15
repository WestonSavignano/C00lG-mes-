export type RtcStatRecord = {
  id: string
  type: string
  [key: string]: unknown
}

export type RtcPathSummary = {
  localCandidateType: string | null
  remoteCandidateType: string | null
  roundTripTimeMs: number | null
  bytesSent: number | null
  bytesReceived: number | null
  usesTurn: boolean
}

const EMPTY_SUMMARY: RtcPathSummary = {
  localCandidateType: null,
  remoteCandidateType: null,
  roundTripTimeMs: null,
  bytesSent: null,
  bytesReceived: null,
  usesTurn: false,
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function asFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function summarizeRtcStats(stats: Iterable<RtcStatRecord>): RtcPathSummary {
  const records = [...stats]
  const byId = new Map(records.map((record) => [record.id, record]))
  const transport = records.find((record) => record.type === 'transport')
  const selectedPairId = transport ? asString(transport.selectedCandidatePairId) : null

  const pair = selectedPairId
    ? byId.get(selectedPairId)
    : records.find((record) => (
        record.type === 'candidate-pair'
        && record.state === 'succeeded'
        && record.nominated === true
      ))

  if (!pair || pair.type !== 'candidate-pair') {
    return { ...EMPTY_SUMMARY }
  }

  const localId = asString(pair.localCandidateId)
  const remoteId = asString(pair.remoteCandidateId)
  const local = localId ? byId.get(localId) : undefined
  const remote = remoteId ? byId.get(remoteId) : undefined
  const localCandidateType = local ? asString(local.candidateType) : null
  const remoteCandidateType = remote ? asString(remote.candidateType) : null
  const roundTripSeconds = asFiniteNumber(pair.currentRoundTripTime)

  return {
    localCandidateType,
    remoteCandidateType,
    roundTripTimeMs: roundTripSeconds === null ? null : Math.round(roundTripSeconds * 1_000),
    bytesSent: asFiniteNumber(pair.bytesSent),
    bytesReceived: asFiniteNumber(pair.bytesReceived),
    usesTurn: localCandidateType === 'relay' || remoteCandidateType === 'relay',
  }
}
