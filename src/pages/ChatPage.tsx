import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MAX_CHAT_MESSAGE_LENGTH } from '../chat/chatProtocol'
import BackLink from '../components/BackLink'
import H1 from '../components/H1'
import P from '../components/P'
import Page from '../components/Page'
import PageHeader from '../components/PageHeader'
import type {
  PartySessionClient,
  PartySessionSnapshot,
} from '../networking/party/PartySession'
import {
  createBrowserPartySessionFactory,
  type PartySessionFactoryClient,
  type PartySessionStart,
} from '../networking/party/createPartySession'
import { parsePartyHash } from '../networking/party/partyRoutes'
import './ChatPage.css'

type HostSessionControls = PartySessionClient & {
  setLocked(locked: boolean): Promise<void>
  removeMember(memberId: string): Promise<void>
}

type ChatPageProps = {
  sessionFactory?: PartySessionFactoryClient
}

type DiscoveryDelay = 'none' | 'slow' | 'retry'

function isHostControls(session: PartySessionClient | null): session is HostSessionControls {
  return Boolean(session
    && 'setLocked' in session
    && typeof session.setLocked === 'function'
    && 'removeMember' in session
    && typeof session.removeMember === 'function')
}

function statusText(snapshot: PartySessionSnapshot) {
  switch (snapshot.status) {
    case 'starting': return 'Starting Chat…'
    case 'waiting': return 'Waiting for guests…'
    case 'finding-host': return 'Finding host…'
    case 'connected': return 'Connected'
    case 'reconnecting': return 'Reconnecting…'
    case 'removed': return 'You were removed from this Chat.'
    case 'reload-required': return 'Reload this page to reconnect safely.'
    case 'error': return snapshot.error ?? 'Chat could not connect.'
  }
}

function routeMatchesSession(
  route: ReturnType<typeof parsePartyHash>,
  snapshot: PartySessionSnapshot | null,
) {
  if (!snapshot || !('partyId' in route) || route.partyId !== snapshot.partyId) return false
  if (route.kind === 'host') return snapshot.role === 'host'
  if (route.kind === 'guest' || route.kind === 'guest-invite') return snapshot.role === 'guest'
  return false
}

export default function ChatPage({ sessionFactory }: ChatPageProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const factory = useMemo(
    () => sessionFactory ?? createBrowserPartySessionFactory(),
    [sessionFactory],
  )
  const sessionRef = useRef<PartySessionClient | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const startMetaRef = useRef<Pick<PartySessionStart, 'canonicalHash' | 'scrubInviteAfterConnect'> | null>(null)
  const generationRef = useRef(0)
  const intentionalLeaveRef = useRef(false)
  const [snapshot, setSnapshot] = useState<PartySessionSnapshot | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [discoveryDelay, setDiscoveryDelay] = useState<DiscoveryDelay>('none')

  const replaceSession = useCallback(async (start: PartySessionStart) => {
    unsubscribeRef.current?.()
    const previous = sessionRef.current
    if (previous && previous !== start.session) {
      await previous.dispose()
    }
    sessionRef.current = start.session
    startMetaRef.current = {
      canonicalHash: start.canonicalHash,
      scrubInviteAfterConnect: start.scrubInviteAfterConnect,
    }
    setSnapshot(start.session.getSnapshot())
    unsubscribeRef.current = start.session.subscribe(setSnapshot)
    setPageError(null)
  }, [])

  const navigateToHash = useCallback((hash: string) => {
    navigate({ pathname: location.pathname, search: location.search, hash }, { replace: true })
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    const route = parsePartyHash(location.hash)
    if (intentionalLeaveRef.current) {
      if (route.kind === 'none') {
        intentionalLeaveRef.current = false
      }
      return
    }
    if (routeMatchesSession(route, snapshot)) return
    if (route.kind === 'none') return
    if (route.kind === 'invalid') {
      setPageError('This Chat link is incomplete or no longer valid.')
      return
    }

    const generation = ++generationRef.current
    setBusy(true)
    setPageError(null)
    void (async () => {
      try {
        let start: PartySessionStart
        if (route.kind === 'host') start = await factory.restoreHost(route.partyId)
        else if (route.kind === 'guest') start = await factory.restoreGuest(route.partyId)
        else start = await factory.joinGuestInvite(route)

        if (generation !== generationRef.current) {
          await start.session.dispose()
          return
        }
        await replaceSession(start)
      } catch (error) {
        if (generation === generationRef.current) {
          setPageError(error instanceof Error ? error.message : 'Chat could not start.')
        }
      } finally {
        if (generation === generationRef.current) setBusy(false)
      }
    })()
  }, [factory, location.hash, replaceSession, snapshot])

  useEffect(() => {
    const meta = startMetaRef.current
    if (!meta?.scrubInviteAfterConnect || snapshot?.status !== 'connected') return
    meta.scrubInviteAfterConnect = false
    navigateToHash(meta.canonicalHash)
  }, [navigateToHash, snapshot?.status])

  useEffect(() => {
    const waitingForHost = snapshot?.role === 'guest'
      && (snapshot.status === 'finding-host' || snapshot.status === 'reconnecting')
    if (!waitingForHost) {
      setDiscoveryDelay('none')
      return
    }

    setDiscoveryDelay('none')
    const slowTimer = window.setTimeout(() => setDiscoveryDelay('slow'), 10_000)
    const retryTimer = window.setTimeout(() => setDiscoveryDelay('retry'), 75_000)
    return () => {
      window.clearTimeout(slowTimer)
      window.clearTimeout(retryTimer)
    }
  }, [snapshot?.partyId, snapshot?.role, snapshot?.status])

  useEffect(() => () => {
    generationRef.current += 1
    unsubscribeRef.current?.()
    const session = sessionRef.current
    sessionRef.current = null
    if (session) void session.dispose()
  }, [])

  const startHost = useCallback(async () => {
    setBusy(true)
    setPageError(null)
    const generation = ++generationRef.current
    try {
      const start = await factory.startHost()
      if (generation !== generationRef.current) {
        await start.session.dispose()
        return
      }
      await replaceSession(start)
      navigateToHash(start.canonicalHash)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Chat could not start.')
    } finally {
      if (generation === generationRef.current) setBusy(false)
    }
  }, [factory, navigateToHash, replaceSession])

  const retryGuestConnection = useCallback(async () => {
    const current = sessionRef.current
    const currentSnapshot = snapshot
    if (!current || currentSnapshot?.role !== 'guest') return

    const generation = ++generationRef.current
    setBusy(true)
    setPageError(null)
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    sessionRef.current = null
    startMetaRef.current = null

    try {
      const cleanup = await current.dispose()
      if (cleanup.requiresReload) {
        setSnapshot({ ...currentSnapshot, status: 'reload-required', error: null })
        return
      }

      const start = await factory.restoreGuest(currentSnapshot.partyId)
      if (generation !== generationRef.current) {
        await start.session.dispose()
        return
      }
      await replaceSession(start)
    } catch (error) {
      if (generation === generationRef.current) {
        setPageError(error instanceof Error ? error.message : 'Chat could not reconnect.')
      }
    } finally {
      if (generation === generationRef.current) setBusy(false)
    }
  }, [factory, replaceSession, snapshot])

  const copyInvite = useCallback(async () => {
    if (!snapshot?.inviteUrl) return
    try {
      await navigator.clipboard.writeText(snapshot.inviteUrl)
      setCopied(true)
    } catch {
      setPageError('Copy failed. Select the invite link and copy it manually.')
    }
  }, [snapshot?.inviteUrl])

  const shareInvite = useCallback(async () => {
    if (!snapshot?.inviteUrl) return
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join my C00lG@mes+ Chat', url: snapshot.inviteUrl })
      } else {
        await navigator.clipboard.writeText(snapshot.inviteUrl)
        setCopied(true)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setPageError('Sharing failed. You can still copy the invite link manually.')
    }
  }, [snapshot?.inviteUrl])

  const toggleLock = useCallback(async () => {
    const session = sessionRef.current
    if (!snapshot || !isHostControls(session)) return
    try {
      await session.setLocked(!snapshot.locked)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Chat lock could not be changed.')
    }
  }, [snapshot])

  const removeMember = useCallback(async (memberId: string) => {
    const session = sessionRef.current
    if (!isHostControls(session)) return
    try {
      await session.removeMember(memberId)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'That guest could not be removed.')
    }
  }, [])

  const submitMessage = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    const session = sessionRef.current
    if (!session || !text) return
    try {
      await session.sendMessage(text)
      setDraft('')
      setPageError(null)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Message could not be sent.')
    }
  }, [draft])

  const leaveChat = useCallback(async () => {
    intentionalLeaveRef.current = true
    generationRef.current += 1
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    const session = sessionRef.current
    sessionRef.current = null
    startMetaRef.current = null
    setBusy(true)

    try {
      if (session) await session.dispose()
    } finally {
      setSnapshot(null)
      setPageError(null)
      setDraft('')
      setCopied(false)
      setBusy(false)
      navigateToHash('')
    }
  }, [navigateToHash])

  const canSend = snapshot?.role === 'host' || snapshot?.status === 'connected'

  return (
    <Page className="chat-page">
      <div className="chat-shell">
        <BackLink to="/">Back to C00lG@mes+</BackLink>
        <PageHeader>
          <H1>{snapshot?.role === 'host' ? 'Your Chat' : 'Chat'}</H1>
          <P>
            Start a small private party, share one invite link, and keep chatting while the host is online.
          </P>
        </PageHeader>

        {!snapshot ? (
          <section className="chat-card" aria-label="Start Chat">
            <h2>Start a Chat</h2>
            <p>The browser that starts the Chat is the host. Keep this tab available while guests are using the party.</p>
            <button className="chat-button chat-button--primary" type="button" disabled={busy} onClick={() => void startHost()}>
              {busy ? 'Starting…' : 'Start Chat'}
            </button>
          </section>
        ) : (
          <>
            <section className="chat-card chat-room-grid" aria-label="Chat controls">
              <div>
                <span className="chat-eyebrow">Party status</span>
                <p className={`chat-status chat-status--${snapshot.status}`}>{statusText(snapshot)}</p>
                <p className="chat-room-id">Party {snapshot.partyId}</p>
                {discoveryDelay === 'slow' ? (
                  <p className="chat-note">Finding the host can take a little longer on some networks.</p>
                ) : null}
                {discoveryDelay === 'retry' ? (
                  <div className="chat-retry-panel">
                    <p className="chat-note">Finding the host is taking longer than expected.</p>
                    <button className="chat-button" type="button" disabled={busy} onClick={() => void retryGuestConnection()}>
                      Retry
                    </button>
                  </div>
                ) : null}
              </div>

              {snapshot.role === 'host' && (
                <div className="chat-invite-panel">
                  <label className="chat-field">
                    <span>Guest invite</span>
                    {snapshot.inviteUrl ? (
                      <input readOnly value={snapshot.inviteUrl} aria-label="Guest invite link" onFocus={(event) => event.currentTarget.select()} />
                    ) : (
                      <input readOnly value="Chat is locked" aria-label="Guest invite link" />
                    )}
                  </label>
                  <div className="chat-actions">
                    <button className="chat-button" type="button" disabled={!snapshot.inviteUrl} onClick={() => void copyInvite()}>
                      {copied ? 'Copied' : 'Copy Invite'}
                    </button>
                    <button className="chat-button" type="button" disabled={!snapshot.inviteUrl} onClick={() => void shareInvite()}>
                      Share Invite
                    </button>
                    <button className="chat-button" type="button" onClick={() => void toggleLock()}>
                      {snapshot.locked ? 'Unlock Chat' : 'Lock Chat'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="chat-card chat-roster" aria-label="People in Chat">
              <div className="chat-section-heading">
                <h2>People</h2>
                <span>{snapshot.members.length + 1}/8</span>
              </div>
              <div className="chat-member-row">
                <span>Host</span>
                <strong>{snapshot.role === 'host' ? 'You' : 'Host'}</strong>
              </div>
              {snapshot.members.map((member) => (
                <div className="chat-member-row" key={member.memberId}>
                  <span>{member.label}</span>
                  {snapshot.role === 'host' ? (
                    <button
                      className="chat-button chat-button--danger"
                      type="button"
                      aria-label={`Remove ${member.label}`}
                      onClick={() => void removeMember(member.memberId)}
                    >
                      Remove
                    </button>
                  ) : member.memberId === snapshot.localMemberId ? <strong>You</strong> : <span>Guest</span>}
                </div>
              ))}
            </section>

            <section className="chat-panel" aria-label="Chat messages">
              <div className="chat-messages" aria-live="polite">
                {snapshot.messages.length === 0 ? (
                  <p className="chat-empty">No messages yet.</p>
                ) : snapshot.messages.map((message) => (
                  <article
                    className={`chat-message ${message.sender.memberId === snapshot.localMemberId ? 'chat-message--local' : 'chat-message--remote'}`}
                    key={`${message.id}-${message.sentAt}`}
                  >
                    <strong>{message.sender.memberId === snapshot.localMemberId ? 'You' : message.sender.label}</strong>
                    <p>{message.text}</p>
                  </article>
                ))}
              </div>
              <form className="chat-composer" onSubmit={(event) => void submitMessage(event)}>
                <label className="chat-field">
                  <span>Message</span>
                  <input
                    aria-label="Message"
                    autoComplete="off"
                    maxLength={MAX_CHAT_MESSAGE_LENGTH}
                    value={draft}
                    disabled={!canSend || snapshot.status === 'removed'}
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    placeholder={canSend ? 'Type a message…' : 'Waiting for the host…'}
                  />
                </label>
                <button className="chat-button chat-button--primary" type="submit" disabled={!canSend || !draft.trim()}>
                  Send
                </button>
              </form>
            </section>
          </>
        )}

        {(pageError || snapshot?.error) && (
          <p className="chat-error" role="alert">{pageError ?? snapshot?.error}</p>
        )}

        {location.hash ? (
          <button className="chat-button chat-button--quiet" type="button" disabled={busy} onClick={() => void leaveChat()}>
            Leave Chat
          </button>
        ) : null}

        <p className="chat-note">
          Chat is hosted by the player who started the party. Public connection services help browsers find each other; C00lG@mes+ does not run a dynamic Chat coordinator or store the party in the cloud.
        </p>
      </div>
    </Page>
  )
}
