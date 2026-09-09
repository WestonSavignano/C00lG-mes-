import { describe, expect, it } from 'vitest'
import vercelConfigSource from '../vercel.json?raw'

describe('Vercel routing', () => {
  it('preserves Functions before falling back client-side routes to the SPA', () => {
    const config = JSON.parse(vercelConfigSource) as {
      routes?: Array<{ handle?: string; src?: string; dest?: string }>
    }

    expect(config.routes?.[0]).toEqual({ handle: 'filesystem' })
    expect(config.routes?.[1]).toEqual({ src: '/.*', dest: '/index.html' })
  })
})
