import { handleSignal } from './handlers'
import { roomErrorResponse } from './http'
import { createProductionRoomService } from './runtime'

export async function POST(request: Request) {
  try {
    return await handleSignal(request, createProductionRoomService())
  } catch (error) {
    return roomErrorResponse(error)
  }
}
