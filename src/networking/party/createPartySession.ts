import { moderateChatText } from '../../moderation/moderationConfig'
import {
  generateCapability,
  generateCredentialId,
  generatePartyId,
} from './partyCrypto'
import {
  createInitialGuestPartyRecord,
  IndexedDbGuestPartyStore,
  type GuestPartyStore,
} from './guestPartyStore'
import { GuestPartyReplica } from './guestPartyReplica'
import { HostPartyAuthority } from './hostPartyAuthority'
import {
  acquireHostPartyLock,
  type HostPartyLockLease,
  type LockManagerLike,
} from './hostPartyLock'
import {
  createInitialHostPartyRecord,
  IndexedDbHostPartyStore,
  type HostPartyStore,
} from './hostPartyStore'
import {
  createGuestPartyHandshake,
  createHostPartyHandshake,
} from './partyHandshake'
import {
  buildHostPartyHash,
  buildSanitizedGuestHash,
  type buildGuestInviteHash,
} from './partyRoutes'
import {
  GuestPartySession,
  HostPartySession,
  type PartySessionClient,
  type PartyTransportClient,
} from './PartySession'
import {
  TrysteroNostrTransport,
  type TrysteroNostrTransportOptions,
} from './trysteroNostrTransport'
import type { PartyRoute } from './partyTypes'

class DeferredTransport implements PartyTransportClient {
  private delegate: PartyTransportClient | null = null

  attach(delegate: PartyTransportClient) {
    if (this.delegate) throw new Error('Party transport is already attached')
    this.delegate = delegate
  }

  private get required() {
    if (!this.delegate) throw new Error('Party transport is not attached')
    return this.delegate
  }

  start() { return this.required.start() }
  send(data: string, target?: string | string[] | null) { return this.required.send(data, target) }
  peerIds() { return this.required.peerIds() }
  disconnectPeer(peerId: string) { this.required.disconnectPeer(peerId) }
  dispose() { return this.required.dispose() }
}

export type PartySessionStart = {
  session: PartySessionClient
  canonicalHash: string
  scrubInviteAfterConnect: boolean
}

export interface PartySessionFactoryClient {
  startHost(): Promise<PartySessionStart>
  restoreHost(partyId: string): Promise<PartySessionStart>
  joinGuestInvite(route: Extract<PartyRoute, { kind: 'guest-invite' }>): Promise<PartySessionStart>
  restoreGuest(partyId: string): Promise<PartySessionStart>
}

type TransportFactory = (options: TrysteroNostrTransportOptions) => PartyTransportClient

type Dependencies = {
  hostStore?: HostPartyStore
  guestStore?: GuestPartyStore
  lockManager?: LockManagerLike | null
  acquireLock?: (partyId: string) => Promise<HostPartyLockLease>
  transportFactory?: TransportFactory
  origin?: string
  requestPersistentStorage?: () => Promise<void>
}

async function defaultPersistentStorageRequest() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return
  try {
    await navigator.storage.persist()
  } catch {
    // Persistence is best-effort. IndexedDB durability remains authoritative.
  }
}

function defaultOrigin() {
  return typeof window === 'undefined' ? 'https://coolgamesplus.com' : window.location.origin
}

function reloadRequiredError(cause: unknown) {
  return new Error('Party networking could not shut down safely. Reload this page before trying again.', { cause })
}

export function createBrowserPartySessionFactory(dependencies: Dependencies = {}): PartySessionFactoryClient {
  const hostStore = dependencies.hostStore ?? new IndexedDbHostPartyStore()
  const guestStore = dependencies.guestStore ?? new IndexedDbGuestPartyStore()
  const transportFactory = dependencies.transportFactory ?? ((options) => new TrysteroNostrTransport(options))
  const origin = dependencies.origin ?? defaultOrigin()
  const requestPersistentStorage = dependencies.requestPersistentStorage ?? defaultPersistentStorageRequest
  const acquireLock = dependencies.acquireLock ?? ((partyId: string) => acquireHostPartyLock(
    partyId,
    dependencies.lockManager === undefined ? undefined : dependencies.lockManager,
  ))

  async function createHostSession(partyId: string, mode: 'new' | 'restore'): Promise<PartySessionStart> {
    const lock = await acquireLock(partyId)
    let session: HostPartySession | null = null
    try {
      if (mode === 'new') await requestPersistentStorage()
      const authority = mode === 'new'
        ? await HostPartyAuthority.create(
            hostStore,
            await createInitialHostPartyRecord({ partyId }),
            { moderate: moderateChatText },
          )
        : await HostPartyAuthority.restore(hostStore, partyId, { moderate: moderateChatText })

      const deferred = new DeferredTransport()
      session = new HostPartySession({ authority, transport: deferred, lock, origin })
      const handshake = createHostPartyHandshake({
        authority,
        onAuthenticated: (authenticated) => session?.handleAuthenticated(authenticated),
      })
      const transport = transportFactory({
        role: 'host',
        partyId,
        rendezvousCapability: authority.state.rendezvousCapability,
        onPeerHandshake: handshake,
        onMessage: (data, peerId) => session?.handleMessage(data, peerId),
        onPeerJoin: (peerId) => session?.handlePeerJoin(peerId),
        onPeerLeave: (peerId) => session?.handlePeerLeave(peerId),
      })
      deferred.attach(transport)
      await deferred.start()
      return {
        session,
        canonicalHash: buildHostPartyHash(partyId),
        scrubInviteAfterConnect: false,
      }
    } catch (error) {
      if (session) {
        const cleanup = await session.dispose()
        if (cleanup.requiresReload) throw reloadRequiredError(error)
      } else {
        lock.release()
        await lock.released
      }
      throw error
    }
  }

  async function createGuestSession(input: {
    record: ReturnType<typeof createInitialGuestPartyRecord>
    admissionCapability?: string
    scrubInviteAfterConnect: boolean
  }): Promise<PartySessionStart> {
    const replica = new GuestPartyReplica(input.record)
    const deferred = new DeferredTransport()
    const session = new GuestPartySession({ replica, store: guestStore, transport: deferred })
    const handshake = createGuestPartyHandshake({
      replica,
      store: guestStore,
      admissionCapability: input.admissionCapability,
      onAuthenticated: (authenticated) => session.handleAuthenticated(authenticated),
    })
    const transport = transportFactory({
      role: 'guest',
      partyId: input.record.partyId,
      rendezvousCapability: input.record.rendezvousCapability,
      onPeerHandshake: handshake,
      onMessage: (data, peerId) => session.handleMessage(data, peerId),
      onPeerJoin: (peerId) => { void session.handlePeerJoin(peerId) },
      onPeerLeave: (peerId) => session.handlePeerLeave(peerId),
    })
    deferred.attach(transport)
    try {
      await deferred.start()
    } catch (error) {
      const cleanup = await session.dispose()
      if (cleanup.requiresReload) throw reloadRequiredError(error)
      throw error
    }
    return {
      session,
      canonicalHash: buildSanitizedGuestHash(input.record.partyId),
      scrubInviteAfterConnect: input.scrubInviteAfterConnect,
    }
  }

  return {
    startHost: async () => createHostSession(generatePartyId(), 'new'),
    restoreHost: async (partyId) => createHostSession(partyId, 'restore'),
    joinGuestInvite: async (route) => {
      const existing = await guestStore.load(route.partyId)
      if (existing) {
        if (existing.hostFingerprint !== route.hostFingerprint) {
          throw new Error('This invite points to a different host than the member credentials stored in this browser.')
        }
        if (existing.rendezvousCapability !== route.rendezvousCapability) {
          throw new Error('This invite has a different rendezvous capability than the stored Chat party.')
        }
        const admitted = Boolean(existing.memberId && existing.incarnationId)
        return createGuestSession({
          record: existing,
          admissionCapability: admitted ? undefined : route.admissionCapability,
          scrubInviteAfterConnect: true,
        })
      }

      const record = createInitialGuestPartyRecord({
        partyId: route.partyId,
        rendezvousCapability: route.rendezvousCapability,
        hostFingerprint: route.hostFingerprint,
        credentialId: generateCredentialId(),
        credentialSecret: generateCapability(),
      })
      await guestStore.save(record)
      return createGuestSession({
        record,
        admissionCapability: route.admissionCapability,
        scrubInviteAfterConnect: true,
      })
    },
    restoreGuest: async (partyId) => {
      const record = await guestStore.load(partyId)
      if (!record) {
        throw new Error('This browser no longer has valid member credentials for that Chat party.')
      }
      return createGuestSession({ record, scrubInviteAfterConnect: false })
    },
  }
}

export type GuestInviteInput = Parameters<typeof buildGuestInviteHash>[0]
