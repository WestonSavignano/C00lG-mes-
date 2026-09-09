import {
  maskConfiguredTerms,
  type ModerationConfig,
} from './moderationCore'

export const moderationConfig: ModerationConfig = __CHAT_MODERATION_CONFIG__

export function moderateChatText(text: string) {
  return maskConfiguredTerms(text, moderationConfig)
}
