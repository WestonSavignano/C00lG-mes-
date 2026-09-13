import { describe, expect, it } from 'vitest'
import { createSemanticInput } from '../shared/input/semanticInput'
import { attachKeyboardInput } from '../shared/input/keyboardInput'
import { SCHOOL_ESCAPE_KEYBOARD_BINDINGS } from './schoolEscapeInput'

describe('School Escape semantic input', () => {
  it('maps WASD movement, Shift sprint hold, and Space jump press', () => {
    const input = createSemanticInput<'sprint' | 'jump'>()
    const detach = attachKeyboardInput(window, input.writer, SCHOOL_ESCAPE_KEYBOARD_BINDINGS)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
    expect(input.reader.move.x).toBeGreaterThan(0)
    expect(input.reader.move.y).toBeLessThan(0)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }))
    expect(input.reader.isHeld('sprint')).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    expect(input.reader.consumePress('jump')).toBe(true)
    expect(input.reader.consumePress('jump')).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }))
    expect(input.reader.isHeld('sprint')).toBe(false)
    detach()
  })
})
