import {
  clearMemberCredentials,
  loadMemberCredentials,
  saveMemberCredentials,
} from './memberStorage'
import type {
  ConnectionSignal,
  CreateRoomResult,
  GuestAuth,
  HostAuth,
  JoinRoomResult,
  RoomAuth,
  RoomState,
} from './roomProtocol'

export const ROOM_POLL_MS = {
  negotiating: 750,
  hostConnected: 1_500,
  guestConnected: 5_000,
  hidden: 10_000,
} as const

export type RoomPollMode = Exclude<keyof typeof ROOM_POLL_MS, 'hidden'>

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type ErrorResponse = {
  error?: {
    code?: string
    message?: string
  }
}

export class RoomClientError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'RoomClientError'
  }
}

export interface RoomCoordinatorClient {
  createRoom(): Promise<CreateRoomResult>
  joinOrResume(roomId: string, inviteSecret: string): Promise<JoinRoomResult>
  getState(auth: RoomAuth): Promise<RoomState>
  setLocked(auth: HostAuth, locked: boolean): Promise<RoomState>
  removeMember(auth: HostAuth, memberId: string): Promise<RoomState>
  announceGeneration(auth: GuestAuth, generation: string): Promise<void>
  publishSignal(auth: RoomAuth, signal: ConnectionSignal): Promise<void>
  getSignal(
    auth: RoomAuth,
    memberId: string,
    generation: string,
    kind: 'offer' | 'answer',
  ): Promise<ConnectionSignal | null>
  close(): void
}

export class RoomClient implements RoomCoordinatorClient {
  private readonly controllers = new Set<AbortController>()
  private readonly fetcher: FetchLike
  private readonly apiBase: string

  constructor(
    fetcher: FetchLike = (...args) => globalThis.fetch(...args),
    apiBase = '/api/chat',
  ) {
    this.fetcher = fetcher
    this.apiBase = apiBase
  }

  createRoom() {
    return this.post<CreateRoomResult>('create', {})
  }

  async joinOrResume(roomId: string, inviteSecret: string) {
    const stored = loadMemberCredentials(roomId)
    if (stored) {
      try {
        return await this.post<JoinRoomResult>('join', {
          roomId,
          member: stored,
        })
      } catch (error) {
        if (error instanceof RoomClientError && error.code === 'member_removed') {
          clearMemberCredentials(roomId)
          throw error
        }
        if (!(error instanceof RoomClientError) || error.code !== 'invalid_credentials') {
          throw error
        }
        clearMemberCredentials(roomId)
      }
    }

    const joined = await this.post<JoinRoomResult>('join', { roomId, inviteSecret })
    saveMemberCredentials(roomId, {
      memberId: joined.memberId,
      memberSecret: joined.memberSecret,
    })
    return joined
  }

  getState(auth: RoomAuth) {
    return this.post<RoomState>('state', { auth })
  }

  setLocked(auth: HostAuth, locked: boolean) {
    return this.post<RoomState>('control', { action: 'lock', auth, locked })
  }

  removeMember(auth: HostAuth, memberId: string) {
    return this.post<RoomState>('control', { action: 'remove', auth, memberId })
  }

  async announceGeneration(auth: GuestAuth, generation: string) {
    await this.post<{ ok: true }>('signal', { action: 'announce', auth, generation })
  }

  async publishSignal(auth: RoomAuth, signal: ConnectionSignal) {
    await this.post<{ ok: true }>('signal', { action: 'publish', auth, signal })
  }

  async getSignal(
    auth: RoomAuth,
    memberId: string,
    generation: string,
    kind: 'offer' | 'answer',
  ) {
    const result = await this.post<{ signal: ConnectionSignal | null }>('signal', {
      action: 'get',
      auth,
      memberId,
      generation,
      kind,
    })
    return result.signal
  }

  close() {
    for (const controller of this.controllers) {
      controller.abort()
    }
    this.controllers.clear()
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const controller = new AbortController()
    this.controllers.add(controller)

    try {
      const response = await this.fetcher(`${this.apiBase}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        if (!response.ok) {
          throw new RoomClientError('coordinator_unavailable', 'Invalid coordinator response.', response.status)
        }
      }

      if (!response.ok) {
        const errorPayload = payload as ErrorResponse | null
        throw new RoomClientError(
          errorPayload?.error?.code ?? 'coordinator_unavailable',
          errorPayload?.error?.message ?? 'Chat room coordinator request failed.',
          response.status,
        )
      }

      return payload as T
    } catch (error) {
      if (error instanceof RoomClientError) {
        throw error
      }
      if (controller.signal.aborted) {
        throw new RoomClientError('aborted', 'Room request was cancelled.', 499)
      }
      throw new RoomClientError('coordinator_unavailable', 'Chat room coordinator is unavailable.', 503)
    } finally {
      this.controllers.delete(controller)
    }
  }
}

export class RoomPoller {
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = true

  start(
    task: () => Promise<void>,
    getMode: () => RoomPollMode,
    onError: (error: unknown) => void,
  ) {
    this.stop()
    this.stopped = false

    const tick = async () => {
      if (this.stopped) {
        return
      }

      try {
        await task()
      } catch (error) {
        onError(error)
      }

      if (this.stopped) {
        return
      }

      const delay = typeof document !== 'undefined' && document.hidden
        ? ROOM_POLL_MS.hidden
        : ROOM_POLL_MS[getMode()]
      this.timer = setTimeout(() => void tick(), delay)
    }

    void tick()
  }

  stop() {
    this.stopped = true
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
