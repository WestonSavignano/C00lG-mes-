import { commitHostChat } from './hostAuthorityHostMessage'
import {
  authenticateMember,
  buildSyncResponse,
  commitGuestChatIntent,
  isHostAuthorityState,
  removeMember,
  setPartyLocked,
  type AuthenticationResult,
  type AuthorityMutationResult,
  type AuthoritySyncResponse,
  type CanonicalChatEvent,
  type GuestChatIntent,
  type HostAuthorityState,
  type MemberRemovedEvent,
  type PartyLockedEvent,
} from './hostAuthorityModel'

export interface HostAuthorityStore {
  load(partyId: string): Promise<unknown>
  save(state: HostAuthorityState): Promise<void>
}

export class HostAuthoritySession {
  private currentState: HostAuthorityState
  private readonly store: HostAuthorityStore
  private readonly memberByTransport = new Map<string, string>()
  private readonly transportByMember = new Map<string, string>()
  private mutationQueue: Promise<void> = Promise.resolve()

  private constructor(store: HostAuthorityStore, state: HostAuthorityState) {
    this.store = store
    this.currentState = state
  }

  static async create(store: HostAuthorityStore, state: HostAuthorityState) {
    if (!isHostAuthorityState(state)) {
      throw new Error('Initial host authority state is invalid')
    }
    await store.save(state)
    return new HostAuthoritySession(store, state)
  }

  static async restore(store: HostAuthorityStore, partyId: string) {
    const persisted = await store.load(partyId)
    if (persisted === null || persisted === undefined) {
      throw new Error('No durable host state exists for this party')
    }
    if (!isHostAuthorityState(persisted)) {
      throw new Error('Durable host state is invalid')
    }
    return new HostAuthoritySession(store, persisted)
  }

  get state() {
    return this.currentState
  }

  authenticate(
    credential: { credentialId: string; credentialVerifier: string },
    createMemberId?: () => string,
  ): Promise<AuthenticationResult> {
    return this.enqueueMutation(async () => {
      const result = authenticateMember(this.currentState, credential, createMemberId)
      if (!result.accepted || result.state === this.currentState) {
        return result
      }
      await this.commitState(result.state)
      return { ...result, state: this.currentState }
    })
  }

  commitGuestChat(memberId: string, intent: GuestChatIntent) {
    return this.enqueueMutation(async () => {
      const result = commitGuestChatIntent(this.currentState, memberId, intent)
      if (!result.accepted) {
        return result
      }
      await this.commitState(result.state)
      return { ...result, state: this.currentState }
    })
  }

  commitHostChat(text: string) {
    return this.enqueueMutation(async () => {
      const result = commitHostChat(this.currentState, text)
      if (!result.accepted) {
        return result
      }
      await this.commitState(result.state)
      return { ...result, state: this.currentState }
    })
  }

  setLocked(locked: boolean): Promise<AuthorityMutationResult<PartyLockedEvent>> {
    return this.enqueueMutation(async () => {
      const result = setPartyLocked(this.currentState, locked)
      if (!result.event) {
        return result
      }
      await this.commitState(result.state)
      return { state: this.currentState, event: result.event }
    })
  }

  removeMember(memberId: string): Promise<AuthorityMutationResult<MemberRemovedEvent>> {
    return this.enqueueMutation(async () => {
      const result = removeMember(this.currentState, memberId)
      if (!result.event) {
        return result
      }
      await this.commitState(result.state)
      this.unbindMember(memberId)
      return { state: this.currentState, event: result.event }
    })
  }

  sync(memberId: string, lastCanonicalSequence: number, options?: { allowRemoved?: boolean }): AuthoritySyncResponse {
    return buildSyncResponse(this.currentState, memberId, lastCanonicalSequence, options)
  }

  async synchronize(memberId: string, lastCanonicalSequence: number, options?: { allowRemoved?: boolean }) {
    await this.mutationQueue
    return this.sync(memberId, lastCanonicalSequence, options)
  }

  bindTransport(memberId: string, peerId: string) {
    const existingMember = this.memberByTransport.get(peerId)
    if (existingMember && existingMember !== memberId) {
      this.transportByMember.delete(existingMember)
    }

    const replacedPeerId = this.transportByMember.get(memberId) ?? null
    if (replacedPeerId && replacedPeerId !== peerId) {
      this.memberByTransport.delete(replacedPeerId)
    }

    this.memberByTransport.set(peerId, memberId)
    this.transportByMember.set(memberId, peerId)
    return { replacedPeerId: replacedPeerId === peerId ? null : replacedPeerId }
  }

  memberForTransport(peerId: string) {
    return this.memberByTransport.get(peerId) ?? null
  }

  transportForMember(memberId: string) {
    return this.transportByMember.get(memberId) ?? null
  }

  authenticatedTransports() {
    return [...this.memberByTransport.keys()]
  }

  unbindTransport(peerId: string) {
    const memberId = this.memberByTransport.get(peerId)
    if (!memberId) {
      return
    }
    this.memberByTransport.delete(peerId)
    if (this.transportByMember.get(memberId) === peerId) {
      this.transportByMember.delete(memberId)
    }
  }

  private unbindMember(memberId: string) {
    const peerId = this.transportByMember.get(memberId)
    if (peerId) {
      this.memberByTransport.delete(peerId)
    }
    this.transportByMember.delete(memberId)
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation)
    this.mutationQueue = result.then(() => undefined, () => undefined)
    return result
  }

  private async commitState(nextState: HostAuthorityState) {
    await this.store.save(nextState)
    this.currentState = nextState
  }
}

export type HostAuthorityCommit =
  | CanonicalChatEvent
  | PartyLockedEvent
  | MemberRemovedEvent
