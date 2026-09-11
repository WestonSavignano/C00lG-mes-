import { describe, expect, it } from 'vitest'
import { getViewportOrientation, shouldSuggestOrientation } from './orientation'

describe('game orientation guidance', () => {
  it('classifies viewport orientation deterministically', () => {
    expect(getViewportOrientation(390, 844)).toBe('portrait')
    expect(getViewportOrientation(844, 390)).toBe('landscape')
    expect(getViewportOrientation(600, 600)).toBe('landscape')
  })

  it('suggests a declared landscape orientation on a portrait handheld', () => {
    expect(shouldSuggestOrientation('landscape', 390, 844, true)).toBe(true)
    expect(shouldSuggestOrientation('landscape', 844, 390, true)).toBe(false)
  })

  it('does not force guidance for either-orientation games or ordinary desktop use', () => {
    expect(shouldSuggestOrientation('either', 390, 844, true)).toBe(false)
    expect(shouldSuggestOrientation('landscape', 900, 1200, false)).toBe(false)
  })
})
