import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

class FakeSession implements PartySessionClient {
  private listeners = new Set<(snapshot: PartySessionSnapshot) => void>()
  readonly sendMessage = vi.fn(async () => undefined)
  readonly setLocked = vi.fn(async () => undefined)
  readonly removeMember = vi.fn(async () => undefined)
  readonly dispose = vi.fn(async () => ({ requiresReload: false }))

  constructor(public snapshot: PartySessionSnapshot) {}

  getSnapshot() { return this.snapshot }
  subscribe(handler: (snapshot: PartySessionSnapshot) => void) {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  emit(patch: Partial<PartySessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }
}

function hostSnapshot(): PartySessionSnapshot {
  return {
    role: 'host',
    partyId: 'party-a',
    status: 'waiting',
    locked: false,
    members: [{ memberId: 'member-a', label: 'Guest 1', removed: false }],
    messages: [],
    localMemberId: 'host',
    localLabel: 'Host',
    inviteUrl: 'https://coolgamesplus.com/chat#v=2&party=party-a&r=rv&a=admit&host=sha256%3Apin',
    error: null,
  }
}

function guestSnapshot(): PartySessionSnapshot {
  return {
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
}

function start(session: FakeSession, options: Partial<PartySessionStart> = {}): PartySessionStart {
  return {
    session,
    canonicalHash: session.snapshot.role === 'host'
      ? '#v=2&party=party-a&role=host'
      : '#v=2&party=party-a&role=guest',
    scrubInviteAfterConnect: false,
    ...options,
  }
}

function factory(overrides: Partial<PartySessionFactoryClient> = {}): PartySessionFactoryClient {
  return {
    startHost: vi.fn(async () => start(new FakeSession(hostSnapshot()))),
    restoreHost: vi.fn(async () => start(new FakeSession(hostSnapshot()))),
    joinGuestInvite: vi.fn(async () => start(new FakeSession(guestSnapshot()), { scrubInviteAfterConnect: true })),
    restoreGuest: vi.fn(async () => start(new FakeSession(guestSnapshot()))),
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.hash}</output>
}

function renderChat(initialEntry: string, sessionFactory: PartySessionFactoryClient) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/chat"
          element={(
            <>
              <ChatPage sessionFactory={sessionFactory} />
              <LocationProbe />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ChatPage client-only party UX', () => {
  it('starts a browser-hosted Chat and replaces the route with the durable host hash', async () => {
    const user = userEvent.setup()
    const session = new FakeSession(hostSnapshot())
    const sessionFactory = factory({ startHost: vi.fn(async () => start(session)) })
    renderChat('/chat', sessionFactory)

    await user.click(screen.getByRole('button', { name: /start chat/i }))

    await waitFor(() => expect(sessionFactory.startHost).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('heading', { name: /your chat/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue(/coolgamesplus\.com\/chat#v=2/)).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/chat#v=2&party=party-a&role=host')
  })

  it('keeps invite capabilities in the fragment until admission succeeds, then scrubs to a durable guest route', async () => {
    const guest = new FakeSession(guestSnapshot())
    const sessionFactory = factory({
      joinGuestInvite: vi.fn(async () => start(guest, { scrubInviteAfterConnect: true })),
    })
    const invite = '/chat#v=2&party=party-a&r=rv&a=admit&host=sha256%3Apin'
    renderChat(invite, sessionFactory)

    await waitFor(() => expect(sessionFactory.joinGuestInvite).toHaveBeenCalledTimes(1))
    expect(screen.getByText(/finding host/i)).toBeInTheDocument()
    expect(screen.getByText('0/8')).toBeInTheDocument()
    expect(screen.getByText(/host not connected/i)).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('a=admit')

    act(() => guest.emit({ status: 'connected' }))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/chat#v=2&party=party-a&role=guest')
      expect(screen.getByTestId('location')).not.toHaveTextContent('a=admit')
      expect(screen.getByTestId('location')).not.toHaveTextContent('r=rv')
      expect(screen.getByText('1/8')).toBeInTheDocument()
    })
  })

  it('preserves host lock/unlock and member removal controls through the session facade', async () => {
    const user = userEvent.setup()
    const host = new FakeSession(hostSnapshot())
    const sessionFactory = factory({ restoreHost: vi.fn(async () => start(host)) })
    renderChat('/chat#v=2&party=party-a&role=host', sessionFactory)

    await screen.findByRole('heading', { name: /your chat/i })
    await user.click(screen.getByRole('button', { name: /lock chat/i }))
    expect(host.setLocked).toHaveBeenCalledWith(true)

    act(() => host.emit({ locked: true, inviteUrl: null }))
    await user.click(screen.getByRole('button', { name: /unlock chat/i }))
    expect(host.setLocked).toHaveBeenCalledWith(false)

    await user.click(screen.getByRole('button', { name: /remove guest 1/i }))
    expect(host.removeMember).toHaveBeenCalledWith('member-a')
  })

  it('shows player-facing reconnect and removal states without networking jargon', async () => {
    const guest = new FakeSession({ ...guestSnapshot(), status: 'reconnecting' })
    const sessionFactory = factory({ restoreGuest: vi.fn(async () => start(guest)) })
    renderChat('/chat#v=2&party=party-a&role=guest', sessionFactory)

    expect(await screen.findByText(/reconnecting/i)).toBeInTheDocument()
    act(() => guest.emit({ status: 'removed' }))
    expect(await screen.findByText(/removed from this chat/i)).toBeInTheDocument()
    expect(screen.queryByText(/\b(?:webrtc|nostr|ice)\b/i)).not.toBeInTheDocument()
  })

  it('progressively explains slow discovery and retries with the durable guest identity', async () => {
    vi.useFakeTimers()
    try {
      const first = new FakeSession(guestSnapshot())
      const replacement = new FakeSession({ ...guestSnapshot(), status: 'reconnecting' })
      const restoreGuest = vi.fn()
        .mockResolvedValueOnce(start(first))
        .mockResolvedValueOnce(start(replacement))
      const sessionFactory = factory({ restoreGuest })
      renderChat('/chat#v=2&party=party-a&role=guest', sessionFactory)

      await act(async () => { await Promise.resolve() })
      expect(restoreGuest).toHaveBeenCalledTimes(1)
      expect(screen.queryByText(/can take a little longer/i)).not.toBeInTheDocument()

      act(() => vi.advanceTimersByTime(10_000))
      expect(screen.getByText(/can take a little longer/i)).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(65_000))
      expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      await act(async () => { await Promise.resolve() })

      expect(first.dispose).toHaveBeenCalledTimes(1)
      expect(restoreGuest).toHaveBeenCalledTimes(2)
      expect(restoreGuest).toHaveBeenLastCalledWith('party-a')
    } finally {
      vi.useRealTimers()
    }
  })

  it('requires a page reload instead of same-page retry when transport teardown is unsafe', async () => {
    vi.useFakeTimers()
    try {
      const first = new FakeSession(guestSnapshot())
      first.dispose.mockResolvedValueOnce({ requiresReload: true })
      const restoreGuest = vi.fn(async () => start(first))
      const sessionFactory = factory({ restoreGuest })
      renderChat('/chat#v=2&party=party-a&role=guest', sessionFactory)

      await act(async () => { await Promise.resolve() })
      act(() => vi.advanceTimersByTime(75_000))
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      await act(async () => { await Promise.resolve() })

      expect(restoreGuest).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/reload this page to reconnect safely/i)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('sends Chat text through canonical party authority rather than a coordinator endpoint', async () => {
    const user = userEvent.setup()
    const host = new FakeSession({ ...hostSnapshot(), status: 'connected' })
    const sessionFactory = factory({ restoreHost: vi.fn(async () => start(host)) })
    renderChat('/chat#v=2&party=party-a&role=host', sessionFactory)

    const composer = await screen.findByRole('textbox', { name: 'Message' })
    await user.type(composer, 'hello from host')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(host.sendMessage).toHaveBeenCalledWith('hello from host')
  })
})
