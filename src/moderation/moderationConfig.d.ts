import type { ModerationConfig } from './moderationCore'

declare global {
  const __CHAT_MODERATION_CONFIG__: ModerationConfig
}

export {}
