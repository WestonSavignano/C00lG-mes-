import { describe, expect, it } from 'vitest'
import vercelConfigSource from '../vercel.json?raw'

type VercelConfig = {
  git?: {
    deploymentEnabled?: boolean | Record<string, boolean>
  }
  routes?: Array<{ handle?: string; src?: string; dest?: string }>
}

const parseVercelConfig = (): VercelConfig => JSON.parse(vercelConfigSource) as VercelConfig

describe('Vercel configuration', () => {
  it('auto-deploys only the main branch', () => {
    const config = parseVercelConfig()

    expect(config.git?.deploymentEnabled).toEqual({
      '*': false,
      main: true,
    })
  })

  it('serves static files first and falls back client-side routes to the SPA without Chat Functions', () => {
    const config = parseVercelConfig()

    expect(config.routes?.[0]).toEqual({ handle: 'filesystem' })
    expect(config.routes?.[1]).toEqual({ src: '/.*', dest: '/index.html' })
    expect(vercelConfigSource).not.toContain('/api/chat')
  })
})
