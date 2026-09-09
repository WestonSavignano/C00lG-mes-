import { ROOM_TTL_MS } from './roomService'
import type {
  RoomStore,
  SignalKey,
  StoredRoom,
  StoredSignal,
} from './roomStore'

const ROOM_TTL_SECONDS = Math.floor(ROOM_TTL_MS / 1_000)
const ROOM_PREFIX = 'c00lgames:chat:room:'
const SIGNAL_PREFIX = 'c00lgames:chat:signal:'

const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end
local decoded = cjson.decode(current)
if tonumber(decoded.revision) ~= tonumber(ARGV[1]) then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type UpstashBody<T> = {
  result?: T
  error?: string
}

export class CoordinatorUnavailableError extends Error {
  constructor(message = 'Chat room coordinator is unavailable.') {
    super(message)
    this.name = 'CoordinatorUnavailableError'
  }
}

function roomKey(roomId: string) {
  return `${ROOM_PREFIX}${roomId}`
}

function signalKey({ roomId, memberId, generation, kind }: SignalKey) {
  return `${SIGNAL_PREFIX}${roomId}:${memberId}:${generation}:${kind}`
}

function firstConfiguredEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }
  return undefined
}

export class UpstashRoomStore implements RoomStore {
  private readonly url: string
  private readonly token: string
  private readonly fetcher: FetchLike

  constructor(url: string, token: string, fetcher: FetchLike = fetch) {
    this.url = url
    this.token = token
    this.fetcher = fetcher
  }

  static fromEnv(fetcher: FetchLike = fetch) {
    const url = firstConfiguredEnv(
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_KV_REST_API_URL',
      'KV_REST_API_URL',
    )
    const token = firstConfiguredEnv(
      'UPSTASH_REDIS_REST_TOKEN',
      'UPSTASH_REDIS_REST_KV_REST_API_TOKEN',
      'KV_REST_API_TOKEN',
    )
    if (!url || !token) {
      throw new CoordinatorUnavailableError('Upstash Redis is not configured.')
    }
    return new UpstashRoomStore(url.replace(/\/$/u, ''), token, fetcher)
  }

  async createRoom(record: StoredRoom) {
    const result = await this.command<string | null>([
      'SET',
      roomKey(record.roomId),
      JSON.stringify(record),
      'NX',
      'EX',
      ROOM_TTL_SECONDS,
    ])
    return result === 'OK'
  }

  async getRoom(roomId: string) {
    const value = await this.command<string | null>(['GET', roomKey(roomId)])
    return value ? JSON.parse(value) as StoredRoom : null
  }

  async saveRoom(room: StoredRoom, expectedRevision: number) {
    const result = await this.command<number>([
      'EVAL',
      CAS_SCRIPT,
      1,
      roomKey(room.roomId),
      expectedRevision,
      JSON.stringify(room),
      ROOM_TTL_SECONDS,
    ])
    return result === 1
  }

  async putSignal(signal: StoredSignal, ttlSeconds: number) {
    await this.command<string>([
      'SET',
      signalKey(signal),
      JSON.stringify(signal),
      'EX',
      ttlSeconds,
    ])
  }

  async getSignal(key: SignalKey) {
    const value = await this.command<string | null>(['GET', signalKey(key)])
    return value ? JSON.parse(value) as StoredSignal : null
  }

  async deleteSignal(key: SignalKey) {
    await this.command<number>(['DEL', signalKey(key)])
  }

  private async command<T>(command: Array<string | number>): Promise<T> {
    let response: Response
    try {
      response = await this.fetcher(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      })
    } catch {
      throw new CoordinatorUnavailableError()
    }

    let body: UpstashBody<T>
    try {
      body = await response.json() as UpstashBody<T>
    } catch {
      throw new CoordinatorUnavailableError('Invalid response from room storage.')
    }

    if (!response.ok || body.error || !Object.hasOwn(body, 'result')) {
      throw new CoordinatorUnavailableError(body.error ?? 'Room storage request failed.')
    }

    return body.result as T
  }
}
