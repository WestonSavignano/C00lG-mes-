import { handleState } from './handlers'
import { roomErrorResponse } from './http'
import { createProductionRoomService } from './runtime'

export async function POST(request: Request) {
  try {
    return await handleState(request, createProductionRoomService())
  } catch (error) {
    return roomErrorResponse(error)
  }
}
