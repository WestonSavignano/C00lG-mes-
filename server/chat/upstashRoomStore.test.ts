import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StoredRoom, StoredSignal } from './roomStore'
import { CoordinatorUnavailableError, UpstashRoomStore } from './upstashRoomStore'

const ROOM: StoredRoom = {
  roomId: 'room_1234567890123456',
  hostSecretHash: 'a'.repeat(64),
  inviteSecretHash: 'b'.repeat(64),
  locked: false,
  members: {},
  revision: 1,
  createdAt: 1,
  lastActivityAt: 1,
  nextGuestNumber: 1,
}

function response(result: unknown) {
  return Promise.resolve(Response.json({ result }))
}

describe('UpstashRoomStore', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('fails lazily and clearly when Redis environment is absent', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    expect(() => UpstashRoomStore.fromEnv()).toThrow(CoordinatorUnavailableError)
  })

  it('creates rooms with NX and a seven-day expiry', async () => {
    const commands: unknown[][] = []
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      commands.push(JSON.parse(String(init?.body)) as unknown[])
      return response('OK')
    })
    const store = new UpstashRoomStore('https://example.upstash.io', 'token', fetcher)

    await expect(store.createRoom(ROOM)).resolves.toBe(true)
    expect(commands[0]?.slice(0, 2)).toEqual(['SET', 'c00lgames:chat:room:room_1234567890123456'])
    expect(commands[0]).toContain('NX')
    expect(commands[0]).toContain('EX')
    expect(commands[0]).toContain(604800)
  })

  it('uses an atomic revision check when saving a room', async () => {
    const commands: unknown[][] = []
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      commands.push(JSON.parse(String(init?.body)) as unknown[])
      return response(1)
    })
    const store = new UpstashRoomStore('https://example.upstash.io', 'token', fetcher)

    await expect(store.saveRoom({ ...ROOM, revision: 2 }, 1)).resolves.toBe(true)
    expect(commands[0]?.[0]).toBe('EVAL')
    expect(commands[0]).toContain('c00lgames:chat:room:room_1234567890123456')
    expect(commands[0]).toContain(1)
    expect(commands[0]).toContain(604800)
  })

  it('stores signaling under a short-lived generation key', async () => {
    const commands: unknown[][] = []
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      commands.push(JSON.parse(String(init?.body)) as unknown[])
      return response('OK')
    })
    const store = new UpstashRoomStore('https://example.upstash.io', 'token', fetcher)
    const signal: StoredSignal = {
      version: 1,
      roomId: ROOM.roomId,
      memberId: 'member_1234567890',
      generation: 'generation_123456',
      kind: 'offer',
      description: { type: 'offer', sdp: 'v=0\r\n' },
      expiresAt: 121000,
    }

    await store.putSignal(signal, 120)
    expect(commands[0]?.[1]).toBe(
      'c00lgames:chat:signal:room_1234567890123456:member_1234567890:generation_123456:offer',
    )
    expect(commands[0]).toContain(120)
  })
})
