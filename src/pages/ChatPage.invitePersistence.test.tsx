import { render, screen, waitFor } from '@testing-library/react'
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

const PARTY_ID = 'party-a'
const DURABLE_GUEST_HASH = `#v=2&party=${PARTY_ID}&role=guest`

class GuestSession implements PartySessionClient {
  readonly dispose = vi.fn(async () => ({ requiresReload: false }))

  getSnapshot(): PartySessionSnapshot {
    return {
      role: 'guest',
      partyId: PARTY_ID,
      status: 'connected',
      locked: false,
      members: [{ memberId: 'member-a', label: 'Guest 1', removed: false }],
      messages: [],
      localMemberId: 'member-a',
      localLabel: 'Guest 1',
      inviteUrl: null,
      error: null,
    }
  }

  subscribe() { return () => undefined }
  async sendMessage() {}
}

function LocationHash() {
  const location = useLocation()
  return <output data-testid="location-hash">{location.hash}</output>
}

function makeFactory(restoreGuest: ReturnType<typeof vi.fn>): PartySessionFactoryClient {
  const unused = async (): Promise<PartySessionStart> => {
    throw new Error('unexpected factory path')
  }
  return {
    startHost: unused,
    restoreHost: unused,
    joinGuestInvite: unused,
    restoreGuest,
  }
}

function renderDurableGuest(factory: PartySessionFactoryClient) {
  return render(
    <MemoryRouter initialEntries={[`/chat${DURABLE_GUEST_HASH}`]}>
      <Routes>
        <Route
          path="/chat"
          element={(
            <>
              <ChatPage sessionFactory={factory} />
              <LocationHash />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Chat guest route persistence', () => {
  it('restores the durable guest member after refresh without keeping invite capabilities in the URL', async () => {
    const restoreGuest = vi.fn(async (): Promise<PartySessionStart> => ({
      session: new GuestSession(),
      canonicalHash: DURABLE_GUEST_HASH,
      scrubInviteAfterConnect: false,
    }))
    const factory = makeFactory(restoreGuest)

    const first = renderDurableGuest(factory)
    await waitFor(() => expect(restoreGuest).toHaveBeenCalledTimes(1))
    expect(restoreGuest).toHaveBeenLastCalledWith(PARTY_ID)
    expect(screen.getByTestId('location-hash')).toHaveTextContent(DURABLE_GUEST_HASH)
    expect(screen.getByTestId('location-hash')).not.toHaveTextContent('&r=')
    expect(screen.getByTestId('location-hash')).not.toHaveTextContent('&a=')
    expect(screen.getByTestId('location-hash')).not.toHaveTextContent('&host=')

    first.unmount()
    renderDurableGuest(factory)

    await waitFor(() => expect(restoreGuest).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('location-hash')).toHaveTextContent(DURABLE_GUEST_HASH)
  })
})
