import '@testing-library/jest-dom/vitest'
import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

class FakeHostSession implements PartySessionClient {
  private readonly subscribers = new Set<(snapshot: PartySessionSnapshot) => void>()
  readonly snapshot: PartySessionSnapshot = {
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

  getSnapshot() { return this.snapshot }
  subscribe(handler: (snapshot: PartySessionSnapshot) => void) {
    this.subscribers.add(handler)
    return () => this.subscribers.delete(handler)
  }
  async sendMessage() {}
  async dispose() { return { requiresReload: false } }
}

function guestStart(session: PartySessionClient): PartySessionStart {
  return {
    session,
    canonicalHash: '#v=2&party=party-a&role=guest',
    scrubInviteAfterConnect: true,
  }
}

function hostStart(session: PartySessionClient): PartySessionStart {
  return {
    session,
    canonicalHash: '#v=2&party=party-a&role=host',
    scrubInviteAfterConnect: false,
  }
}

describe('ChatPage StrictMode lifecycle', () => {
  it('starts one guest transport generation for one invite route', async () => {
    const session = new FakeGuestSession()
    const joinGuestInvite = vi.fn(async () => guestStart(session))
    const sessionFactory: PartySessionFactoryClient = {
      startHost: vi.fn(async () => { throw new Error('not used') }),
      restoreHost: vi.fn(async () => { throw new Error('not used') }),
      joinGuestInvite,
      restoreGuest: vi.fn(async () => guestStart(session)),
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

  it('does not restore a second host session after starting a Chat', async () => {
    const user = userEvent.setup()
    const session = new FakeHostSession()
    const startHost = vi.fn(async () => hostStart(session))
    const restoreHost = vi.fn(async () => hostStart(new FakeHostSession()))
    const sessionFactory: PartySessionFactoryClient = {
      startHost,
      restoreHost,
      joinGuestInvite: vi.fn(async () => { throw new Error('not used') }),
      restoreGuest: vi.fn(async () => { throw new Error('not used') }),
    }

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/chat']}>
          <Routes>
            <Route path="/chat" element={<ChatPage sessionFactory={sessionFactory} />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    )

    await user.click(screen.getByRole('button', { name: /start chat/i }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(startHost).toHaveBeenCalledTimes(1)
    expect(restoreHost).not.toHaveBeenCalled()
  })
})
