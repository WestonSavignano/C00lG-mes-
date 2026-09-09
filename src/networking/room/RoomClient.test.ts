import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadMemberCredentials, saveMemberCredentials } from './memberStorage'
import { ROOM_POLL_MS, RoomClient, RoomClientError, RoomPoller } from './RoomClient'

const ROOM_ID = 'room_1234567890123456'
const INVITE = 'invite_123456789012345678901234'
const MEMBER = {
  memberId: 'member_1234567890',
  memberSecret: 'secret_123456789012345678901234',
}

function okJson(data: unknown, status = 200) {
  return Promise.resolve(Response.json(data, { status }))
}

function errorJson(code: string, status: number) {
  return Promise.resolve(Response.json({ error: { code, message: code } }, { status }))
}

describe('RoomClient', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the default browser fetch with the global receiver', async () => {
    const browserFetch = vi.fn(function (
      this: unknown,
      input: string | URL | Request,
      init?: RequestInit,
    ) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation')
      }
      expect(input).toBe('/api/chat/create')
      expect(init?.method).toBe('POST')
      return okJson({
        version: 1,
        roomId: ROOM_ID,
        hostSecret: 'host_123456789012345678901234',
        inviteSecret: INVITE,
      }, 201)
    })
    vi.stubGlobal('fetch', browserFetch)

    const client = new RoomClient()

    await expect(client.createRoom()).resolves.toMatchObject({ roomId: ROOM_ID })
    expect(browserFetch).toHaveBeenCalledTimes(1)
  })

  it('joins with the invite once and persists the issued member credentials', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body).toEqual({ roomId: ROOM_ID, inviteSecret: INVITE })
      return okJson({
        version: 1,
        roomId: ROOM_ID,
        ...MEMBER,
        label: 'Guest 1',
        resumed: false,
      })
    })
    const client = new RoomClient(fetcher)

    await client.joinOrResume(ROOM_ID, INVITE)
    expect(loadMemberCredentials(ROOM_ID)).toEqual(MEMBER)
  })

  it('tries stored member credentials before using the reusable invite', async () => {
    saveMemberCredentials(ROOM_ID, MEMBER)
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body).toEqual({ roomId: ROOM_ID, member: MEMBER })
      return okJson({
        version: 1,
        roomId: ROOM_ID,
        ...MEMBER,
        label: 'Guest 1',
        resumed: true,
      })
    })
    const client = new RoomClient(fetcher)

    const result = await client.joinOrResume(ROOM_ID, INVITE)
    expect(result.resumed).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('falls back to the invite when stored credentials are merely stale', async () => {
    saveMemberCredentials(ROOM_ID, MEMBER)
    const fetcher = vi.fn()
      .mockImplementationOnce(() => errorJson('invalid_credentials', 401))
      .mockImplementationOnce(() => okJson({
        version: 1,
        roomId: ROOM_ID,
        memberId: 'member_2222222222',
        memberSecret: 'secret_222222222222222222222222',
        label: 'Guest 2',
        resumed: false,
      }))
    const client = new RoomClient(fetcher)

    const result = await client.joinOrResume(ROOM_ID, INVITE)
    expect(result.memberId).toBe('member_2222222222')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('surfaces removed membership instead of silently creating a new identity', async () => {
    saveMemberCredentials(ROOM_ID, MEMBER)
    const fetcher = vi.fn(() => errorJson('member_removed', 403))
    const client = new RoomClient(fetcher)

    await expect(client.joinOrResume(ROOM_ID, INVITE)).rejects.toMatchObject({
      code: 'member_removed',
    } satisfies Partial<RoomClientError>)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(loadMemberCredentials(ROOM_ID)).toBeNull()
  })

  it('cancels in-flight coordinator requests on close', async () => {
    let signal: AbortSignal | undefined
    const fetcher = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    const client = new RoomClient(fetcher)
    const pending = client.createRoom()
    client.close()

    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
    expect(signal?.aborted).toBe(true)
  })
})

describe('RoomPoller', () => {
  it('uses fast polling only for negotiation and sparse polling otherwise', () => {
    expect(ROOM_POLL_MS.negotiating).toBe(750)
    expect(ROOM_POLL_MS.hostConnected).toBeGreaterThanOrEqual(3_000)
    expect(ROOM_POLL_MS.hidden).toBeGreaterThanOrEqual(30_000)
  })

  it('never overlaps polling requests', async () => {
    vi.useFakeTimers()
    let resolveCurrent: (() => void) | null = null
    let active = 0
    let maxActive = 0
    const task = vi.fn(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => {
        resolveCurrent = resolve
      })
      active -= 1
    })
    const poller = new RoomPoller()
    poller.start(task, () => 'negotiating', () => undefined)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(task).toHaveBeenCalledTimes(1)
    expect(maxActive).toBe(1)

    resolveCurrent?.()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(750)
    expect(task).toHaveBeenCalledTimes(2)
    expect(maxActive).toBe(1)

    poller.stop()
    vi.useRealTimers()
  })
})