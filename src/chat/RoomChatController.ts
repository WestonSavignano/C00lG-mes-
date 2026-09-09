import type { RoomState } from '../networking/room/roomProtocol'
import type {
  RoomPeerEvent,
  RoomPeerManagerClient,
} from '../networking/room/RoomPeerManager'
import { moderateChatText } from '../moderation/moderationConfig'
import {
  createCanonicalRoomChatMessage,
  createRoomChatSubmit,
  parseCanonicalRoomChatMessage,
  parseRoomChatSubmit,
  serializeCanonicalRoomChatMessage,
  serializeRoomChatSubmit,
  type RoomChatCanonicalMessage,
} from './roomChatProtocol'

export type RoomChatRole = 'host' | 'guest'
export type RoomChatMessageHandler = (message: RoomChatCanonicalMessage) => void
export type ModerateRoomText = (text: string) => string

export interface RoomChatControllerClient {
  send(text: string): void
  onMessage(handler: RoomChatMessageHandler): () => void
  close(): void
}

export class RoomChatController implements RoomChatControllerClient {
  private readonly messageHandlers = new Set<RoomChatMessageHandler>()
  private roomState: RoomState | null = null
  private readonly unsubscribePeer: () => void
  private readonly peers: RoomPeerManagerClient
  private readonly role: RoomChatRole
  private readonly moderateText: ModerateRoomText

  constructor(
    peers: RoomPeerManagerClient,
    role: RoomChatRole,
    moderateText: ModerateRoomText = moderateChatText,
  ) {
    this.peers = peers
    this.role = role
    this.moderateText = moderateText
    this.unsubscribePeer = peers.onEvent((event) => this.handlePeerEvent(event))
  }

  send(text: string) {
    const moderated = this.moderateText(text)
    const submission = createRoomChatSubmit(moderated)

    if (this.role === 'guest') {
      this.peers.sendToHost(serializeRoomChatSubmit(submission))
      return
    }

    const canonical = createCanonicalRoomChatMessage(
      submission,
      { memberId: 'host', label: 'Host' },
      moderated,
    )
    const serialized = serializeCanonicalRoomChatMessage(canonical)
    this.peers.broadcast(serialized)
    this.emit(canonical)
  }

  onMessage(handler: RoomChatMessageHandler) {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  close() {
    this.unsubscribePeer()
    this.messageHandlers.clear()
  }

  private handlePeerEvent(event: RoomPeerEvent) {
    if (event.type === 'room-state') {
      this.roomState = event.state
      return
    }
    if (event.type !== 'message') {
      return
    }

    if (this.role === 'guest') {
      const canonical = parseCanonicalRoomChatMessage(event.data)
      if (canonical) {
        this.emit({
          ...canonical,
          payload: { text: this.moderateText(canonical.payload.text) },
        })
      }
      return
    }

    const submission = parseRoomChatSubmit(event.data)
    if (!submission) {
      return
    }
    const member = this.roomState?.members.find((candidate) => (
      candidate.memberId === event.memberId && !candidate.removed
    ))
    if (!member) {
      return
    }

    const canonical = createCanonicalRoomChatMessage(
      submission,
      { memberId: member.memberId, label: member.label },
      this.moderateText(submission.payload.text),
    )
    const serialized = serializeCanonicalRoomChatMessage(canonical)
    this.peers.broadcast(serialized)
    this.emit(canonical)
  }

  private emit(message: RoomChatCanonicalMessage) {
    for (const handler of this.messageHandlers) {
      handler(message)
    }
  }
}
