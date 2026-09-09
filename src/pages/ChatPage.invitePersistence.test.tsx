import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { RoomCoordinatorClient } from '../networking/room/RoomClient'
import type { RoomPeerEvent, RoomPeerManagerClient } from '../networking/room/RoomPeerManager'
import ChatPage from './ChatPage'

const ROOM_ID = 'room123456789012'
const INVITE_SECRET = 'invitesecret12345678901234'

function createClient(joinOrResume: ReturnType<typeof vi.fn>): RoomCoordinatorClient {
  return {
    createRoom: vi.fn(async () => ({
      version: 1 as const,
      roomId: ROOM_ID,
      hostSecret: 'hostsecret1234567890123456',
      inviteSecret: INVITE_SECRET,
    })),
    joinOrResume,
    getState: vi.fn(async () => ({
      version: 1 as const,
      roomId: ROOM_ID,
      locked: false,
      members: [],
      revision: 1,
    })),
    setLocked: vi.fn(),
    removeMember: vi.fn(),
    announceGeneration: vi.fn(async () => undefined),
    publishSignal: vi.fn(async () => undefined),
    getSignal: vi.fn(async () => null),
    close: vi.fn(),
  }
}

function createPeers(): RoomPeerManagerClient {
  const handlers = new Set<(event: RoomPeerEvent) => void>()
  return {
    startHost: vi.fn(),
    startGuest: vi.fn(),
    setRoomLocked: vi.fn(),
    sendToHost: vi.fn(),
    sendToMember: vi.fn(),
    broadcast: vi.fn(),
    removePeer: vi.fn(),
    close: vi.fn(),
    onEvent(handler) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
  }
}

function LocationHash() {
  const location = useLocation()
  return <output data-testid="location-hash">{location.hash}</output>
}

function renderInvite(client: RoomCoordinatorClient, peers: RoomPeerManagerClient) {
  const route = `/chat#room=${ROOM_ID}&invite=${INVITE_SECRET}`
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
              <LocationHash />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Chat room invite persistence', () => {
  it('keeps the room invite in the URL so a refreshed page can rejoin automatically', async () => {
    const joinOrResume = vi.fn(async () => ({
      version: 1 as const,
      roomId: ROOM_ID,
      memberId: 'member1234567890',
      memberSecret: 'membersecret1234567890123',
      label: 'Guest 1',
      resumed: true,
    }))
    const expectedHash = `#room=${ROOM_ID}&invite=${INVITE_SECRET}`

    const first = renderInvite(createClient(joinOrResume), createPeers())
    await waitFor(() => expect(joinOrResume).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('location-hash')).toHaveTextContent(expectedHash)

    first.unmount()
    renderInvite(createClient(joinOrResume), createPeers())

    await waitFor(() => expect(joinOrResume).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('location-hash')).toHaveTextContent(expectedHash)
  })
})
