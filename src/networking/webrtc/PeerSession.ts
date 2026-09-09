import type { PeerConnectionState } from './types'

const DATA_CHANNEL_LABEL = 'c00lgames'

const DEFAULT_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ],
}

export type PeerConnectionFactory = (
  configuration: RTCConfiguration,
) => RTCPeerConnection

export type PeerMessageHandler = (data: string) => void
export type PeerStateHandler = (state: PeerConnectionState) => void

export interface PeerSessionClient {
  createOffer(): Promise<RTCSessionDescriptionInit>
  acceptOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>
  applyAnswer(answer: RTCSessionDescriptionInit): Promise<void>
  send(data: string): void
  close(): void
  onMessage(handler: PeerMessageHandler): () => void
  onStateChange(handler: PeerStateHandler): () => void
}

function createBrowserPeerConnection(configuration: RTCConfiguration) {
  return new RTCPeerConnection(configuration)
}

function copyDescription(
  description: RTCSessionDescription | null,
): RTCSessionDescriptionInit {
  if (!description || !description.sdp) {
    throw new Error('Peer session description is unavailable')
  }

  return {
    type: description.type,
    sdp: description.sdp,
  }
}

export class PeerSession implements PeerSessionClient {
  private readonly peerConnection: RTCPeerConnection
  private readonly messageHandlers = new Set<PeerMessageHandler>()
  private readonly stateHandlers = new Set<PeerStateHandler>()
  private dataChannel: RTCDataChannel | null = null
  private state: PeerConnectionState = 'idle'

  constructor(
    peerConnectionFactory: PeerConnectionFactory = createBrowserPeerConnection,
  ) {
    this.peerConnection = peerConnectionFactory(DEFAULT_RTC_CONFIGURATION)

    this.peerConnection.addEventListener(
      'connectionstatechange',
      this.handleConnectionStateChange,
    )
    this.peerConnection.addEventListener('datachannel', this.handleDataChannel)
  }

  onMessage(handler: PeerMessageHandler) {
    this.messageHandlers.add(handler)

    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  onStateChange(handler: PeerStateHandler) {
    this.stateHandlers.add(handler)

    return () => {
      this.stateHandlers.delete(handler)
    }
  }

  async createOffer() {
    this.setState('creating-offer')

    try {
      const channel = this.peerConnection.createDataChannel(DATA_CHANNEL_LABEL, {
        ordered: true,
      })
      this.attachDataChannel(channel)

      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)
      await this.waitForIceGathering()

      const gatheredOffer = copyDescription(this.peerConnection.localDescription)
      this.setState('awaiting-answer')
      return gatheredOffer
    } catch (error) {
      this.setState('failed')
      throw error
    }
  }

  async acceptOffer(offer: RTCSessionDescriptionInit) {
    this.setState('creating-answer')

    try {
      await this.peerConnection.setRemoteDescription(offer)
      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)
      await this.waitForIceGathering()

      const gatheredAnswer = copyDescription(this.peerConnection.localDescription)
      this.setState('connecting')
      return gatheredAnswer
    } catch (error) {
      this.setState('failed')
      throw error
    }
  }

  async applyAnswer(answer: RTCSessionDescriptionInit) {
    this.setState('connecting')

    try {
      await this.peerConnection.setRemoteDescription(answer)
    } catch (error) {
      this.setState('failed')
      throw error
    }
  }

  send(data: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Peer data channel is not open')
    }

    this.dataChannel.send(data)
  }

  close() {
    if (this.state === 'closed') {
      return
    }

    this.setState('closed')
    this.dataChannel?.close()
    this.dataChannel = null
    this.peerConnection.removeEventListener(
      'connectionstatechange',
      this.handleConnectionStateChange,
    )
    this.peerConnection.removeEventListener('datachannel', this.handleDataChannel)
    this.peerConnection.close()
    this.messageHandlers.clear()
    this.stateHandlers.clear()
  }

  private readonly handleDataChannel = (event: RTCDataChannelEvent) => {
    this.attachDataChannel(event.channel)
  }

  private readonly handleConnectionStateChange = () => {
    const nextState = this.mapConnectionState(this.peerConnection.connectionState)

    if (nextState) {
      this.setState(nextState)
    }
  }

  private attachDataChannel(channel: RTCDataChannel) {
    if (this.dataChannel && this.dataChannel !== channel) {
      this.dataChannel.close()
    }

    this.dataChannel = channel
    channel.addEventListener('open', this.handleChannelOpen)
    channel.addEventListener('close', this.handleChannelClose)
    channel.addEventListener('message', this.handleChannelMessage)
    channel.addEventListener('error', this.handleChannelError)
  }

  private readonly handleChannelOpen = () => {
    this.setState('connected')
  }

  private readonly handleChannelClose = () => {
    if (this.state !== 'closed' && this.state !== 'failed') {
      this.setState('disconnected')
    }
  }

  private readonly handleChannelMessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data !== 'string') {
      return
    }

    for (const handler of this.messageHandlers) {
      handler(event.data)
    }
  }

  private readonly handleChannelError = () => {
    this.setState('failed')
  }

  private mapConnectionState(
    connectionState: RTCPeerConnectionState,
  ): PeerConnectionState | null {
    switch (connectionState) {
      case 'connecting':
        return 'connecting'
      case 'connected':
        return 'connected'
      case 'disconnected':
        return 'disconnected'
      case 'failed':
        return 'failed'
      case 'closed':
        return 'closed'
      case 'new':
        return null
    }
  }

  private setState(state: PeerConnectionState) {
    if (this.state === state) {
      return
    }

    this.state = state

    for (const handler of this.stateHandlers) {
      handler(state)
    }
  }

  private async waitForIceGathering() {
    if (this.peerConnection.iceGatheringState === 'complete') {
      return
    }

    await new Promise<void>((resolve) => {
      const handleIceGatheringStateChange = () => {
        if (this.peerConnection.iceGatheringState !== 'complete') {
          return
        }

        this.peerConnection.removeEventListener(
          'icegatheringstatechange',
          handleIceGatheringStateChange,
        )
        resolve()
      }

      this.peerConnection.addEventListener(
        'icegatheringstatechange',
        handleIceGatheringStateChange,
      )
    })
  }
}
