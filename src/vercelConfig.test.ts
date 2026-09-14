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

  it('preserves Functions before falling back client-side routes to the SPA', () => {
    const config = parseVercelConfig()

    expect(config.routes?.[0]).toEqual({ handle: 'filesystem' })
    expect(config.routes?.[1]).toEqual({ src: '/.*', dest: '/index.html' })
  })
})
