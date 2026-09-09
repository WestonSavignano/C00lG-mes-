import {
  maskConfiguredTerms,
  type ModerationConfig,
} from './moderationCore'

declare const __CHAT_MODERATION_CONFIG__: ModerationConfig

export const moderationConfig: ModerationConfig = __CHAT_MODERATION_CONFIG__

export function moderateChatText(text: string) {
  return maskConfiguredTerms(text, moderationConfig)
}
