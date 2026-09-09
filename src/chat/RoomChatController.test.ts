import { describe, expect, it } from 'vitest'
import type { RoomPeerEvent, RoomPeerManagerClient } from '../networking/room/RoomPeerManager'
import { RoomChatController } from './RoomChatController'
import {
  createRoomChatSubmit,
  parseCanonicalRoomChatMessage,
  serializeRoomChatSubmit,
} from './roomChatProtocol'

class FakePeers implements RoomPeerManagerClient {
  readonly toHost: string[] = []
  readonly broadcasts: string[] = []
  private readonly handlers = new Set<(event: RoomPeerEvent) => void>()

  startHost() {}
  startGuest() {}
  sendToHost(data: string) { this.toHost.push(data) }
  sendToMember() {}
  broadcast(data: string) { this.broadcasts.push(data) }
  removePeer() {}
  close() {}
  onEvent(handler: (event: RoomPeerEvent) => void) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
  emit(event: RoomPeerEvent) {
    for (const handler of this.handlers) handler(event)
  }
}

describe('RoomChatController', () => {
  it('sends guest submissions to the host without sender authority', () => {
    const peers = new FakePeers()
    const controller = new RoomChatController(peers, 'guest')
    controller.send('hello host')

    expect(peers.toHost).toHaveLength(1)
    expect(JSON.parse(peers.toHost[0] ?? '{}')).not.toHaveProperty('sender')
  })

  it('canonicalizes guest sender identity from room state and broadcasts it', () => {
    const peers = new FakePeers()
    const controller = new RoomChatController(peers, 'host')
    const received: unknown[] = []
    controller.onMessage((message) => received.push(message))
    peers.emit({
      type: 'room-state',
      state: {
        version: 1,
        roomId: 'room_1234567890123456',
        locked: false,
        revision: 1,
        members: [{
          memberId: 'member_1234567890',
          label: 'Guest 1',
          present: true,
          removed: false,
          connectionGeneration: 'generation_123456',
        }],
      },
    })

    const submit = createRoomChatSubmit('hello room')
    peers.emit({
      type: 'message',
      memberId: 'member_1234567890',
      data: serializeRoomChatSubmit(submit),
    })

    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      sender: { memberId: 'member_1234567890', label: 'Guest 1' },
      payload: { text: 'hello room' },
    })
    expect(parseCanonicalRoomChatMessage(peers.broadcasts[0] ?? '')).toMatchObject({
      sender: { memberId: 'member_1234567890', label: 'Guest 1' },
    })
  })

  it('broadcasts host messages with the Host identity', () => {
    const peers = new FakePeers()
    const controller = new RoomChatController(peers, 'host')
    controller.send('hello guests')

    expect(parseCanonicalRoomChatMessage(peers.broadcasts[0] ?? '')).toMatchObject({
      sender: { memberId: 'host', label: 'Host' },
      payload: { text: 'hello guests' },
    })
  })
})
