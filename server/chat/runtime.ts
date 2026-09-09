import { RoomService } from './roomService.js'
import { UpstashRoomStore } from './upstashRoomStore.js'

export function createProductionRoomService() {
  return new RoomService(UpstashRoomStore.fromEnv())
}
