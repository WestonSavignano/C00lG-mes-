import type {
  ConnectionSignal,
  GuestAuth,
  HostAuth,
  RoomAuth,
} from '../../src/networking/room/roomProtocol'
import { HttpRequestError, json, readJson, roomErrorResponse } from './http'
import type { JoinInput, RoomService } from './roomService'

function methodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: { Allow: 'POST' },
  })
}

async function execute(request: Request, action: () => Promise<Response>) {
  if (request.method !== 'POST') {
    return methodNotAllowed()
  }

  try {
    return await action()
  } catch (error) {
    return roomErrorResponse(error)
  }
}

export function handleCreate(request: Request, service: RoomService) {
  return execute(request, async () => json(await service.createRoom(), 201))
}

export function handleJoin(request: Request, service: RoomService) {
  return execute(request, async () => {
    const input = await readJson<JoinInput>(request)
    return json(await service.join(input))
  })
}

export function handleState(request: Request, service: RoomService) {
  return execute(request, async () => {
    const body = await readJson<{ auth: RoomAuth }>(request)
    return json(await service.getState(body.auth))
  })
}

type ControlRequest =
  | { action: 'lock'; auth: HostAuth; locked: boolean }
  | { action: 'remove'; auth: HostAuth; memberId: string }

export function handleControl(request: Request, service: RoomService) {
  return execute(request, async () => {
    const body = await readJson<ControlRequest>(request)
    if (body.action === 'lock') {
      if (typeof body.locked !== 'boolean') {
        throw new HttpRequestError('invalid_request', 'Invalid lock state.', 400)
      }
      return json(await service.setLocked(body.auth, body.locked))
    }
    if (body.action === 'remove') {
      return json(await service.removeMember(body.auth, body.memberId))
    }
    throw new HttpRequestError('invalid_request', 'Invalid control action.', 400)
  })
}

type SignalRequest =
  | { action: 'announce'; auth: GuestAuth; generation: string }
  | { action: 'publish'; auth: RoomAuth; signal: ConnectionSignal }
  | {
    action: 'get'
    auth: RoomAuth
    memberId: string
    generation: string
    kind: 'offer' | 'answer'
  }

export function handleSignal(request: Request, service: RoomService) {
  return execute(request, async () => {
    const body = await readJson<SignalRequest>(request)
    if (body.action === 'announce') {
      await service.announceGeneration(body.auth, body.generation)
      return json({ ok: true })
    }
    if (body.action === 'publish') {
      if (body.auth.role === 'host') {
        await service.publishOffer(body.auth, body.signal)
      } else {
        await service.publishAnswer(body.auth, body.signal)
      }
      return json({ ok: true })
    }
    if (body.action === 'get') {
      const signal = await service.readSignal(
        body.auth,
        body.memberId,
        body.generation,
        body.kind,
      )
      return json({ signal })
    }
    throw new HttpRequestError('invalid_request', 'Invalid signal action.', 400)
  })
}
