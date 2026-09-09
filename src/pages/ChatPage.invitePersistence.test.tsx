import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { encodeSignal } from '../networking/webrtc/signalingCodec'
import ChatPage from './ChatPage'

const OFFER: RTCSessionDescriptionInit = {
  type: 'offer',
  sdp: 'v=0\r\na=ice-ufrag:host\r\n',
}

function LocationHash() {
  const location = useLocation()
  return <output data-testid="location-hash">{location.hash}</output>
}

function renderInvite(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/chat"
          element={(
            <>
              <ChatPage />
              <LocationHash />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Chat invite persistence', () => {
  it('keeps the encoded offer in the URL so the invite survives a page refresh', () => {
    const encodedOffer = encodeSignal(OFFER)
    const route = `/chat#offer=${encodedOffer}`
    const expectedHash = `#offer=${encodedOffer}`

    const firstRender = renderInvite(route)

    expect(screen.getByRole('heading', { name: 'Join this private chat' })).toBeInTheDocument()
    expect(screen.getByTestId('location-hash')).toHaveTextContent(expectedHash)

    firstRender.unmount()
    renderInvite(route)

    expect(screen.getByRole('heading', { name: 'Join this private chat' })).toBeInTheDocument()
    expect(screen.getByTestId('location-hash')).toHaveTextContent(expectedHash)
  })
})
