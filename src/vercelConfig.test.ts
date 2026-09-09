import { describe, expect, it } from 'vitest'
import vercelConfigSource from '../vercel.json?raw'

describe('Vercel routing', () => {
  it('rewrites fresh client-side routes to the SPA entry point', () => {
    const config = JSON.parse(vercelConfigSource) as {
      rewrites?: Array<{ source?: string; destination?: string }>
    }

    expect(config.rewrites).toContainEqual({
      source: '/(.*)',
      destination: '/index.html',
    })
  })
})
