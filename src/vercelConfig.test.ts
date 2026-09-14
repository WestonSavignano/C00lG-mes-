import { describe, expect, it } from 'vitest'
import vercelConfigSource from '../vercel.json?raw'

describe('Vercel routing', () => {
  it('serves static files first and falls back client-side routes to the SPA without Chat Functions', () => {
    const config = JSON.parse(vercelConfigSource) as {
      routes?: Array<{ handle?: string; src?: string; dest?: string }>
    }

    expect(config.routes?.[0]).toEqual({ handle: 'filesystem' })
    expect(config.routes?.[1]).toEqual({ src: '/.*', dest: '/index.html' })
    expect(vercelConfigSource).not.toContain('/api/chat')
  })
})
