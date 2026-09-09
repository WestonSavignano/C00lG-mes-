import { describe, expect, it } from 'vitest'
import { buildModerationConfig } from './buildModerationConfig'
import {
  maskConfiguredTerms,
  normalizeModerationToken,
} from './moderationCore'

describe('moderationCore', () => {
  it('is a no-op when no moderation terms are configured', () => {
    expect(maskConfiguredTerms('normal message', { hashesByTokenCount: {} })).toBe('normal message')
  })

  it('normalizes case, punctuation, and lightweight substitutions', () => {
    expect(normalizeModerationToken('SpOi.LeR!')).toBe('spoiler')
    expect(normalizeModerationToken('sp0iler')).toBe('spoiler')
  })

  it('masks configured words without touching unrelated text', () => {
    const config = buildModerationConfig('spoiler')
    expect(maskConfiguredTerms('That SPOILER was unexpected.', config)).toBe('That ******* was unexpected.')
    expect(maskConfiguredTerms('That ending was unexpected.', config)).toBe('That ending was unexpected.')
  })

  it('masks configured phrases while preserving whitespace between words', () => {
    const config = buildModerationConfig('secret phrase')
    expect(maskConfiguredTerms('a secret phrase appears', config)).toBe('a ****** ****** appears')
  })

  it('catches punctuation and whitespace inserted into a configured word', () => {
    const config = buildModerationConfig('spoiler')
    expect(maskConfiguredTerms('s.p.o.i.l.e.r', config)).toBe('*************')
    expect(maskConfiguredTerms('s p o i l e r', config)).toBe('* * * * * * *')
  })
})
