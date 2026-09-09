import type {
  RoomStore,
  SignalKey,
  StoredRoom,
  StoredSignal,
} from './roomStore.js'

function cloneRoom(room: StoredRoom): StoredRoom {
  return structuredClone(room)
}

function signalKey({ roomId, memberId, generation, kind }: SignalKey) {
  return `${roomId}:${memberId}:${generation}:${kind}`
}

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, StoredRoom>()
  private readonly signals = new Map<string, StoredSignal>()
  private readonly clock: () => number

  constructor(clock: () => number = Date.now) {
    this.clock = clock
  }

  async createRoom(record: StoredRoom) {
    if (this.rooms.has(record.roomId)) {
      return false
    }

    this.rooms.set(record.roomId, cloneRoom(record))
    return true
  }

  async getRoom(roomId: string) {
    const room = this.rooms.get(roomId)
    return room ? cloneRoom(room) : null
  }

  async saveRoom(room: StoredRoom, expectedRevision: number) {
    const current = this.rooms.get(room.roomId)
    if (!current || current.revision !== expectedRevision) {
      return false
    }

    this.rooms.set(room.roomId, cloneRoom(room))
    return true
  }

  async putSignal(signal: StoredSignal, ttlSeconds: number) {
    if (ttlSeconds <= 0) {
      return
    }
    this.signals.set(signalKey(signal), structuredClone(signal))
  }

  async getSignal(key: SignalKey) {
    const keyString = signalKey(key)
    const signal = this.signals.get(keyString)
    if (!signal) {
      return null
    }

    if (signal.expiresAt <= this.clock()) {
      this.signals.delete(keyString)
      return null
    }

    return structuredClone(signal)
  }

  async deleteSignal(key: SignalKey) {
    this.signals.delete(signalKey(key))
  }
}
