import { describe, expect, it } from 'vitest'
import { PeerSession, type PeerConnectionFactory } from './PeerSession'
import type { PeerConnectionState } from './types'

type Listener = EventListenerOrEventListenerObject

class FakeDataChannel {
  readonly label: string
  readonly ordered = true
  readyState: RTCDataChannelState = 'connecting'
  sent: string[] = []
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  private readonly listeners = new Map<string, Set<Listener>>()

  constructor(label = 'c00lgames') {
    this.label = label
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 'closed'
    this.emit('close', new Event('close'))
  }

  open() {
    this.readyState = 'open'
    this.emit('open', new Event('open'))
  }

  receive(data: string) {
    this.emit('message', new MessageEvent('message', { data }))
  }

  private emit(type: string, event: Event) {
    const propertyHandler = type === 'open'
      ? this.onopen
      : type === 'close'
        ? this.onclose
        : type === 'message'
          ? this.onmessage
          : this.onerror

    propertyHandler?.(event as MessageEvent<string> & Event)

    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') {
        listener(event)
      } else {
        listener.handleEvent(event)
      }
    }
  }
}

class FakePeerConnection {
  connectionState: RTCPeerConnectionState = 'new'
  iceGatheringState: RTCIceGatheringState = 'complete'
  localDescription: RTCSessionDescription | null = null
  remoteDescription: RTCSessionDescription | null = null
  onconnectionstatechange: ((event: Event) => void) | null = null
  onicegatheringstatechange: ((event: Event) => void) | null = null
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null
  readonly hostChannel = new FakeDataChannel()
  readonly remoteDescriptions: RTCSessionDescriptionInit[] = []
  readonly listeners = new Map<string, Set<Listener>>()
  autoCompleteIce = true
  closed = false
  dataChannelOptions: RTCDataChannelInit | undefined

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener)
  }

  createDataChannel(_label: string, options?: RTCDataChannelInit) {
    this.dataChannelOptions = options
    return this.hostChannel as unknown as RTCDataChannel
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'offer', sdp: 'v=0\r\na=ice-ufrag:host\r\n' }
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'answer', sdp: 'v=0\r\na=ice-ufrag:guest\r\n' }
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description as RTCSessionDescription
    this.iceGatheringState = this.autoCompleteIce ? 'complete' : 'gathering'
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescriptions.push(description)
    this.remoteDescription = description as RTCSessionDescription
  }

  close() {
    this.closed = true
    this.connectionState = 'closed'
  }

  completeIce() {
    this.iceGatheringState = 'complete'
    this.emit('icegatheringstatechange', new Event('icegatheringstatechange'))
  }

  setConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state
    this.emit('connectionstatechange', new Event('connectionstatechange'))
  }

  receiveDataChannel(channel = new FakeDataChannel()) {
    const event = { channel } as unknown as RTCDataChannelEvent
    this.ondatachannel?.(event)
    this.emit('datachannel', event as unknown as Event)
    return channel
  }

  private emit(type: string, event: Event) {
    const propertyHandler = type === 'connectionstatechange'
      ? this.onconnectionstatechange
      : type === 'icegatheringstatechange'
        ? this.onicegatheringstatechange
        : null

    propertyHandler?.(event)

    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') {
        listener(event)
      } else {
        listener.handleEvent(event)
      }
    }
  }
}

function createHarness() {
  const peerConnection = new FakePeerConnection()
  const factory: PeerConnectionFactory = () => (
    peerConnection as unknown as RTCPeerConnection
  )
  const session = new PeerSession(factory)

  return { peerConnection, session }
}

describe('PeerSession', () => {
  it('creates a host offer with a reliable ordered data channel', async () => {
    const { peerConnection, session } = createHarness()
    const states: PeerConnectionState[] = []
    session.onStateChange((state) => states.push(state))

    await expect(session.createOffer()).resolves.toEqual({
      type: 'offer',
      sdp: 'v=0\r\na=ice-ufrag:host\r\n',
    })

    expect(peerConnection.dataChannelOptions?.ordered).toBe(true)
    expect(states).toEqual(['creating-offer', 'awaiting-answer'])
  })

  it('waits for ICE gathering before returning a host offer', async () => {
    const { peerConnection, session } = createHarness()
    peerConnection.autoCompleteIce = false
    let settled = false

    const offerPromise = session.createOffer().then((offer) => {
      settled = true
      return offer
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)

    peerConnection.completeIce()

    await expect(offerPromise).resolves.toMatchObject({ type: 'offer' })
  })

  it('accepts an offer and returns a gathered guest answer', async () => {
    const { peerConnection, session } = createHarness()
    const offer: RTCSessionDescriptionInit = {
      type: 'offer',
      sdp: 'v=0\r\na=ice-ufrag:host\r\n',
    }

    await expect(session.acceptOffer(offer)).resolves.toEqual({
      type: 'answer',
      sdp: 'v=0\r\na=ice-ufrag:guest\r\n',
    })

    expect(peerConnection.remoteDescriptions).toEqual([offer])
  })

  it('applies a guest answer on the host', async () => {
    const { peerConnection, session } = createHarness()
    const answer: RTCSessionDescriptionInit = {
      type: 'answer',
      sdp: 'v=0\r\na=ice-ufrag:guest\r\n',
    }

    await session.createOffer()
    await session.applyAnswer(answer)

    expect(peerConnection.remoteDescriptions).toContainEqual(answer)
  })

  it('sends and receives opaque data once the channel is open', async () => {
    const { peerConnection, session } = createHarness()
    const received: string[] = []
    session.onMessage((data) => received.push(data))

    await session.createOffer()
    peerConnection.hostChannel.open()
    session.send('hello peer')
    peerConnection.hostChannel.receive('hello host')

    expect(peerConnection.hostChannel.sent).toEqual(['hello peer'])
    expect(received).toEqual(['hello host'])
  })

  it('adopts the data channel created by the host when acting as guest', async () => {
    const { peerConnection, session } = createHarness()
    const received: string[] = []
    session.onMessage((data) => received.push(data))

    const answerPromise = session.acceptOffer({
      type: 'offer',
      sdp: 'v=0\r\na=ice-ufrag:host\r\n',
    })
    const guestChannel = peerConnection.receiveDataChannel()
    guestChannel.open()
    await answerPromise
    guestChannel.receive('from host')

    expect(received).toEqual(['from host'])
  })

  it('reports connected only after the data channel is open', async () => {
    const { peerConnection, session } = createHarness()
    const states: PeerConnectionState[] = []

    await session.createOffer()
    session.onStateChange((state) => states.push(state))

    peerConnection.setConnectionState('connecting')
    peerConnection.setConnectionState('connected')

    expect(states).toEqual(['connecting'])
    expect(() => session.send('too early')).toThrow('Peer data channel is not open')

    peerConnection.hostChannel.open()

    expect(states).toEqual(['connecting', 'connected'])
    expect(() => session.send('ready')).not.toThrow()
  })

  it('surfaces disconnection and failure states', async () => {
    const { peerConnection, session } = createHarness()
    const states: PeerConnectionState[] = []

    await session.createOffer()
    peerConnection.hostChannel.open()
    session.onStateChange((state) => states.push(state))

    peerConnection.setConnectionState('disconnected')
    peerConnection.setConnectionState('failed')

    expect(states).toEqual(['disconnected', 'failed'])
  })

  it('rejects sends before the data channel opens and closes resources', async () => {
    const { peerConnection, session } = createHarness()
    await session.createOffer()

    expect(() => session.send('too early')).toThrow('Peer data channel is not open')

    session.close()

    expect(peerConnection.hostChannel.readyState).toBe('closed')
    expect(peerConnection.closed).toBe(true)
  })
})
