import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type {
  PartySessionClient,
  PartySessionSnapshot,
} from '../networking/party/PartySession'
import type {
  PartySessionFactoryClient,
  PartySessionStart,
} from '../networking/party/createPartySession'
import ChatPage from './ChatPage'

class HostSession implements PartySessionClient {
  readonly dispose = vi.fn(async () => ({ requiresReload: false }))

  getSnapshot(): PartySessionSnapshot {
    return {
      role: 'host',
      partyId: 'party-a',
      status: 'waiting',
      locked: false,
      members: [],
      messages: [],
      localMemberId: 'host',
      localLabel: 'Host',
      inviteUrl: 'https://coolgamesplus.com/chat#v=2&party=party-a&r=rv&a=admit&host=sha256%3Apin',
      error: null,
    }
  }

  subscribe() { return () => undefined }
  async sendMessage() {}
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location-hash">{location.hash}</output>
}

function makeFactory(session: HostSession): PartySessionFactoryClient {
  const unexpected = async (): Promise<PartySessionStart> => {
    throw new Error('unexpected factory path')
  }
  return {
    startHost: unexpected,
    restoreHost: vi.fn(async () => ({
      session,
      canonicalHash: '#v=2&party=party-a&role=host',
      scrubInviteAfterConnect: false,
    })),
    joinGuestInvite: unexpected,
    restoreGuest: unexpected,
  }
}

describe('ChatPage leave behavior', () => {
  it('disposes the active client-only party session, clears the fragment, and returns to Start Chat', async () => {
    const user = userEvent.setup()
    const session = new HostSession()
    const factory = makeFactory(session)

    render(
      <MemoryRouter initialEntries={['/chat#v=2&party=party-a&role=host']}>
        <Routes>
          <Route
            path="/chat"
            element={(
              <>
                <ChatPage sessionFactory={factory} />
                <LocationProbe />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /your chat/i })
    await user.click(screen.getByRole('button', { name: 'Leave Chat' }))

    await waitFor(() => expect(session.dispose).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('location-hash')).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'Start Chat' })).toBeEnabled()
  })
})
