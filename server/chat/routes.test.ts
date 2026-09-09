import { describe, expect, it } from 'vitest'
import { handleCreate, handleJoin, handleState } from './handlers'
import { InMemoryRoomStore } from './inMemoryRoomStore'
import { RoomService } from './roomService'

function jsonRequest(path: string, body: unknown, method = 'POST') {
  return new Request(`https://example.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
}

describe('chat coordinator handlers', () => {
  it('creates and joins a room with JSON responses', async () => {
    const service = new RoomService(new InMemoryRoomStore())
    const createResponse = await handleCreate(jsonRequest('/api/chat/create', {}), service)
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as {
      roomId: string
      hostSecret: string
      inviteSecret: string
    }

    const joinResponse = await handleJoin(jsonRequest('/api/chat/join', {
      roomId: created.roomId,
      inviteSecret: created.inviteSecret,
    }), service)
    expect(joinResponse.status).toBe(200)
    const joined = await joinResponse.json() as { memberId: string; memberSecret: string }

    const stateResponse = await handleState(jsonRequest('/api/chat/state', {
      auth: {
        role: 'guest',
        roomId: created.roomId,
        memberId: joined.memberId,
        memberSecret: joined.memberSecret,
      },
    }), service)
    expect(stateResponse.status).toBe(200)
    expect((await stateResponse.json() as { members: unknown[] }).members).toHaveLength(1)
  })

  it('rejects non-POST requests', async () => {
    const service = new RoomService(new InMemoryRoomStore())
    const response = await handleCreate(jsonRequest('/api/chat/create', {}, 'GET'), service)
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('POST')
  })

  it('rejects coordinator bodies above 64 KiB before service processing', async () => {
    const service = new RoomService(new InMemoryRoomStore())
    const response = await handleJoin(jsonRequest('/api/chat/join', {
      roomId: 'x'.repeat(70_000),
    }), service)
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({
      error: {
        code: 'request_too_large',
        message: 'Request body is too large.',
      },
    })
  })
})
