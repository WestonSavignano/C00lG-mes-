import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { KeyboardBinding } from './keyboardInput'
import { useSemanticInput } from './useSemanticInput'

const bindings: readonly KeyboardBinding<'boost'>[] = [
  { code: 'Space', hold: 'boost', preventDefault: true },
]

describe('useSemanticInput', () => {
  it('keeps one input instance across renders and resets it on unmount', () => {
    const { result, rerender, unmount } = renderHook(() =>
      useSemanticInput(bindings),
    )
    const input = result.current

    rerender()
    expect(result.current).toBe(input)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    expect(input.reader.isHeld('boost')).toBe(true)

    unmount()
    expect(input.reader.isHeld('boost')).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    expect(input.reader.isHeld('boost')).toBe(false)
  })
})
