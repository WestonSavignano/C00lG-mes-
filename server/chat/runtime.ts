import { RoomService } from './roomService'
import { UpstashRoomStore } from './upstashRoomStore'

export function createProductionRoomService() {
  return new RoomService(UpstashRoomStore.fromEnv())
}
