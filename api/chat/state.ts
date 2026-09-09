import { handleState } from '../../server/chat/handlers.js'
import { roomErrorResponse } from '../../server/chat/http.js'
import { createProductionRoomService } from '../../server/chat/runtime.js'

export async function POST(request: Request) {
  try {
    return await handleState(request, createProductionRoomService())
  } catch (error) {
    return roomErrorResponse(error)
  }
}
