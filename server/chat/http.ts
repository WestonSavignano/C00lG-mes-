import { RoomServiceError } from './roomService.js'
import { CoordinatorUnavailableError } from './upstashRoomStore.js'

export const MAX_COORDINATOR_BODY_BYTES = 64 * 1_024

export class HttpRequestError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'HttpRequestError'
  }
}

export async function readJson<T>(request: Request, maxBytes = MAX_COORDINATOR_BODY_BYTES): Promise<T> {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpRequestError('request_too_large', 'Request body is too large.', 413)
  }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpRequestError('request_too_large', 'Request body is too large.', 413)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpRequestError('invalid_json', 'Request body must be valid JSON.', 400)
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function errorJson(code: string, message: string, status: number) {
  return json({ error: { code, message } }, status)
}

export function roomErrorResponse(error: unknown) {
  if (error instanceof HttpRequestError) {
    return errorJson(error.code, error.message, error.status)
  }
  if (error instanceof CoordinatorUnavailableError) {
    return errorJson('coordinator_unavailable', error.message, 503)
  }
  if (error instanceof RoomServiceError) {
    const statusByCode: Record<RoomServiceError['code'], number> = {
      room_not_found: 404,
      invalid_credentials: 401,
      room_locked: 403,
      room_full: 409,
      member_removed: 403,
      member_not_found: 404,
      stale_generation: 409,
      invalid_request: 400,
      conflict: 409,
    }
    return errorJson(error.code, error.message, statusByCode[error.code])
  }
  return errorJson('coordinator_unavailable', 'Chat room coordinator is unavailable.', 503)
}
