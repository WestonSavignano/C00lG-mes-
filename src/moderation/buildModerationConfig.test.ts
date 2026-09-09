import { describe, expect, it } from 'vitest'
import { buildModerationConfig } from './buildModerationConfig'

describe('buildModerationConfig', () => {
  it('gracefully returns an empty config for missing or empty environment values', () => {
    expect(buildModerationConfig(undefined)).toEqual({ hashesByTokenCount: {} })
    expect(buildModerationConfig('   ')).toEqual({ hashesByTokenCount: {} })
  })

  it('trims, deduplicates, and groups configured words and phrases', () => {
    const config = buildModerationConfig('spoiler, spoiler , secret phrase, ,SECRET PHRASE')
    expect(Object.keys(config.hashesByTokenCount)).toEqual(['1', '2'])
    expect(config.hashesByTokenCount['1']).toHaveLength(1)
    expect(config.hashesByTokenCount['2']).toHaveLength(1)
    expect(JSON.stringify(config)).not.toContain('spoiler')
    expect(JSON.stringify(config)).not.toContain('secret phrase')
  })
})
