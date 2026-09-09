import { handleState } from '../../server/chat/handlers'
import { roomErrorResponse } from '../../server/chat/http'
import { createProductionRoomService } from '../../server/chat/runtime'

export async function POST(request: Request) {
  try {
    return await handleState(request, createProductionRoomService())
  } catch (error) {
    return roomErrorResponse(error)
  }
}
