import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { parseChatMessage, serializeChatMessage, type ChatMessage } from '../chat/chatProtocol'
import type {
  PeerMessageHandler,
  PeerSessionClient,
  PeerStateHandler,
} from '../networking/webrtc/PeerSession'
import { decodeSignal, encodeSignal } from '../networking/webrtc/signalingCodec'
import type { PeerConnectionState } from '../networking/webrtc/types'
import ChatPage from './ChatPage'

const OFFER: RTCSessionDescriptionInit = {
  type: 'offer',
  sdp: 'v=0\r\na=ice-ufrag:host\r\n',
}

const ANSWER: RTCSessionDescriptionInit = {
  type: 'answer',
  sdp: 'v=0\r\na=ice-ufrag:guest\r\n',
}

class FakePeerSession implements PeerSessionClient {
  sent: string[] = []
  appliedAnswers: RTCSessionDescriptionInit[] = []
  acceptedOffers: RTCSessionDescriptionInit[] = []
  closed = false
  private messageHandlers = new Set<PeerMessageHandler>()
  private stateHandlers = new Set<PeerStateHandler>()

  async createOffer() {
    return OFFER
  }

  async acceptOffer(offer: RTCSessionDescriptionInit) {
    this.acceptedOffers.push(offer)
    return ANSWER
  }

  async applyAnswer(answer: RTCSessionDescriptionInit) {
    this.appliedAnswers.push(answer)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
  }

  onMessage(handler: PeerMessageHandler) {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStateChange(handler: PeerStateHandler) {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  emitMessage(message: ChatMessage) {
    const serialized = serializeChatMessage(message)
    for (const handler of this.messageHandlers) {
      handler(serialized)
    }
  }

  emitState(state: PeerConnectionState) {
    for (const handler of this.stateHandlers) {
      handler(state)
    }
  }
}

function remoteMessage(text: string): ChatMessage {
  return {
    version: 1,
    type: 'chat.message',
    id: `remote-${text}`,
    sentAt: '2026-09-08T18:00:00.000Z',
    payload: { text },
  }
}

function renderChat(route = '/chat') {
  const session = new FakePeerSession()
  const view = render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/chat"
          element={<ChatPage peerSessionFactory={() => session} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  return { ...view, session }
}

describe('ChatPage', () => {
  it('starts with a host create-chat flow', () => {
    renderChat()

    expect(screen.getByRole('heading', { level: 1, name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create chat' })).toBeEnabled()
  })

  it('creates a shareable offer URL for the host', async () => {
    const user = userEvent.setup()
    renderChat()

    await user.click(screen.getByRole('button', { name: 'Create chat' }))

    const inviteLink = await screen.findByRole('textbox', { name: 'Invite link' })
    const inviteValue = (inviteLink as HTMLInputElement).value
    expect(inviteValue).toContain('/chat#offer=')

    const encodedOffer = new URL(inviteValue).hash.slice('#offer='.length)
    expect(decodeSignal(encodedOffer, 'offer')).toEqual(OFFER)
  })

  it('recognizes an invite fragment and creates a guest answer code', async () => {
    const user = userEvent.setup()
    const encodedOffer = encodeSignal(OFFER)
    const { session } = renderChat(`/chat#offer=${encodedOffer}`)

    await user.click(screen.getByRole('button', { name: 'Join chat' }))

    expect(session.acceptedOffers).toEqual([OFFER])
    const answerCode = await screen.findByRole('textbox', { name: 'Answer code' })
    expect(decodeSignal((answerCode as HTMLTextAreaElement).value, 'answer')).toEqual(ANSWER)
  })

  it('lets the host apply the guest answer', async () => {
    const user = userEvent.setup()
    const { session } = renderChat()

    await user.click(screen.getByRole('button', { name: 'Create chat' }))
    await user.type(
      await screen.findByRole('textbox', { name: 'Answer code from your friend' }),
      encodeSignal(ANSWER),
    )
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    expect(session.appliedAnswers).toEqual([ANSWER])
  })

  it('sends local messages and renders valid remote messages once connected', async () => {
    const user = userEvent.setup()
    const { session } = renderChat()

    await user.click(screen.getByRole('button', { name: 'Create chat' }))
    session.emitState('connected')

    const messageInput = await screen.findByRole('textbox', { name: 'Message' })
    await user.type(messageInput, 'hello guest')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(session.sent).toHaveLength(1)
    expect(parseChatMessage(session.sent[0])?.payload.text).toBe('hello guest')
    expect(screen.getByText('hello guest')).toBeInTheDocument()

    session.emitMessage(remoteMessage('hello host'))

    expect(await screen.findByText('hello host')).toBeInTheDocument()
  })

  it('closes the active peer session when the page unmounts', async () => {
    const user = userEvent.setup()
    const { session, unmount } = renderChat()

    await user.click(screen.getByRole('button', { name: 'Create chat' }))
    unmount()

    await waitFor(() => expect(session.closed).toBe(true))
  })
})
