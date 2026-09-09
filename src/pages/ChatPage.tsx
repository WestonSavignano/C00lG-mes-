import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BackLink from '../components/BackLink'
import H1 from '../components/H1'
import P from '../components/P'
import Page from '../components/Page'
import PageHeader from '../components/PageHeader'
import {
  MAX_CHAT_HISTORY,
  MAX_CHAT_MESSAGE_LENGTH,
  createChatMessage,
  parseChatMessage,
  serializeChatMessage,
  type ChatMessage,
} from '../chat/chatProtocol'
import {
  PeerSession,
  type PeerSessionClient,
} from '../networking/webrtc/PeerSession'
import { decodeSignal, encodeSignal } from '../networking/webrtc/signalingCodec'
import type { PeerConnectionState } from '../networking/webrtc/types'
import './ChatPage.css'

type PeerSessionFactory = () => PeerSessionClient

type ChatPageProps = {
  peerSessionFactory?: PeerSessionFactory
}

type VisibleMessage = {
  direction: 'local' | 'remote'
  message: ChatMessage
}

type InviteState = {
  offer: RTCSessionDescriptionInit | null
  error: string | null
}

function createDefaultPeerSession() {
  return new PeerSession()
}

function readInvite(hash: string): InviteState {
  const encodedOffer = new URLSearchParams(hash.replace(/^#/u, '')).get('offer')

  if (!encodedOffer) {
    return { offer: null, error: null }
  }

  try {
    return {
      offer: decodeSignal(encodedOffer, 'offer'),
      error: null,
    }
  } catch {
    return {
      offer: null,
      error: 'This chat invite is invalid or no longer supported.',
    }
  }
}

function buildInviteLink(encodedOffer: string) {
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  const inviteUrl = new URL(`${baseUrl}chat`, window.location.origin)
  inviteUrl.hash = `offer=${encodedOffer}`
  return inviteUrl.toString()
}

function describeState(state: PeerConnectionState) {
  switch (state) {
    case 'creating-offer':
      return 'Creating invite…'
    case 'awaiting-answer':
      return 'Waiting for your friend’s answer.'
    case 'creating-answer':
      return 'Creating answer…'
    case 'connecting':
      return 'Connecting directly…'
    case 'connected':
      return 'Connected peer-to-peer.'
    case 'disconnected':
      return 'The peer connection was interrupted.'
    case 'failed':
      return 'The peer connection failed.'
    case 'closed':
      return 'Chat closed.'
    case 'idle':
      return 'Not connected.'
  }
}

function ChatPage({ peerSessionFactory = createDefaultPeerSession }: ChatPageProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [inviteState, setInviteState] = useState<InviteState>(() => readInvite(location.hash))
  const [connectionState, setConnectionState] = useState<PeerConnectionState>('idle')
  const [inviteLink, setInviteLink] = useState('')
  const [answerCode, setAnswerCode] = useState('')
  const [answerInput, setAnswerInput] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [messages, setMessages] = useState<VisibleMessage[]>([])
  const [error, setError] = useState<string | null>(() => readInvite(location.hash).error)
  const [isBusy, setIsBusy] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const sessionRef = useRef<PeerSessionClient | null>(null)
  const unsubscribeRef = useRef<Array<() => void>>([])
  const setupGenerationRef = useRef(0)

  const appendMessage = useCallback((message: VisibleMessage) => {
    setMessages((current) => [...current, message].slice(-MAX_CHAT_HISTORY))
  }, [])

  const closeSession = useCallback(() => {
    for (const unsubscribe of unsubscribeRef.current) {
      unsubscribe()
    }
    unsubscribeRef.current = []
    sessionRef.current?.close()
    sessionRef.current = null
  }, [])

  const attachSession = useCallback((session: PeerSessionClient) => {
    closeSession()
    sessionRef.current = session

    unsubscribeRef.current = [
      session.onMessage((data) => {
        const message = parseChatMessage(data)
        if (message) {
          appendMessage({ direction: 'remote', message })
        }
      }),
      session.onStateChange((state) => {
        setConnectionState(state)

        if (state === 'failed') {
          setError('Could not establish the direct connection. Restart and try again.')
        } else if (state === 'disconnected') {
          setError('Your friend disconnected. Restart to create a new chat.')
        }
      }),
    ]
  }, [appendMessage, closeSession])

  const beginSetup = useCallback(() => {
    setupGenerationRef.current += 1
    return setupGenerationRef.current
  }, [])

  const isCurrentSetup = useCallback((generation: number) => (
    setupGenerationRef.current === generation
  ), [])

  useEffect(() => {
    if (location.hash.includes('offer=')) {
      navigate('/chat', { replace: true })
    }
  }, [location.hash, navigate])

  useEffect(() => () => {
    setupGenerationRef.current += 1
    closeSession()
  }, [closeSession])

  const restart = useCallback(() => {
    setupGenerationRef.current += 1
    closeSession()
    setInviteState({ offer: null, error: null })
    setConnectionState('idle')
    setInviteLink('')
    setAnswerCode('')
    setAnswerInput('')
    setMessageInput('')
    setMessages([])
    setError(null)
    setCopyStatus(null)
    setIsBusy(false)
    navigate('/chat', { replace: true })
  }, [closeSession, navigate])

  const handleCreateChat = async () => {
    const setupGeneration = beginSetup()
    setIsBusy(true)
    setError(null)
    setCopyStatus(null)

    try {
      const session = peerSessionFactory()
      attachSession(session)
      const offer = await session.createOffer()

      if (!isCurrentSetup(setupGeneration)) {
        return
      }

      setInviteLink(buildInviteLink(encodeSignal(offer)))
      setConnectionState('awaiting-answer')
    } catch {
      if (!isCurrentSetup(setupGeneration)) {
        return
      }

      setError('Could not create a chat invite. Restart and try again.')
      setConnectionState('failed')
    } finally {
      if (isCurrentSetup(setupGeneration)) {
        setIsBusy(false)
      }
    }
  }

  const handleJoinChat = async () => {
    if (!inviteState.offer) {
      return
    }

    const setupGeneration = beginSetup()
    setIsBusy(true)
    setError(null)
    setCopyStatus(null)

    try {
      const session = peerSessionFactory()
      attachSession(session)
      const answer = await session.acceptOffer(inviteState.offer)

      if (!isCurrentSetup(setupGeneration)) {
        return
      }

      setAnswerCode(encodeSignal(answer))
      setConnectionState('connecting')
    } catch {
      if (!isCurrentSetup(setupGeneration)) {
        return
      }

      setError('Could not create an answer for this invite. Restart and try again.')
      setConnectionState('failed')
    } finally {
      if (isCurrentSetup(setupGeneration)) {
        setIsBusy(false)
      }
    }
  }

  const handleApplyAnswer = async () => {
    if (!sessionRef.current) {
      setError('Create a chat before applying an answer.')
      return
    }

    const setupGeneration = beginSetup()
    setIsBusy(true)
    setError(null)

    try {
      const answer = decodeSignal(answerInput.trim(), 'answer')
      await sessionRef.current.applyAnswer(answer)

      if (!isCurrentSetup(setupGeneration)) {
        return
      }

      setConnectionState('connecting')
    } catch {
      if (!isCurrentSetup(setupGeneration)) {
        return
      }

      setError('That answer code is invalid. Ask your friend to copy it again.')
    } finally {
      if (isCurrentSetup(setupGeneration)) {
        setIsBusy(false)
      }
    }
  }

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const session = sessionRef.current
    if (!session || connectionState !== 'connected') {
      return
    }

    try {
      const message = createChatMessage(messageInput)
      session.send(serializeChatMessage(message))
      appendMessage({ direction: 'local', message })
      setMessageInput('')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send message.')
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

  const renderSetup = () => {
    if (inviteState.offer && !answerCode) {
      return (
        <section className="chat-card" aria-labelledby="join-chat-title">
          <p className="chat-eyebrow">You were invited</p>
          <h2 id="join-chat-title">Join this private chat</h2>
          <p>Your browser will create an answer code. Send that code back to the person who invited you.</p>
          <button
            className="chat-button chat-button--primary"
            disabled={isBusy}
            onClick={handleJoinChat}
            type="button"
          >
            {isBusy ? 'Joining…' : 'Join chat'}
          </button>
        </section>
      )
    }

    if (answerCode) {
      return (
        <section className="chat-card" aria-labelledby="answer-title">
          <p className="chat-eyebrow">Step 2 of 2</p>
          <h2 id="answer-title">Send this answer back</h2>
          <p>The person who invited you needs this code to finish the direct connection.</p>
          <label className="chat-field">
            <span>Answer code</span>
            <textarea aria-label="Answer code" readOnly rows={5} value={answerCode} />
          </label>
          <button
            className="chat-button"
            onClick={() => copyText('Answer code', answerCode)}
            type="button"
          >
            Copy answer code
          </button>
          <p className="chat-status" role="status">{describeState(connectionState)}</p>
        </section>
      )
    }

    if (inviteLink) {
      return (
        <section className="chat-card" aria-labelledby="invite-title">
          <p className="chat-eyebrow">Step 1 of 2</p>
          <h2 id="invite-title">Share this invite</h2>
          <p>Send the link to one friend and keep this tab open while they create an answer.</p>
          <label className="chat-field">
            <span>Invite link</span>
            <input aria-label="Invite link" readOnly type="text" value={inviteLink} />
          </label>
          <button
            className="chat-button"
            onClick={() => copyText('Invite link', inviteLink)}
            type="button"
          >
            Copy invite link
          </button>
          <div className="chat-divider" aria-hidden="true" />
          <label className="chat-field">
            <span>Answer code from your friend</span>
            <textarea
              aria-label="Answer code from your friend"
              onChange={(event) => setAnswerInput(event.target.value)}
              placeholder="Paste their answer code here"
              rows={5}
              value={answerInput}
            />
          </label>
          <button
            className="chat-button chat-button--primary"
            disabled={isBusy || !answerInput.trim()}
            onClick={handleApplyAnswer}
            type="button"
          >
            {isBusy ? 'Connecting…' : 'Connect'}
          </button>
          <p className="chat-status" role="status">{describeState(connectionState)}</p>
        </section>
      )
    }

    return (
      <section className="chat-card chat-card--intro" aria-labelledby="create-chat-title">
        <p className="chat-eyebrow">Browser to browser</p>
        <h2 id="create-chat-title">Start a private chat</h2>
        <p>Create a one-time invite for one friend. Messages travel directly between your browsers and are not stored by C00lG@mes+.</p>
        <button
          className="chat-button chat-button--primary"
          disabled={isBusy}
          onClick={handleCreateChat}
          type="button"
        >
          {isBusy ? 'Creating…' : 'Create chat'}
        </button>
      </section>
    )
  }

  return (
    <Page className="chat-page">
      <PageHeader>
        <BackLink to="/">Home</BackLink>
        <H1>Chat</H1>
        <P>Private, real-time browser chat powered by the same peer networking we can reuse for multiplayer games.</P>
      </PageHeader>

      <div className="chat-shell">
        {connectionState === 'connected' ? (
          <section className="chat-panel" aria-label="Peer chat">
            <div className="chat-panel__header">
              <div>
                <p className="chat-eyebrow">Direct connection</p>
                <h2>Connected</h2>
              </div>
              <span className="chat-connected-indicator">Peer-to-peer</span>
            </div>

            <div className="chat-messages" aria-live="polite">
              {messages.length === 0 ? (
                <p className="chat-empty">Connected. Send the first message.</p>
              ) : messages.map(({ direction, message }) => (
                <article
                  className={`chat-message chat-message--${direction}`}
                  key={message.id}
                >
                  <span>{direction === 'local' ? 'You' : 'Friend'}</span>
                  <p>{message.payload.text}</p>
                </article>
              ))}
            </div>

            <form className="chat-composer" onSubmit={handleSendMessage}>
              <label className="chat-field chat-field--message">
                <span>Message</span>
                <input
                  aria-label="Message"
                  autoComplete="off"
                  maxLength={MAX_CHAT_MESSAGE_LENGTH}
                  onChange={(event) => setMessageInput(event.target.value)}
                  placeholder="Message your friend"
                  type="text"
                  value={messageInput}
                />
              </label>
              <button
                className="chat-button chat-button--primary"
                disabled={!messageInput.trim()}
                type="submit"
              >
                Send
              </button>
            </form>
          </section>
        ) : renderSetup()}

        {error ? <p className="chat-error" role="alert">{error}</p> : null}
        {copyStatus ? <p className="chat-copy-status" role="status">{copyStatus}</p> : null}

        {(connectionState !== 'idle' || inviteState.offer || inviteState.error) ? (
          <button className="chat-button chat-button--quiet" onClick={restart} type="button">
            Restart chat
          </button>
        ) : null}

        <aside className="chat-note">
          <strong>Prototype note</strong>
          <p>No account, server-side chat history, or C00lG@mes+ signaling server is used. Some restrictive networks may not connect until we add TURN support later.</p>
        </aside>
      </div>
    </Page>
  )
}

export default ChatPage
