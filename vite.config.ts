import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { buildModerationConfig } from './src/moderation/buildModerationConfig'

const base = process.env.GITHUB_PAGES === 'true' ? '/C00lG-mes-/' : '/'
const phaserCspEntry = fileURLToPath(
  new URL('./node_modules/phaser/src/phaser-esm.js', import.meta.url),
)
const phaserSpectorStub = fileURLToPath(
  new URL('./src/games/shared/phaserSpectorStub.ts', import.meta.url),
)
const moderationConfig = buildModerationConfig(process.env.CHAT_MODERATION_TERMS)

// https://vite.dev/config/
export default defineConfig({
  base,
  build: {
    chunkSizeWarningLimit: 700,
  },
  define: {
    __CHAT_MODERATION_CONFIG__: JSON.stringify(moderationConfig),
  },
  plugins: [react()],
  resolve: {
    alias: {
      'phaser-csp': phaserCspEntry,
      phaser3spectorjs: phaserSpectorStub,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
