import {
  POC_HISTORY_LIMIT,
  POC_MAX_CHAT_LENGTH,
  type CanonicalChatEvent,
  type HostAuthorityState,
} from './hostAuthorityModel'

export type HostChatCommitResult =
  | { accepted: true; state: HostAuthorityState; event: CanonicalChatEvent }
  | { accepted: false; reason: 'invalid-message'; state: HostAuthorityState }

export function commitHostChat(state: HostAuthorityState, text: string): HostChatCommitResult {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > POC_MAX_CHAT_LENGTH) {
    return { accepted: false, reason: 'invalid-message', state }
  }

  const sequence = state.canonicalSequence + 1
  const event: CanonicalChatEvent = {
    sequence,
    type: 'chat.message',
    sender: { memberId: state.hostAppIdentity, label: 'Host' },
    text: trimmed,
    clientSequence: sequence,
  }
  return {
    accepted: true,
    state: {
      ...state,
      canonicalSequence: sequence,
      events: [...state.events, event].slice(-POC_HISTORY_LIMIT),
    },
    event,
  }
}
