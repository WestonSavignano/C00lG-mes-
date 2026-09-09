import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BackLink from '../components/BackLink'
import H1 from '../components/H1'
import P from '../components/P'
import Page from '../components/Page'
import PageHeader from '../components/PageHeader'
import { MAX_CHAT_HISTORY, MAX_CHAT_MESSAGE_LENGTH } from '../chat/chatProtocol'
import {
  RoomChatController,
  type RoomChatControllerClient,
  type RoomChatRole,
} from '../chat/RoomChatController'
import type { RoomChatCanonicalMessage } from '../chat/roomChatProtocol'
import {
  RoomClient,
  RoomClientError,
  type RoomCoordinatorClient,
} from '../networking/room/RoomClient'
import {
  RoomPeerManager,
  type RoomPeerEvent,
  type RoomPeerManagerClient,
} from '../networking/room/RoomPeerManager'
import {
  isRoomId,
  isSecret,
  type GuestAuth,
  type HostAuth,
  type RoomState,
} from '../networking/room/roomProtocol'
import { moderateChatText } from '../moderation/moderationConfig'
import './ChatPage.css'

type RoomClientFactory = () => RoomCoordinatorClient
type PeerManagerFactory = (client: RoomCoordinatorClient) => RoomPeerManagerClient
type ChatControllerFactory = (
  peers: RoomPeerManagerClient,
  role: RoomChatRole,
) => RoomChatControllerClient

type ChatPageProps = {
  roomClientFactory?: RoomClientFactory
  peerManagerFactory?: PeerManagerFactory
  chatControllerFactory?: ChatControllerFactory
}

type RoomRoute =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'host'; roomId: string; hostSecret: string; inviteSecret: string }
  | { kind: 'guest'; roomId: string; inviteSecret: string }

type PeerStates = Record<string, string>

function createDefaultRoomClient() {
  return new RoomClient()
}

function createDefaultPeerManager(client: RoomCoordinatorClient) {
  return new RoomPeerManager(client)
}

function createDefaultChatController(peers: RoomPeerManagerClient, role: RoomChatRole) {
  return new RoomChatController(peers, role)
}

function parseRoomRoute(hash: string): RoomRoute {
  const params = new URLSearchParams(hash.replace(/^#/u, ''))
  const roomId = params.get('room')
  const hostSecret = params.get('host')
  const inviteSecret = params.get('invite')

  if (!roomId && !hostSecret && !inviteSecret) {
    return { kind: 'none' }
  }
  if (!roomId || !isRoomId(roomId)) {
    return { kind: 'invalid' }
  }
  if (hostSecret) {
    if (!isSecret(hostSecret) || !inviteSecret || !isSecret(inviteSecret)) {
      return { kind: 'invalid' }
    }
    return { kind: 'host', roomId, hostSecret, inviteSecret }
  }
  if (inviteSecret && isSecret(inviteSecret)) {
    return { kind: 'guest', roomId, inviteSecret }
  }
  return { kind: 'invalid' }
}

function roomClientErrorMessage(error: unknown) {
  if (!(error instanceof RoomClientError)) {
    return 'Chat rooms are temporarily unavailable. Try again shortly.'
  }

  switch (error.code) {
    case 'room_locked':
      return 'This room is locked. Ask the host to unlock it before joining.'
    case 'room_full':
      return 'This room is full.'
    case 'member_removed':
      return 'You were removed from this room.'
    case 'room_not_found':
      return 'This room no longer exists or has expired.'
    case 'invalid_credentials':
      return 'This room link is invalid.'
    case 'aborted':
      return ''
    default:
      return 'Chat rooms are temporarily unavailable. Try again shortly.'
  }
}

function buildGuestInvite(roomId: string, inviteSecret: string, pathname: string) {
  const url = new URL(pathname, window.location.origin)
  url.hash = new URLSearchParams({ room: roomId, invite: inviteSecret }).toString()
  return url.toString()
}

function ChatPageSession({
  roomClientFactory = createDefaultRoomClient,
  peerManagerFactory = createDefaultPeerManager,
  chatControllerFactory = createDefaultChatController,
}: ChatPageProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const route = useMemo(() => parseRoomRoute(location.hash), [location.hash])
  const [isCreating, setIsCreating] = useState(false)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [peerStates, setPeerStates] = useState<PeerStates>({})
  const [messages, setMessages] = useState<RoomChatCanonicalMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [selfMemberId, setSelfMemberId] = useState<string | null>(
    route.kind === 'host' ? 'host' : null,
  )
  const [selfLabel, setSelfLabel] = useState(route.kind === 'host' ? 'Host' : '')
  const [statusText, setStatusText] = useState(
    route.kind === 'guest' ? 'Joining…' : route.kind === 'host' ? 'Waiting for guests…' : '',
  )
  const [error, setError] = useState<string | null>(
    route.kind === 'invalid' ? 'This chat room link is invalid.' : null,
  )
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const setupGenerationRef = useRef(0)
  const clientRef = useRef<RoomCoordinatorClient | null>(null)
  const peersRef = useRef<RoomPeerManagerClient | null>(null)
  const chatRef = useRef<RoomChatControllerClient | null>(null)
  const unsubscribeRefs = useRef<Array<() => void>>([])

  const appendMessage = useCallback((message: RoomChatCanonicalMessage) => {
    setMessages((current) => [...current, message].slice(-MAX_CHAT_HISTORY))
  }, [])

  const teardown = useCallback(() => {
    for (const unsubscribe of unsubscribeRefs.current) {
      unsubscribe()
    }
    unsubscribeRefs.current = []
    chatRef.current?.close()
    chatRef.current = null
    peersRef.current?.close()
    peersRef.current = null
    clientRef.current?.close()
    clientRef.current = null
  }, [])

  const handlePeerEvent = useCallback((event: RoomPeerEvent) => {
    if (event.type === 'room-state') {
      setRoomState(event.state)
      return
    }
    if (event.type === 'peer-state') {
      setPeerStates((current) => ({ ...current, [event.memberId]: event.state }))
      return
    }
    if (event.type === 'removed') {
      setStatusText('Removed from room')
      setError('You were removed from this room.')
      return
    }
    if (event.type === 'error') {
      const message = roomClientErrorMessage(event.error)
      if (message) {
        setError(message)
      }
    }
  }, [])

  useEffect(() => {
    setupGenerationRef.current += 1
    const setupGeneration = setupGenerationRef.current

    if (route.kind === 'none' || route.kind === 'invalid') {
      return () => {
        setupGenerationRef.current += 1
        teardown()
      }
    }

    const client = roomClientFactory()
    clientRef.current = client

    const startRoom = async () => {
      try {
        let role: RoomChatRole
        let hostAuth: HostAuth | null = null
        let guestAuth: GuestAuth | null = null

        if (route.kind === 'host') {
          role = 'host'
          hostAuth = {
            role: 'host',
            roomId: route.roomId,
            hostSecret: route.hostSecret,
          }
        } else {
          role = 'guest'
          const joined = await client.joinOrResume(route.roomId, route.inviteSecret)
          if (setupGenerationRef.current !== setupGeneration) {
            return
          }
          guestAuth = {
            role: 'guest',
            roomId: route.roomId,
            memberId: joined.memberId,
            memberSecret: joined.memberSecret,
          }
          setSelfMemberId(joined.memberId)
          setSelfLabel(joined.label)
          setStatusText('Reconnecting…')
        }

        if (setupGenerationRef.current !== setupGeneration) {
          return
        }

        const peers = peerManagerFactory(client)
        peersRef.current = peers
        const chat = chatControllerFactory(peers, role)
        chatRef.current = chat
        unsubscribeRefs.current = [
          peers.onEvent(handlePeerEvent),
          chat.onMessage(appendMessage),
        ]

        if (hostAuth) {
          peers.startHost(hostAuth)
        } else if (guestAuth) {
          peers.startGuest(guestAuth)
        }
      } catch (setupError) {
        if (setupGenerationRef.current !== setupGeneration) {
          return
        }
        const message = roomClientErrorMessage(setupError)
        if (message) {
          setError(message)
        }
        if (setupError instanceof RoomClientError && setupError.code === 'member_removed') {
          setStatusText('Removed from room')
        } else {
          setStatusText('Unable to join room')
        }
      }
    }

    void startRoom()

    return () => {
      setupGenerationRef.current += 1
      teardown()
    }
  }, [
    appendMessage,
    chatControllerFactory,
    handlePeerEvent,
    peerManagerFactory,
    roomClientFactory,
    route,
    teardown,
  ])

  const handleStartChat = async () => {
    if (isCreating) {
      return
    }
    setIsCreating(true)
    setError(null)
    const client = roomClientFactory()

    try {
      const created = await client.createRoom()
      const hash = new URLSearchParams({
        room: created.roomId,
        host: created.hostSecret,
        invite: created.inviteSecret,
      }).toString()
      client.close()
      setIsCreating(false)
      navigate(`/chat#${hash}`, { replace: true })
    } catch (creationError) {
      client.close()
      const message = roomClientErrorMessage(creationError)
      if (message) {
        setError(message)
      }
      setIsCreating(false)
    }
  }

  const handleRoomLock = async (locked: boolean) => {
    if (route.kind !== 'host' || !clientRef.current) {
      return
    }
    setError(null)
    try {
      const state = await clientRef.current.setLocked({
        role: 'host',
        roomId: route.roomId,
        hostSecret: route.hostSecret,
      }, locked)
      setRoomState(state)
    } catch (controlError) {
      const message = roomClientErrorMessage(controlError)
      if (message) {
        setError(message)
      }
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (route.kind !== 'host' || !clientRef.current) {
      return
    }
    setError(null)
    try {
      const state = await clientRef.current.removeMember({
        role: 'host',
        roomId: route.roomId,
        hostSecret: route.hostSecret,
      }, memberId)
      peersRef.current?.removePeer(memberId)
      setRoomState(state)
    } catch (controlError) {
      const message = roomClientErrorMessage(controlError)
      if (message) {
        setError(message)
      }
    }
  }

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!messageInput.trim() || !chatRef.current) {
      return
    }

    try {
      chatRef.current.send(messageInput)
      setMessageInput('')
      setError(null)
    } catch {
      setError('Your connection is not ready yet. Try again when it reconnects.')
    }
  }

  const copyText = async (label: string, value: string) => {
    setCopyStatus(null)
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard unavailable')
      }
      await navigator.clipboard.writeText(value)
      setCopyStatus(`${label} copied.`)
    } catch {
      setCopyStatus(`Select and copy the ${label.toLowerCase()} manually.`)
    }
  }

  const restart = () => {
    setupGenerationRef.current += 1
    teardown()
    navigate('/chat', { replace: true })
  }

  const connectedGuestCount = roomState?.members.filter((member) => (
    !member.removed && peerStates[member.memberId] === 'connected'
  )).length ?? 0
  const guestConnected = peerStates.host === 'connected'
  const canSend = route.kind === 'host' || (route.kind === 'guest' && guestConnected)
  const guestStatusText = route.kind === 'guest'
    ? statusText === 'Removed from room' || statusText === 'Unable to join room'
      ? statusText
      : guestConnected
        ? 'Connected'
        : selfMemberId
          ? 'Reconnecting…'
          : statusText || 'Joining…'
    : statusText

  let shareUrl = ''
  if (route.kind === 'host') {
    shareUrl = buildGuestInvite(route.roomId, route.inviteSecret, location.pathname)
  }

  return (
    <Page className="chat-page">
      <PageHeader>
        <BackLink to="/">Home</BackLink>
        <H1>Chat</H1>
        <P>Durable rooms with direct browser-to-browser messaging and automatic reconnect after refresh.</P>
      </PageHeader>

      <div className="chat-shell">
        {route.kind === 'none' ? (
          <section className="chat-card chat-card--intro" aria-labelledby="start-chat-title">
            <p className="chat-eyebrow">Private room</p>
            <h2 id="start-chat-title">Start a chat room</h2>
            <p>Create one durable room, share one invite, and let your group reconnect without repeating WebRTC setup.</p>
            <button
              className="chat-button chat-button--primary"
              disabled={isCreating}
              onClick={handleStartChat}
              type="button"
            >
              {isCreating ? 'Starting…' : 'Start Chat'}
            </button>
          </section>
        ) : null}

        {route.kind === 'invalid' ? (
          <section className="chat-card">
            <p className="chat-eyebrow">Invalid room</p>
            <h2>That chat link cannot be opened</h2>
            <p>Ask the host for a fresh invite or start a new room.</p>
          </section>
        ) : null}

        {route.kind === 'host' ? (
          <section className="chat-card" aria-labelledby="room-controls-title">
            <div className="chat-room-heading">
              <div>
                <p className="chat-eyebrow">Host controls</p>
                <h2 id="room-controls-title">Your room</h2>
              </div>
              <span className="chat-connected-indicator">
                {roomState?.locked ? 'Locked' : 'Open'}
              </span>
            </div>
            <p>Share the invite below—not the private host URL in your address bar.</p>
            <label className="chat-field">
              <span>Guest invite</span>
              <input aria-label="Guest invite" readOnly type="text" value={shareUrl} />
            </label>
            <div className="chat-actions">
              <button className="chat-button" onClick={() => copyText('Guest invite', shareUrl)} type="button">
                Copy invite
              </button>
              <button
                className="chat-button"
                onClick={() => void handleRoomLock(!roomState?.locked)}
                type="button"
              >
                {roomState?.locked ? 'Unlock room' : 'Lock room'}
              </button>
            </div>
            <p className="chat-status" role="status">
              {connectedGuestCount > 0
                ? `${connectedGuestCount} guest${connectedGuestCount === 1 ? '' : 's'} connected`
                : 'Waiting for guests…'}
            </p>
          </section>
        ) : null}

        {(route.kind === 'host' || route.kind === 'guest') ? (
          <section className="chat-room-grid">
            <aside className="chat-card chat-roster" aria-label="Room members">
              <p className="chat-eyebrow">People</p>
              <div className="chat-member-row">
                <div>
                  <strong>Host</strong>
                  <span>{route.kind === 'host' ? 'You' : peerStates.host === 'connected' ? 'Online' : 'Reconnecting'}</span>
                </div>
              </div>
              {roomState?.members.filter((member) => !member.removed).map((member) => (
                <div className="chat-member-row" key={member.memberId}>
                  <div>
                    <strong>{member.label}{member.memberId === selfMemberId ? ' (You)' : ''}</strong>
                    <span>
                      {peerStates[member.memberId] === 'connected' || (route.kind === 'guest' && member.memberId === selfMemberId)
                        ? 'Online'
                        : member.present ? 'Connecting' : 'Offline'}
                    </span>
                  </div>
                  {route.kind === 'host' ? (
                    <button
                      className="chat-button chat-button--small"
                      onClick={() => void handleRemoveMember(member.memberId)}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </aside>

            <section className="chat-panel" aria-label="Room chat">
              <div className="chat-panel__header">
                <div>
                  <p className="chat-eyebrow">{selfLabel || (route.kind === 'host' ? 'Host' : 'Room member')}</p>
                  <h2>{route.kind === 'guest' ? guestStatusText : 'Room chat'}</h2>
                </div>
                <span className="chat-connected-indicator">
                  {route.kind === 'host'
                    ? `${connectedGuestCount} connected`
                    : guestConnected ? 'Peer-to-peer' : 'Reconnecting'}
                </span>
              </div>

              <div className="chat-messages" aria-live="polite">
                {messages.length === 0 ? (
                  <p className="chat-empty">
                    {canSend ? 'Send the first message.' : 'Messages become available when the connection is ready.'}
                  </p>
                ) : messages.map((message) => {
                  const isLocal = message.sender.memberId === selfMemberId
                  return (
                    <article
                      className={`chat-message chat-message--${isLocal ? 'local' : 'remote'}`}
                      key={message.id}
                    >
                      <span>{isLocal ? 'You' : message.sender.label}</span>
                      <p>{moderateChatText(message.payload.text)}</p>
                    </article>
                  )
                })}
              </div>

              <form className="chat-composer" onSubmit={handleSendMessage}>
                <label className="chat-field chat-field--message">
                  <span>Message</span>
                  <input
                    aria-label="Message"
                    autoComplete="off"
                    disabled={!canSend}
                    maxLength={MAX_CHAT_MESSAGE_LENGTH}
                    onChange={(event) => setMessageInput(event.target.value)}
                    placeholder={canSend ? 'Message the room' : 'Reconnecting…'}
                    type="text"
                    value={messageInput}
                  />
                </label>
                <button
                  className="chat-button chat-button--primary"
                  disabled={!canSend || !messageInput.trim()}
                  type="submit"
                >
                  Send
                </button>
              </form>
            </section>
          </section>
        ) : null}

        {error ? <p className="chat-error" role="alert">{error}</p> : null}
        {copyStatus ? <p className="chat-copy-status" role="status">{copyStatus}</p> : null}

        {route.kind !== 'none' ? (
          <button className="chat-button chat-button--quiet" onClick={restart} type="button">
            Leave room
          </button>
        ) : null}

        <aside className="chat-note">
          <strong>Room privacy</strong>
          <p>Vercel coordinates room membership and short-lived WebRTC signaling only. Chat messages are not stored by the coordinator and travel over WebRTC data channels.</p>
        </aside>
      </div>
    </Page>
  )
}

function ChatPage(props: ChatPageProps) {
  const location = useLocation()
  return <ChatPageSession key={location.hash} {...props} />
}

export default ChatPage
