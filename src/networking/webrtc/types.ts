export type PeerConnectionState =
  | 'idle'
  | 'creating-offer'
  | 'awaiting-answer'
  | 'creating-answer'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed'

export type SignalType = 'offer' | 'answer'

export type SignalingPayloadV1 = {
  version: 1
  description: {
    type: SignalType
    sdp: string
  }
}
