import { handleJoin } from './handlers'
import { roomErrorResponse } from './http'
import { createProductionRoomService } from './runtime'

export async function POST(request: Request) {
  try {
    return await handleJoin(request, createProductionRoomService())
  } catch (error) {
    return roomErrorResponse(error)
  }
}
