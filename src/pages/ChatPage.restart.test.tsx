import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type {
  PeerSessionClient,
  PeerStateHandler,
} from '../networking/webrtc/PeerSession'
import type { PeerConnectionState } from '../networking/webrtc/types'
import ChatPage from './ChatPage'

const OFFER: RTCSessionDescriptionInit = {
  type: 'offer',
  sdp: 'v=0\r\na=ice-ufrag:host\r\n',
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

class PendingOfferSession implements PeerSessionClient {
  private readonly offer = createDeferred<RTCSessionDescriptionInit>()
  private readonly stateHandlers = new Set<PeerStateHandler>()
  closed = false

  createOffer() {
    this.emitState('creating-offer')
    return this.offer.promise
  }

  async acceptOffer(): Promise<RTCSessionDescriptionInit> {
    throw new Error('Not used in this test')
  }

  async applyAnswer(): Promise<void> {
    throw new Error('Not used in this test')
  }

  send() {
    throw new Error('Not used in this test')
  }

  close() {
    this.closed = true
  }

  onMessage() {
    return () => undefined
  }

  onStateChange(handler: PeerStateHandler) {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  resolveOffer() {
    this.offer.resolve(OFFER)
  }

  private emitState(state: PeerConnectionState) {
    for (const handler of this.stateHandlers) {
      handler(state)
    }
  }
}

describe('ChatPage restart behavior', () => {
  it('invalidates a pending setup and stays reset when the old offer later settles', async () => {
    const user = userEvent.setup()
    const session = new PendingOfferSession()

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route
            path="/chat"
            element={<ChatPage peerSessionFactory={() => session} />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Create chat' }))
    await user.click(await screen.findByRole('button', { name: 'Restart chat' }))

    expect(session.closed).toBe(true)
    expect(screen.getByRole('button', { name: 'Create chat' })).toBeEnabled()

    await act(async () => {
      session.resolveOffer()
      await Promise.resolve()
    })

    expect(screen.queryByRole('textbox', { name: 'Invite link' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create chat' })).toBeEnabled()
  })
})
