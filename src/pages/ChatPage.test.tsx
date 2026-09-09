import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { RoomCoordinatorClient } from '../networking/room/RoomClient'
import type { RoomPeerEvent, RoomPeerManagerClient } from '../networking/room/RoomPeerManager'
import type {
  ConnectionSignal,
  HostAuth,
  RoomAuth,
  RoomState,
} from '../networking/room/roomProtocol'
import ChatPage from './ChatPage'

const ROOM_ID = 'room123456789012'
const HOST_SECRET = 'hostsecret1234567890123456'
const INVITE_SECRET = 'invitesecret12345678901234'
const MEMBER_ID = 'member1234567890'
const MEMBER_SECRET = 'membersecret1234567890123'

function emptyState(): RoomState {
  return {
    version: 1,
    roomId: ROOM_ID,
    locked: false,
    revision: 1,
    members: [],
  }
}

class FakeRoomClient implements RoomCoordinatorClient {
  state = emptyState()
  joinCalls = 0
  removeCalls: string[] = []
  closeCalls = 0

  async createRoom() {
    return {
      version: 1 as const,
      roomId: ROOM_ID,
      hostSecret: HOST_SECRET,
      inviteSecret: INVITE_SECRET,
    }
  }

  async joinOrResume(roomId: string, inviteSecret: string) {
    this.joinCalls += 1
    expect(roomId).toBe(ROOM_ID)
    expect(inviteSecret).toBe(INVITE_SECRET)
    return {
      version: 1 as const,
      roomId,
      memberId: MEMBER_ID,
      memberSecret: MEMBER_SECRET,
      label: 'Guest 1',
      resumed: this.joinCalls > 1,
    }
  }

  async getState() {
    return this.state
  }

  async setLocked(auth: HostAuth, locked: boolean) {
    void auth
    this.state = { ...this.state, locked, revision: this.state.revision + 1 }
    return this.state
  }

  async removeMember(auth: HostAuth, memberId: string) {
    void auth
    this.removeCalls.push(memberId)
    this.state = {
      ...this.state,
      revision: this.state.revision + 1,
      members: this.state.members.map((member) => (
        member.memberId === memberId ? { ...member, removed: true } : member
      )),
    }
    return this.state
  }

  async announceGeneration() {}
  async publishSignal() {}

  async getSignal(
    auth: RoomAuth,
    memberId: string,
    generation: string,
    kind: 'offer' | 'answer',
  ): Promise<ConnectionSignal | null> {
    void auth
    void memberId
    void generation
    void kind
    return null
  }

  close() {
    this.closeCalls += 1
  }
}

class FakePeers implements RoomPeerManagerClient {
  private readonly handlers = new Set<(event: RoomPeerEvent) => void>()
  hostAuth: HostAuth | null = null
  guestStarted = false
  removedPeers: string[] = []
  broadcasts: string[] = []

  startHost(auth: HostAuth) { this.hostAuth = auth }
  startGuest() { this.guestStarted = true }
  sendToHost() {}
  sendToMember() {}
  broadcast(data: string) { this.broadcasts.push(data) }
  removePeer(memberId: string) { this.removedPeers.push(memberId) }
  close() {}

  onEvent(handler: (event: RoomPeerEvent) => void) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(event: RoomPeerEvent) {
    for (const handler of this.handlers) {
      handler(event)
    }
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.hash}`}</output>
}

function renderChat(route: string, client: FakeRoomClient, peers: FakePeers) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/chat"
          element={(
            <>
              <ChatPage
                roomClientFactory={() => client}
                peerManagerFactory={() => peers}
              />
              <LocationProbe />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ChatPage durable rooms', () => {
  it('starts a room and navigates the current tab to the durable private host URL', async () => {
    const user = userEvent.setup()
    const client = new FakeRoomClient()
    const peers = new FakePeers()
    renderChat('/chat', client, peers)

    await user.click(screen.getByRole('button', { name: 'Start Chat' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`#room=${ROOM_ID}`))
    expect(screen.getByTestId('location')).toHaveTextContent(`host=${HOST_SECRET}`)
    expect(screen.getByTestId('location')).toHaveTextContent(`invite=${INVITE_SECRET}`)
    expect(await screen.findByRole('heading', { name: 'Your room' })).toBeInTheDocument()
  })

  it('shows a guest-only share link from the private host page', async () => {
    const client = new FakeRoomClient()
    const peers = new FakePeers()
    renderChat(`/chat#room=${ROOM_ID}&host=${HOST_SECRET}&invite=${INVITE_SECRET}`, client, peers)

    const invite = await screen.findByRole('textbox', { name: 'Guest invite' })
    const value = (invite as HTMLInputElement).value
    expect(value).toContain(`room=${ROOM_ID}`)
    expect(value).toContain(`invite=${INVITE_SECRET}`)
    expect(value).not.toContain('host=')
  })

  it('automatically joins a guest invite without an answer-code ceremony', async () => {
    const client = new FakeRoomClient()
    const peers = new FakePeers()
    renderChat(`/chat#room=${ROOM_ID}&invite=${INVITE_SECRET}`, client, peers)

    await waitFor(() => expect(client.joinCalls).toBe(1))
    expect(peers.guestStarted).toBe(true)
    expect(screen.queryByRole('button', { name: /join chat/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /answer code/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reconnecting…' })).toBeInTheDocument()
  })

  it('lets the host lock the room and remove a member', async () => {
    const user = userEvent.setup()
    const client = new FakeRoomClient()
    const peers = new FakePeers()
    renderChat(`/chat#room=${ROOM_ID}&host=${HOST_SECRET}&invite=${INVITE_SECRET}`, client, peers)

    await waitFor(() => expect(peers.hostAuth?.roomId).toBe(ROOM_ID))
    const state: RoomState = {
      ...emptyState(),
      members: [{
        memberId: MEMBER_ID,
        label: 'Guest 1',
        present: true,
        removed: false,
        connectionGeneration: 'generation123456',
      }],
    }
    client.state = state
    act(() => peers.emit({ type: 'room-state', state }))

    expect(screen.getByText('Guest 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lock room' }))
    expect(await screen.findByRole('button', { name: 'Unlock room' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(client.removeCalls).toEqual([MEMBER_ID])
    expect(peers.removedPeers).toEqual([MEMBER_ID])
  })
})
