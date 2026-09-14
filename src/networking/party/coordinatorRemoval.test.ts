import { describe, expect, it } from 'vitest'

const retiredRuntimeSources = import.meta.glob(
  [
    '/api/chat/**/*',
    '/server/chat/**/*',
    '/src/networking/room/**/*',
    '/src/networking/webrtc/**/*',
    '/src/chat/RoomChatController*',
    '/src/chat/roomChatProtocol*',
  ],
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>

const runtimeConfigs = import.meta.glob(
  ['/tsconfig*.json', '/vercel.json'],
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>

const productionSources = import.meta.glob(
  [
    '/src/**/*.{ts,tsx}',
    '!/src/**/*.test.{ts,tsx}',
    '!/src/networking/poc/**/*',
  ],
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>

describe('retired Chat coordinator contract', () => {
  it('contains no obsolete coordinator/API/server runtime modules', () => {
    expect(Object.keys(retiredRuntimeSources)).toEqual([])
  })

  it('contains no production source references to the old coordinator path or API', () => {
    for (const [path, source] of Object.entries(productionSources)) {
      expect(source, path).not.toContain('/api/chat')
      expect(source, path).not.toContain('networking/room/')
      expect(source, path).not.toContain('RoomClient')
      expect(source, path).not.toContain('RoomPeerManager')
    }
  })

  it('has no server TypeScript project and keeps Vercel as a static SPA preview host', () => {
    expect(runtimeConfigs['/tsconfig.api.json']).toBeUndefined()
    expect(runtimeConfigs['/tsconfig.json']).not.toContain('tsconfig.api')
    expect(runtimeConfigs['/vercel.json']).not.toContain('/api/chat')
  })
})
