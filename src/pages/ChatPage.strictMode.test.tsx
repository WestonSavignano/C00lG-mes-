import '@testing-library/jest-dom/vitest'
import { StrictMode } from 'react'
import { act, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

class FakeGuestSession implements PartySessionClient {
  private readonly subscribers = new Set<(snapshot: PartySessionSnapshot) => void>()
  readonly snapshot: PartySessionSnapshot = {
    role: 'guest',
    partyId: 'party-a',
    status: 'finding-host',
    locked: false,
    members: [],
    messages: [],
    localMemberId: 'member-a',
    localLabel: 'Guest 1',
    inviteUrl: null,
    error: null,
  }

  getSnapshot() { return this.snapshot }
  subscribe(handler: (snapshot: PartySessionSnapshot) => void) {
    this.subscribers.add(handler)
    return () => this.subscribers.delete(handler)
  }
  async sendMessage() {}
  async dispose() { return { requiresReload: false } }
}

function start(session: PartySessionClient): PartySessionStart {
  return {
    session,
    canonicalHash: '#v=2&party=party-a&role=guest',
    scrubInviteAfterConnect: true,
  }
}

describe('ChatPage StrictMode lifecycle', () => {
  it('starts one guest transport generation for one invite route', async () => {
    const session = new FakeGuestSession()
    const joinGuestInvite = vi.fn(async () => start(session))
    const sessionFactory: PartySessionFactoryClient = {
      startHost: vi.fn(async () => { throw new Error('not used') }),
      restoreHost: vi.fn(async () => { throw new Error('not used') }),
      joinGuestInvite,
      restoreGuest: vi.fn(async () => start(session)),
    }

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/chat#v=2&party=party-a&r=rv&a=admit&host=sha256%3Apin']}>
          <Routes>
            <Route path="/chat" element={<ChatPage sessionFactory={sessionFactory} />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(joinGuestInvite).toHaveBeenCalledTimes(1)
  })
})
